// dsh-omkb · client/src/actions/index.js
// ★ DeepSeek Harness 能力门面 ★ —— client/ 目录下**唯一**直接操作 DSH 的目录。
//
// 谁调它：keypad.js（按键）、joystick.js（摇杆）、knob.js（旋钮）、
// components/common/voice-button.jsx（把转写文本写回草稿）。那几处只负责「设备事件/手势 → 语义」——
// 键帽怎么解析、方向绑了什么动作、旋钮在哪个模式；真正落到 DSH 上的每一个动作都从这里走。
// 以前这些调用散在三个文件里，各自去摸 ctx 服务、sessions 投影、DSH 的 DOM，同一个能力在两处
// 各写一份兜底 —— 出问题要翻三个文件，而「下一转该去哪、菜单关没关、服务有没有」这类判断本来
// 只该有一份。现在只有这一份。
//
// 目录按「操作的对象」分四份，各有一个明确的开头（读哪个文件一眼能猜到）：
//   index.js      ← 门面本体：把下面三份拼成一组动作（这个文件）
//   dom.js        ← DSH 界面结构的唯一一份理解（判据 / 定位 / 高亮 / 滚动 / 键盘兜底）
//   session.js    ← 会话与输入机（会话 id / 输入机 / plan 投影 / 命令通道 / 草稿拼接）
//   reasoning.js  ← 仅推理（等级菜单的定位与蓝环）
//
// 【管什么】全是「对 DSH 发出操作」：
//   会话 / 输入机   currentSessionId · input · send · undo · redo · writeDraft
//   待确认交互      respond(approve|reject) → uiSession.pendingInteractions（审批 / 计划确认）
//   会话动作        archive           → uiWorkspace.archiveSession（退：POST /omkb/archive）
//                   fork              → uiWorkspace.forkSession（退：sessions.fork + open）
//   布局            toggleSidebar     → ctx.layout（跨插件服务面）
//   规划模式        planActive / togglePlan → 会话的 plan 投影 + /plan 命令通道
//   对话滚动        scrollStep / scrollToBottom → 当前会话的消息列表
//   输入区导航      navStep / navActivate → 自绘蓝环在可聚焦控件间移动（跳过文本输入框与语音控件）
//   仅推理          reasoningStep / reasoningPress → 转动移环、按下确认
//   输入框兜底      pressEnter（服务都拿不到时的最后一条路）
//
// 【谁决定「按一下要执行哪一个」】功能清单与实现入口在 ./registry.js（功能总表）——
// 键帽候选、旋钮自定义分配、按键分派、控制台都读那一份；这个文件只提供**能被调用的方法本体**，
// 于是「加一个功能」= 总表加一条 + 这里加一个方法（不需要新 DSH 能力时连这里都不用动）。
//
// 【不管什么】「读状态给界面看」不算操作，仍留在各自模块：
//   * 键盘灯/设置页下拉要的会话列表、归档集合 → core.js 的 visibleSessions/archivedIdsOf
//   * 灯的刷新与写设备 → agents.js（浏览器决定颜色，宿主决定何时变红）
//   * 语音识别本身（Web Speech API）→ voice.js，那不是 DSH 的能力
//
// 【可测性】依赖全部从构造参数注入（sessions / conversation / services / log），所以自检能把
// DshOps 跑在假环境里逐个动作断言「真的调到了哪个接口」；子模块的纯函数（定位、格式）也从这里
// 原样再导出，控制台与真机探针共用同一份判据（探针里不许再复刻一份）。
//
// 【接线】entry.js 装配一个 DshOps 实例，注入给三个控制器，并挂在 DSVI.services.ops 上
// （控制台可直接 `__dshOmkb.services.ops.togglePlan()` 手验）。

import {
  focusCollect, highlight, clearHighlight, planChipEl, sidebarToggleEl,
  scrollStepDir, scrollToBottomDir, dispatchEnter, dispatchUndoChord,
  interactionPanelButtons
} from './dom.js'
import { reasoningStepDir, reasoningPressOnce } from './reasoning.js'
import {
  planActiveOf, currentSessionIdOf, inputOf, commandChannelOf, formatDraft,
  pendingInteractionOf, answerFor, archiveFailureText
} from './session.js'

// 子模块的导出原样转发：「DSH 操作的零件」从 actions/index.js 一个入口就能拿到。
export * from './dom.js'
export * from './session.js'
export * from './reasoning.js'
// 功能总表也从这个入口转发：控制台/自检/三个控制器都只需认 actions/index.js 一条路
// （`__dshOmkb.actions.run('fork')` 手验任意功能，不必真按设备）。
// 第三方插件依赖清单**不在**这里：它是配置，住在 config/default.js 的 PLUGIN_DEPS。
export * from './registry.js'

export class DshOps {
  /** ctx.sessions（会话快照 / 投影）。 */
  sessions = null
  /** ctx 上的 conversation 服务（composer 输入机的入口）。 */
  conversation = null
  #services = () => undefined
  #log = null
  /** composer 的输入动作（由对话输入区槽位组件在挂载时交给我们，见 bindComposer）。 */
  #composer = null
  /** 输入区导航的当前位置（环停在第几个候选上）。 */
  #navIndex = -1
  #navList = []

  /**
   * @param options.sessions - ctx.sessions。
   * @param options.conversation - conversation 服务（拿 composer 输入机）。
   * @param options.services - (name) => service，取 ctx 上的跨插件服务（layout / remote.commands）。
   *                            别的客户端插件晚于本插件加载，所以取值必须延后到调用那一刻。
   * @param options.log - 记一行日志（默认 console.log 加 `[omkb] ` 前缀）。
   */
  constructor(options = {}) {
    const o = options || {}
    this.sessions = o.sessions || null
    this.conversation = o.conversation || null
    this.#services = typeof o.services === 'function' ? o.services : (() => undefined)
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }
  }

  log = (msg) => { this.#log(msg) }
  #service = (name) => { try { return this.#services(name) } catch (e) { return undefined } }

  // ---------------- 会话与输入机 ----------------

  /** 当前会话 id（sessions.list 快照的 current）。 */
  currentSessionId = () => currentSessionIdOf(this.sessions)

  /** 当前会话的 composer 输入机（拿不到返回 null，调用方各自决定降级方式）。 */
  input = () => inputOf(this.sessions, this.conversation)

  // ---------------- 输入机上的动作 ----------------

  /** 发送当前对话（输入机优先；拿不到输入机时退回「向聚焦元素派一次 Enter」）。 */
  send = () => {
    const input = this.input()
    if (input) {
      if (typeof input.submit === 'function') { try { input.submit(); return true } catch (e) {} }
      if (typeof input.send === 'function') { try { input.send(); return true } catch (e) {} }
    }
    return this.pressEnter()
  }

  // ---------------- 待确认交互（APPR 批准 / REJ 拒绝） ----------------

  /**
   * 对当前会话的待确认交互做出回应（批准 / 拒绝）。
   *
   * ⚠ 这里曾经用 `input.approve()/reject()/respond()` —— **这一版 DSH 的输入机没有这些方法**
   * （`conversation.input.for(scope)` 拿到的是 SessionInputShell，只有 setDraft/submit/notify…），
   * 于是 APPR / REJ 两颗键按下去静默什么都不发生（用户报的正是这个）。现在走正式的那条路：
   * uiSession 服务的 `pendingInteractions` 快照 → 那条交互自己的 `answer()`（DSH 自己的审批面板
   * 与提问面板用的就是它）；三种 kind 的答案形状见 ./session.js 的 answerFor。
   * 服务拿不到时退回**界面兜底**（点面板上的按钮），仍然拿不到就如实记一行日志。
   *
   * @param {'approve'|'reject'} action
   * @returns {boolean} 是否真的把回应发出去了。
   */
  respond = (action) => {
    const approve = action === 'approve'
    const pending = this.pendingInteraction()
    if (pending) {
      const payload = answerFor(pending, action)
      if (payload === null) {
        // 提问（question）要逐题作答（可多选/可自定义），这两颗键不该替用户编答案 —— 说清楚。
        this.log(`待确认交互是「${pending.kind || '?'}」：需要逐项作答，${approve ? '批准' : '拒绝'}键不代替你选，忽略`)
        return false
      }
      Promise.resolve()
        .then(() => pending.answer(payload))
        .catch((e) => this.log(`回应待确认交互失败：${(e && e.message) || e}`))
      return true
    }
    return this.#answerOnPanel(approve)
  }

  /** 当前会话挂着的待确认交互（审批 / 计划确认 / 提问）；没有或拿不到服务时 null。 */
  pendingInteraction = () => pendingInteractionOf(this.#service('uiSession'), this.currentSessionId())

  /**
   * 界面兜底：直接点审批 / 计划确认面板上的按钮。
   * 两个面板的按钮顺序一致（拒绝在左、允许/确认在右，见 ./dom.js 的 interactionPanelButtons），
   * 所以取「最后一个 = 批准、第一个 = 拒绝」。只在服务拿不到时走这条路。
   */
  #answerOnPanel = (approve) => {
    const btns = interactionPanelButtons()
    if (!btns.length) {
      this.log(`${approve ? '批准' : '拒绝'}失败：当前会话没有待确认的交互（也没找到审批面板）`)
      return false
    }
    const el = approve ? btns[btns.length - 1] : btns[0]
    try { el.click(); return true } catch (e) { return false }
  }

  // ---------------- 输入机上的动作（撤销 / 重做 / 输入框兜底） ----------------

  /**
   * 撤销 / 重做 = **composer 输入机的操作记录**（⌘Z / ⌘⇧Z 走的就是它）。
   * DSH 没有会话级的 undo，别在这里假装有：它撤销的是当前会话的**输入内容**（草稿），
   * 不是「上一条已发送的消息」。
   */
  undo = () => {
    const input = this.input()
    if (input && typeof input.undo === 'function') { try { input.undo(); return true } catch (e) {} }
    return dispatchUndoChord(false)
  }

  redo = () => {
    const input = this.input()
    if (input && typeof input.redo === 'function') { try { input.redo(); return true } catch (e) {} }
    return dispatchUndoChord(true)
  }

  /** 兜底：向当前聚焦元素派发一次 Enter（见 ./dom.js 的 dispatchEnter）。 */
  pressEnter = () => dispatchEnter()

  // ---------------- 把文本写回草稿（语音转写落盘用） ----------------

  /**
   * 绑定当前 composer 的输入动作（对话输入区槽位组件挂载时调用，卸载时传 null）。
   * 那套 inputActions 是 DSH 通过槽位 props 交给我们的，比自己去 DOM 里找输入框可靠。
   */
  bindComposer = (inputActions) => { this.#composer = inputActions || null }

  /**
   * 把文本写进 composer 草稿。`before` 是开始转写前的草稿，两者之间的拼接规则见 session.js
   * 的 formatDraft。两条路：槽位给我们的 inputActions（实机走这条）→ 输入机自己的 setDraft。
   * @returns {boolean} 是否真的写进去了。
   */
  writeDraft = (before, text) => {
    const next = formatDraft(before, text)
    if (next === String(before == null ? '' : before)) return false // 没有新内容
    const composer = this.#composer
    if (composer && typeof composer.setDraft === 'function') {
      try { composer.setDraft(next); return true } catch (e) {}
    }
    const input = this.input()
    if (input && typeof input.setDraft === 'function') {
      try { input.setDraft(next); return true } catch (e) {}
    }
    this.log('写回输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft')
    return false
  }

  // ---------------- 会话动作（ARCH 归档 / FORK 分叉） ----------------

  /**
   * 归档当前会话。
   * ① 官方客户端服务 `uiWorkspace.archiveSession` —— DSH 侧边栏里那个「归档」动作走的就是它
   *    （会同时处理「归档的正好是当前会话 → 清掉当前选择」）。
   * ② 退路：宿主旁路路由 POST /omkb/archive（宿主 workspaceRegistry.archiveSession；见 src/core/index.js）。
   *    它要求宿主重启过，所以只当兜底。
   *
   * ⚠ 失败必须**出声**：`archiveSession` 在「会话还有活动在跑」时会拒绝（`rpcError.code ===
   * 'workspace/session-active'`），DSH 自己的流程是弹确认框、用户点了才用 `{ stopActivity: true }`
   * 重试。本插件不替用户停活（不可逆），但要把拒绝说清楚 —— 否则表现就是「按了没反应」
   * （归档键「无法使用」的那次报障里，前半段是会话 id 取不到、后半段就是这个静默）。
   *
   * @returns {boolean} 是否真的派发出去（拿不到任何入口 → false + 一行日志）。
   */
  archive = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.log('归档失败：认不出当前会话（快照里既没有 current，也没有被主视图持有的那条）'); return false }
    const ui = this.#service('uiWorkspace')
    if (ui && typeof ui.archiveSession === 'function') {
      Promise.resolve()
        .then(() => ui.archiveSession(sid))
        .catch((e) => this.log(archiveFailureText(e)))
      return true
    }
    if (typeof fetch === 'function') {
      // 退路也要看响应：以前只 catch 网络异常，宿主路由返回 4xx/5xx 时连一行日志都没有。
      fetch('/omkb/archive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sid })
      }).then(
        (res) => { if (res && res.ok === false) this.log(`归档失败：宿主路由 /omkb/archive 返回 ${res.status}`) },
        (e) => this.log(`归档失败：宿主路由 /omkb/archive 不可达（${(e && e.message) || e}）`)
      )
      return true
    }
    this.log('拿不到归档入口：既没有 uiWorkspace 服务，也不在浏览器环境里')
    return false
  }

  /**
   * 分叉当前会话（用户要的 FORK 键）：从当前这条复制出一条新的分支会话，原会话保留。
   * ① `uiWorkspace.forkSession` —— DSH 会话菜单里「分叉会话」走的正是它（内部是
   *    `sessions.fork({ sessionId, increaseTitle: true })` + 打开子会话）。
   * ② 退路：没有 uiWorkspace 时自己走那两步（sessions.fork + 打开子会话）。
   *    打开子会话同样认官方入口 `uiWorkspace.openSession` —— `sessions.open` 在
   *    0.1.7-rc.2 已被删（见 agents.js openSlot 的注释），别再只认它。
   * @returns {boolean} 是否真的派发出去。
   */
  fork = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.log('当前没有会话，无法分叉'); return false }
    const ui = this.#service('uiWorkspace')
    if (ui && typeof ui.forkSession === 'function') {
      Promise.resolve()
        .then(() => ui.forkSession(sid))
        .catch((e) => this.log(`分叉失败：${(e && e.message) || e}`))
      return true
    }
    const sessions = this.sessions
    if (sessions && typeof sessions.fork === 'function') {
      // increaseTitle: 子会话标题自增（与 DSH 会话菜单里那一条保持一致）
      Promise.resolve()
        .then(() => sessions.fork({ sessionId: sid, increaseTitle: true }))
        .then((childId) => {
          if (!childId) return
          const openSession = (ui && typeof ui.openSession === 'function')
            ? (id) => ui.openSession(id)
            : (typeof sessions.open === 'function' ? (id) => sessions.open(id) : null)
          if (!openSession) { this.log(`分叉出的子会话没能打开（没有 uiWorkspace.openSession）：${childId}`); return }
          openSession(childId)
        })
        .catch((e) => this.log(`分叉失败：${(e && e.message) || e}`))
      return true
    }
    this.log('拿不到分叉入口：既没有 uiWorkspace.forkSession，sessions 也没有 fork')
    return false
  }

  // ---------------- 布局 ----------------

  /** 切换侧边栏：优先 layout 服务（官方跨插件面），服务缺失时退回点界面上的开关按钮。 */
  toggleSidebar = () => {
    const layout = this.#service('layout')
    if (layout && typeof layout.toggleSidebar === 'function') {
      try { layout.toggleSidebar(); return true } catch (e) {
        this.log(`layout.toggleSidebar 异常：${(e && e.message) || e}`)
      }
    }
    const el = sidebarToggleEl()
    if (el) { try { el.click(); return true } catch (e) {} }
    this.log('拿不到 layout 服务，界面上也找不到侧边栏开关，忽略')
    return false
  }

  // ---------------- 规划模式 ----------------

  /** 当前会话是否在规划模式（投影不可知时返回 null）。 */
  planActive = () => planActiveOf(this.sessions, this.currentSessionId())

  /**
   * 切换规划模式：读会话的 `plan` 投影决定方向，再走 /plan 命令通道。
   * 没有命令通道时只降级为「关掉已经开着的规划模式」（点 plan chip）——进入必须靠命令。
   */
  togglePlan = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.log('当前没有会话，无法切换规划模式'); return false }
    // 投影优先；投影还没到时用「chip 在不在 DOM 里」兜底（chip 只在开着时渲染）。
    let active = planActiveOf(this.sessions, sid)
    if (active === null && planChipEl()) active = true
    const line = active === true ? '/plan off' : '/plan'
    const commands = commandChannelOf(this.#services)
    if (commands && typeof commands.execute === 'function') {
      Promise.resolve()
        .then(() => commands.execute(sid, line, []))
        .then(
          (res) => {
            if (res && res.ok === false) {
              const err = res.error || {}
              this.log(`${line} 失败 ${err.code || ''} ${err.message || ''}`.trim())
            }
          },
          (e) => this.log(`${line} 调用异常：${(e && e.message) || e}`)
        )
      return true
    }
    const chip = planChipEl()
    if (chip) { try { chip.click(); return true } catch (e) {} }
    this.log('拿不到 /plan 命令通道，无法切换规划模式')
    return false
  }

  // ---------------- 对话滚动 ----------------

  /** 滚一步（dir < 0 向上）。 */
  scrollStep = (dir) => scrollStepDir(dir)

  /** 滚到当前对话底部。 */
  scrollToBottom = () => scrollToBottomDir()

  // ---------------- 输入区导航（自绘蓝环） ----------------

  /**
   * 转一步：把环移到下一个/上一个可聚焦控件上（跳过语音控件与文本输入框）。
   * 首次进入时从「当前环 → 当前聚焦元素 → 表头/表尾」依次找起点。
   * @returns {boolean} 是否找到了落脚点。
   */
  navStep = (dir) => {
    const d = dir >= 0 ? 1 : -1
    const list = focusCollect()
    if (!list.length) { this.#navIndex = -1; this.#navList = []; clearHighlight(); return false }
    let idx = list.indexOf(document.querySelector('[data-omkb-knob]'))
    if (idx === -1) idx = list.indexOf(document.activeElement)
    let next
    if (idx === -1) next = d >= 0 ? list[0] : list[list.length - 1]
    else next = list[(idx + d + list.length) % list.length]
    this.#navIndex = list.indexOf(next)
    this.#navList = list
    highlight(next)
    return true
  }

  /** 按下：激活环停着的那个控件（click + focus）。 */
  navActivate = () => {
    const list = this.#navList.length ? this.#navList : focusCollect()
    if (!list.length) return false
    let idx = this.#navIndex
    if (idx < 0 || idx >= list.length) idx = list.indexOf(document.querySelector('[data-omkb-knob]'))
    if (idx < 0) idx = 0
    const el = list[idx]
    if (!el) return false
    try { if (typeof el.click === 'function') el.click() } catch (e) {}
    try { el.focus() } catch (e) {}
    return true
  }

  // ---------------- 仅推理 ----------------

  /** 转一档：菜单关着时这一转只打开菜单并把环落在当前档（见 ./reasoning.js 的交互契约）。 */
  reasoningStep = (dir) => { reasoningStepDir(dir); return true }

  /** 按下：环在别的档 → 提交；环在当前档 → 只收菜单。 */
  reasoningPress = () => { reasoningPressOnce(); return true }
}
