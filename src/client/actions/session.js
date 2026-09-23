// dsh-omkb · client/src/actions/session.js
// 【会话与输入机】：从 DSH 的 sessions / conversation 服务上读东西、算东西 —— 全是纯函数。
//
// 为什么单独一个文件：门面（./index.js）的每个动作都要先回答「现在动的是哪个会话、它的输入机
// 在哪、规划模式开着没」，这些判断本身与「动作怎么编排」无关，而且**可单独验**：自检塞一个假的
// sessions 快照进来就能断言（不必起浏览器）。所以这里一律不持状态，参数进、结果出。
//
// 三个容易搞错的地方：
//   * `sessions.binding(id)` 在部分实现里会给可见会话 **lazy mint 一个 scope**（有副作用）
//     → 只读投影判断（planActiveOf）要能容忍「拿不到」，不要为了读它去把会话都绑一遍。
//   * 规划模式的投影形态是 `{ active, pending }`，**目标状态**是 `pending ? !active : active`
//     （折叠规则照抄 dsh-client-ui-plan 的 PlanChip）。
//   * 命令通道（/plan 这类）服务名可能是 `remote.commands`（typert 的嵌套服务），也可能只挂在
//     `remote` 上 —— 两个都试，别只认一个。

/**
 * 读当前会话的 plan 投影（键 `plan`，形态 { active, pending }）。
 * 折叠规则照抄 dsh-client-ui-plan 的 PlanChip：`pending ? !active : active` 才是「目标模式」。
 * @param sessions - ctx.sessions。
 * @param sessionId - 会话 id。
 * @returns {boolean|null} true=规划模式开，false=关，null=投影还没到达（不可知）。
 */
export const planActiveOf = (sessions, sessionId) => {
  if (!sessions || !sessionId) return null
  try {
    const binding = typeof sessions.binding === 'function' ? sessions.binding(sessionId) : null
    const projections = binding && binding.session ? binding.session.projections : null
    if (!projections) return null
    let value
    if (typeof projections.get === 'function') value = projections.get('plan')
    else if (typeof projections.faceOf === 'function') {
      const face = projections.faceOf('plan')
      value = face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : undefined
    }
    if (!value || typeof value !== 'object') return null
    const active = value.active === true
    const pending = value.pending === true
    return pending ? !active : active
  } catch (e) { return null }
}

/** 当前会话 id（sessions.list 快照的 current）。 */
export const currentSessionIdOf = (sessions) => {
  if (!sessions || !sessions.list) return null
  try {
    const s = sessions.list.getSnapshot()
    if (s && s.current) return s.current
  } catch (e) {}
  return null
}

/** 某个会话的作用域（conversation.input.for 要它）。 */
export const sessionScopeOf = (sessions, sid) => {
  if (!sessions || !sid) return undefined
  try { return typeof sessions.scope === 'function' ? sessions.scope(sid) : undefined } catch (e) { return undefined }
}

/**
 * 取当前会话的 composer 输入机（发送 / 同意拒绝 / 撤销重做 都从它走）。
 * 拿不到就返回 null —— 调用方各自决定降级方式，这里不猜。
 */
export const inputOf = (sessions, conversation) => {
  const sid = currentSessionIdOf(sessions)
  if (!sid || !conversation) return null
  if (typeof conversation.input !== 'object' || conversation.input === null) return null
  if (typeof conversation.input.for !== 'function') return null
  const scope = sessionScopeOf(sessions, sid)
  if (scope === undefined) return null
  try { return conversation.input.for(scope) } catch (e) { return null }
}

/**
 * 命令通道（ctx.remote.commands）：DSH 里 /plan 这类命令的唯一入口。
 * 服务名可能是 `remote.commands`（typert 的嵌套服务），也可能只挂在 `remote` 上。
 * @param service - (name) => service 的取值函数（**必须是延迟取值**：这些服务晚于本插件加载）。
 * @returns 命令通道对象，拿不到时 null。
 */
export const commandChannelOf = (service) => {
  const take = (name) => { try { return service(name) } catch (e) { return undefined } }
  const direct = take('remote.commands')
  if (direct && typeof direct.execute === 'function') return direct
  const remote = take('remote')
  if (remote && remote.commands && typeof remote.commands.execute === 'function') return remote.commands
  return null
}

/**
 * 「把这段文本接在草稿后面」的格式规则（**只此一份**：门面与极端情况下的降级路径共用）。
 * 中英混排时直接粘连会读不通，所以前一段结尾不是标点/空白就补一个空格。
 * @returns {string} 接好的完整草稿。
 */
export const formatDraft = (before, text) => {
  const head = String(before == null ? '' : before)
  const tail = String(text == null ? '' : text)
  if (!tail) return head
  const sep = head && !/[\s，。！？、；：,.!?;:]$/.test(head) ? ' ' : ''
  return head + sep + tail
}

// ---------------- 待确认交互（批准 / 拒绝）：纯判据，可单测 ----------------
//
// 「批准 / 拒绝」两颗键要回答的是 DSH 的**待确认交互**。它的真源是 uiSession 服务的
// `pendingInteractions`（快照是 Map<sessionId, interaction>，见 dsh-client-ui-session 的
// publishPendingInteractions）—— DSH 自己的审批面板与提问面板就是这么认的。
// 三种 kind 的答案**形状完全不同**，这是 DSH 的契约（照抄，不许自己编）：
//   approval    → answer('allowed-once' | 'rejected')
//                 （审批面板上那两个按钮打出去的就是这两个字面量）
//   plan-review → answer({ answers: [{ id, selected: [label] }] })
//                 （计划确认卡片：批准/拒绝就是那两行选项的 label）
//   question    → 需要**逐题作答**（可多选、可自定义输入）→ 这两颗键管不了，
//                 返回 null 让调用方如实说「做不到」，绝不替用户编一个答案。

/**
 * 从 uiSession 服务取**当前会话**那条待确认交互。
 * ⚠ 只认当前会话：别的会话挂着的审批不该被我这颗键按掉（宁可什么都不做）。
 * @param uiSession - ctx.get('uiSession')（拿不到时返回 null）。
 * @param sessionId - 当前会话 id。
 * @returns {object|null} 待确认交互（自带 kind 与 answer()）；没有 → null。
 */
export const pendingInteractionOf = (uiSession, sessionId) => {
  if (!uiSession || !sessionId) return null
  const store = uiSession.pendingInteractions
  if (!store || typeof store.getSnapshot !== 'function') return null
  let snap = null
  try { snap = store.getSnapshot() } catch (e) { return null }
  if (!snap) return null
  try {
    if (typeof snap.get === 'function') return snap.get(sessionId) || null
    return snap[sessionId] || null
  } catch (e) { return null }
}

/**
 * 计划确认（plan-review）的窄化规则 —— **照抄** dsh-client-ui-user-questions 的 planReviewOf：
 * 单题、声明了 plan-review 意图、带 detail、非多选、至多两个选项，且其中一个的 label 等于
 * 意图里的 approve。满足这些才由「批准 / 拒绝」两颗键作答，否则归提问面板（那颗键不该碰）。
 * @param pending - 待确认交互。
 * @returns {object|null} { id, question, approve, decline? }；不适配 → null。
 */
export const planReviewOf = (pending) => {
  const questions = pending && pending.questions
  if (!Array.isArray(questions) || questions.length !== 1) return null
  const q = questions[0]
  const intent = q && q.intent
  if (!intent || intent.kind !== 'plan-review' || q.detail === undefined) return null
  if (q.multiSelect === true) return null
  const options = Array.isArray(q.options) ? q.options : []
  if (options.length > 2) return null
  const approve = options.find((o) => o && o.label === intent.approve)
  if (!approve) return null
  const decline = options.find((o) => o && o.label !== intent.approve)
  return { id: q.id, question: q.question, approve, ...(decline ? { decline } : {}) }
}

/**
 * 「批准 / 拒绝」要送给 answer() 的载荷。
 * @param pending - 待确认交互。
 * @param action - 'approve' | 'reject'。
 * @returns {string|object|null} 载荷；**null = 这颗键管不了当前这类交互**（调用方如实说）。
 */
export const answerFor = (pending, action) => {
  if (!pending || typeof pending.answer !== 'function') return null
  const approve = action === 'approve'
  const kind = pending.kind || 'approval'
  if (kind === 'approval') return approve ? 'allowed-once' : 'rejected'
  if (kind === 'plan-review') {
    const review = planReviewOf(pending)
    if (!review) return null
    const opt = approve ? review.approve : review.decline
    if (!opt || !opt.label) return null // 没有「拒绝」选项时，不许拿批准顶上
    return { answers: [{ id: review.id, selected: [opt.label] }] }
  }
  return null
}
