// dsh-micro · client/src/actions/session.js
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
//   * 「当前会话是哪条」的唯一判据在 utils/session-list.js 的 currentSessionIdIn（本文件的
//     currentSessionIdOf 只是它的一层壳）：快照的 `current` 在 0.1.7-rc.2 里**不存在**，
//     要认 `retainedBy.mainView`。
//
// ⚠ 判据从 `utils/session-list.js` 拿，**不要**从 `../core.js` 拿：core.js 顶层 import React
//   （peerDependency），这个文件的价值就是「node 里塞个假快照就能断言」——
//   2026-09-26 从 core.js 拿过一次，verify:knob 等几套自检当场 ERR_MODULE_NOT_FOUND: react。

import { currentSessionIdIn } from '../utils/session-list.js'

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

/** 当前会话 id（判据只有一处：utils/session-list.js 的 currentSessionIdIn，见那里的长注释）。 */
export const currentSessionIdOf = (sessions) => {
  if (!sessions || !sessions.list) return null
  try { return currentSessionIdIn(sessions.list.getSnapshot()) } catch (e) { return null }
}

/** 某个会话的作用域（conversation.input.for 要它）。 */
export const sessionScopeOf = (sessions, sid) => {
  if (!sessions || !sid) return undefined
  try { return typeof sessions.scope === 'function' ? sessions.scope(sid) : undefined } catch (e) { return undefined }
}

/**
 * 会话快照里的那一行（`id / title / cwd / blank / origin / retainedBy`）。
 * 认据只有一处：`sessions.list.getSnapshot().byId[id]`；拿不到给 null（不猜、不新建）。
 */
export const sessionRowOf = (sessions, sid) => {
  if (!sessions || !sid || !sessions.list || typeof sessions.list.getSnapshot !== 'function') return null
  try {
    const snap = sessions.list.getSnapshot()
    const row = snap && snap.byId ? snap.byId[sid] : null
    return row && typeof row === 'object' ? row : null
  } catch (e) { return null }
}

/**
 * 会话的项目目录（「文件夹」键要的绝对路径）。
 * `cwd` 是 dsh-api-session-controller 的 listFields(header) 带出来的（`header.cwd`）——
 * 会话还没建完（没有 header.cwd）时**这个字段就是没有**，所以这里如实返回 null，
 * 由调用方报「这条会话没有记录项目目录」，绝不退回去猜一个路径。
 * @returns {string|null}
 */
export const sessionCwdOf = (sessions, sid) => {
  const row = sessionRowOf(sessions, sid)
  const cwd = row && row.cwd
  return typeof cwd === 'string' && cwd ? cwd : null
}

/**
 * 某条会话**现在跑哪个 Agent 预设**（host 算好的整值：预设 id 字符串；读不到 → undefined）。
 *
 * ⚠ 这个字段**不在会话面上**（2026-09-29 修掉的一个真 bug）：
 *   `sessions.binding(sid).session` 是 `SessionFace = ISession & ObservableSnapshot<SessionSnapshot>`
 *   —— 上面只有 `projections`（投影面）、`getSnapshot()/subscribe()` 与几个行为动词，
 *   **既没有 `projectionValues`、也没有 `blank`**（blank 住在 `getSnapshot()` 出来的快照里）。
 *   当初写这一处时是按「会话对象上应该有」猜的，实测两个字段都读到 undefined：
 *   `preset` **恒为 null** → `nextPresetOf` 每按一次都在算「清单第 0 个」→ 用户看到的是
 *   **「模式键按了不换」**（当前预设正好是第 0 个时 select 回同一个 id，界面上什么都不发生）。
 *
 * 两处取值，顺序就是可靠性：
 *   ① **会话列表快照的那一行**（`list.getSnapshot().byId[sid].projectionValues.agentPreset`）——
 *      官方 `AgentPresetSeatController` 的 `presetOf(summary)` 读的就是它；而这份快照本来就是
 *      「哪条是当前会话」的判据（utils/session-list.js 的 retainedBy.mainView），同一份快照出
 *      一致的口径，不必再开一条门路、也没有副作用；
 *   ② 行上没有（投影存储还没建：这条会话从没打开过）才退到**会话自己的投影面**
 *      （`binding.session.projections` 的 `get` / `faceOf('agentPreset')`）—— 与 planActiveOf 同一条。
 *      ⚠ 这条退路会碰 `binding()`（部分实现里给可见会话 lazy mint 一个 scope，有副作用），
 *      所以只在①确实缺的时候才走。
 * @returns {string|undefined} 预设 id；undefined = 读不到（**不是**「这个部署没配预设」——那种是 null）。
 */
export const agentPresetOf = (sessions, sid) => {
  if (!sessions || !sid) return undefined
  const row = sessionRowOf(sessions, sid)
  const fromRow = row && row.projectionValues ? row.projectionValues.agentPreset : undefined
  if (fromRow !== undefined) return fromRow
  try {
    const binding = typeof sessions.binding === 'function' ? sessions.binding(sid) : null
    const projections = binding && binding.session ? binding.session.projections : null
    if (!projections) return undefined
    if (typeof projections.get === 'function') return projections.get('agentPreset')
    if (typeof projections.faceOf === 'function') {
      const face = projections.faceOf('agentPreset')
      return face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : undefined
    }
  } catch (e) { return undefined }
  return undefined
}

/**
 * 当前会话绑定的 Agent 预设，以及「这条会话还能不能换预设」。
 * 两条判据都照抄 dsh-client-ui-agent-preset 的 `AgentPresetSeatController`：
 *   * 当前预设 = 会话列表那一行的 `projectionValues.agentPreset`（见 agentPresetOf）；
 *   * `blank` = **同一行的** `blank` —— host 算好、并用 `sessionListMetadata` 纠正过的那个
 *     （`buildListSnapshot`：`blank: effectiveBlank(summary) && metadata?.blank !== false`）。
 *     官方 `apply()` 写着 `if (!session.blank || presetOf(session) === staged) { clearStage(); return }`
 *     —— **只有 blank（还没开跑的空会话）能换**；跑到一半的会话按下去会被宿主以
 *     `agent-preset/locked` 拒掉（那条路只记日志），所以先把 blank 读出来让调用方**出声**，
 *     别让用户白按一下。
 * @returns {{preset: (string|null), blank: (boolean|null)}} blank=null 表示读不到（不可知）。
 */
export const agentPresetStateOf = (sessions, sid) => {
  const unknown = { preset: null, blank: null }
  if (!sessions || !sid) return unknown
  try {
    const row = sessionRowOf(sessions, sid)
    const value = agentPresetOf(sessions, sid)
    return {
      preset: typeof value === 'string' && value ? value : null,
      blank: row && (row.blank === true || row.blank === false) ? row.blank : null
    }
  } catch (e) { return unknown }
}

/**
 * Agent 预设通道（`ctx.remote.agentPresets`）—— 与 commandChannelOf 同一条规矩：
 * 服务名可能是 `remote.agentPresets`（typert 的嵌套服务），也可能只挂在 `remote` 上，两个都试。
 * @param service - (name) => service 的取值函数（**必须延迟取值**）。
 * @returns 预设通道（有 list/select），拿不到时 null。
 */
export const agentPresetsChannelOf = (service) => {
  const take = (name) => { try { return service(name) } catch (e) { return undefined } }
  const direct = take('remote.agentPresets')
  if (direct && typeof direct.list === 'function') return direct
  const remote = take('remote')
  if (remote && remote.agentPresets && typeof remote.agentPresets.list === 'function') return remote.agentPresets
  return null
}

/**
 * 「换下一个预设」的环形规则 —— **纯函数**（自检直接喂 `[{id,name}]` 断言，不认识 DSH）。
 * 几处口径：
 *   * **坏掉的**预设不参与：roster 行上的 `broken` 是**字符串原因**（`AgentPresetRow.broken?: string`，
 *     见 dsh-agent-preset-registry 的 types），**非空即不可用** —— 官方 `presetOptions()` 就是这么滤的
 *     （`presets.filter((p) => !p.broken)`）。
 *     ⚠ 2026-09-28 这里写的是 `broken !== true`，对字符串**恒真 = 等于没滤**：会转到坏掉的预设上，
 *     宿主回 `agent-preset/invalid`，而那条路是异步的（已经派发出去了）→ 只记日志、用户那边静默。
 *   * 可用项不足两个 → null（没有「切换」可言，调用方如实说「只有一个模式」）；
 *   * 当前 id **不在**清单里（例如会话没记录预设、或记录的是一个已被删掉的 id）→ 从第一个开始，
 *     这是唯一能不兜圈子的确定性选择。
 * @param presets - `remote.agentPresets.list()` 的 `value.presets`（roster 行）。
 * @param currentId - 当前会话绑定的预设 id（可为 null）。
 * @returns {object|null} 下一个可用预设。
 */
export const nextPresetOf = (presets, currentId) => {
  const list = (Array.isArray(presets) ? presets : [])
    .filter((p) => p && typeof p.id === 'string' && p.id && !p.broken)
  if (list.length < 2) return null
  const idx = list.findIndex((p) => p.id === currentId)
  return list[(idx + 1 + list.length) % list.length]
}

// ---------------- 归档被拒绝时的说法（纯函数，可单测） ----------------
//
// 归档的契约（取自从产物里读到的 DSH 自己的流程）：`uiWorkspace.archiveSession(sessionId)`
// 在**会话还有活动在跑**时会失败，抛出的错误上带
//   `rpcError.code === 'workspace/session-active'`，`rpcError.details.activity` 说明是什么在跑。
// DSH 自己的侧边栏遇到它就先弹确认框，用户点了才用 `{ stopActivity: true }` 重试
// （`archiveSession(sessionId, { stopActivity: true })`）。
//
// 本插件**不替用户停活**（停掉正在跑的任务是不可逆的，得由人决定），所以只把这件事说清楚：
// 「被拒绝了、因为还有活动在跑」。以前这里只记一行 `e.message`，用户看到的是「按了没反应」。
//
// 错误的形状不止一种（服务端 RPC 错误、普通 Error），所以两个位置都找一遍：错误自己身上的
// `rpcError`，以及被 `cause` 包着的那个。

/**
 * 认「归档被宿主拒绝了」这件事。
 * @param error - 捕获到的异常。
 * @returns {{code: string, activity: (string|null)}|null} 拒绝详情；不是这种拒绝 → null。
 */
export const archiveRefusalOf = (error) => {
  if (!error || typeof error !== 'object') return null
  const rpc = error.rpcError || (error.cause && error.cause.rpcError) || null
  if (!rpc || rpc.code !== 'workspace/session-active') return null
  const details = rpc.details || {}
  const activity = details.activity
  return { code: rpc.code, activity: typeof activity === 'string' && activity ? activity : null }
}

/**
 * 归档失败时该说的一句话（人话，带下一步）。
 * @param error - 捕获到的异常。
 * @returns {string}
 */
export const archiveFailureText = (error) => {
  const refusal = archiveRefusalOf(error)
  if (refusal) {
    const what = refusal.activity ? `（${refusal.activity}）` : ''
    return `归档被拒绝：当前会话还有活动在跑${what} —— 等它跑完再按，或到 DSH 侧边栏里用「停止并归档」`
  }
  return `归档失败：${(error && error.message) || error}`
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

// ---------------- 「目标」命令：命令名与草稿拼法（纯函数，可单测） ----------------
//
// 「目标」键（registry 的 goal）只做一件事：把命令**填进输入框**，不发送。
// 「填什么」只有一个判据：DSH 给这条命令注册的名字就是 `goal`（见下），这里写死它。

/**
 * 「目标」键要填的命令名 —— **DSH 注册的名字就是 `goal`，就是这一串**。
 *
 * 2026-10-01 用户报障「在对话框添加『目标』指令，发出去 DSH 不认」的根因就在这里：
 * 原先这一层写成「命令名跟着界面语言走」，从词典键 `cmd.goal` 取（中文拿 `/目标`）。
 * 但 DSH 的命令名**不本地化** —— `dsh-command-goal` 注册时写死
 *   `name: "goal"`，`USAGE = "Usage: /goal [<objective>|clear|edit <objective>|pause|resume]"`，
 *   也没有 aliases。中文界面里的「目标」只是**显示文案**（`dsh-client-ui-commands` 的
 *   `label.goal` / `token.goal`），它并不是一个已注册的命令 token。
 * 上游是拿输入框里那串**字面**去解析命令的，所以填 `/目标` 会得到一个 DSH 不认识的命令。
 *
 * ⚠ 所以命令名**不是文案**，不要再放回词典：`cmd.*` 那一段连同 `#t` 注入的整条间接层都已删除。
 *   要改命令名，改的是 DSH 的注册（或者这里这一处常量），不是翻译。
 */
export const GOAL_COMMAND = '/goal'

/**
 * 「把目标命令填进草稿」的拼法：命令**在最前面**，用户已经打进去的字接在后面（一个字都不丢）。
 *
 * 为什么命令必须在最前：slash 命令只有落在**行首**才被 DSH 当命令（落在中间就是普通文本），
 * 所以只能往前面放 —— 正好也把用户已打的字当成了「目标描述」，语义顺。
 *
 * ⚠ **幂等**：草稿已经以这条命令开头时返回 null（调用方什么都不做）——按两下不该叠成
 *   `/goal /goal xxx`。返回 null 不等于失败（想表达的就是「已经是你要的样子了」）。
 * @param {string} before - 当前草稿。
 * @returns {string|null} 新的草稿；null = 不用动。
 */
export const goalDraft = (before) => {
  const head = String(before == null ? '' : before).trim()
  if (!head) return GOAL_COMMAND + ' '
  if (head.startsWith(GOAL_COMMAND)) return null
  return GOAL_COMMAND + ' ' + head
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
