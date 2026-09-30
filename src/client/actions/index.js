// dsh-micro · client/src/actions/index.js
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
//   index.js      ← 门面本体：把下面几份拼成一组动作（这个文件）
//   dom.js        ← DSH 界面结构的唯一一份理解（判据 / 定位 / 高亮 / 滚动 / 键盘兜底）
//   session.js    ← 会话与输入机（会话 id / 输入机 / plan 投影 / 命令通道 / 草稿拼接）
//   reasoning.js  ← 仅推理（等级菜单的定位与蓝环 —— 靠界面）
//   effort.js     ← 推理强度（等级列表与升/降一档 —— 靠服务，不打开菜单）
//
// 【管什么】全是「对 DSH 发出操作」：
//   会话 / 输入机   currentSessionId · input · send · undo · redo · writeDraft · clearInput
//   待确认交互      respond(approve|reject) → uiSession.pendingInteractions（审批 / 计划确认）；
//                   服务拿不到时退到面板上**按文案**点按钮（批准/允许/确认/下一步 · 拒绝/跳过）
//   会话动作        archive           → uiWorkspace.archiveSession（退：POST /micro/archive）
//                   fork              → uiWorkspace.forkSession（退：sessions.fork + open）
//                   newSession        → uiWorkspace.startSession（「新建」键）
//   附件            pickUpload        → 点输入栏里那个原生 file input（上传键；无服务面可用）
//   上下文          compact           → /compact 命令通道（「压缩」键）
//   Agent 预设      cycleAgentMode    → remote.agentPresets（「模式」键，原 FAST）
//   布局            toggleSidebar     → ctx.layout（跨插件服务面）
//   面板与视图      openPlugins       → ctx.layout.selectPanel('plugins')
//                   openTerminal      → ctx.sidebarRight.openTab('terminal')
//                   openTrajectory    → ctx.uiConversation.binding(sid).activate('trajectory')
//                   openFolder        → ctx.remote.session.openWorkspacePath({ path: cwd })
//   本插件设置页    openSettings      → components/sidebar/action.jsx 的深链（**长按旋钮**绑的就是它）
//   DSH 通用设置    openGeneralSettings → 同一份深链的另一个落点（导航第一项「通用」）
//   规划模式        planActive / togglePlan → 会话的 plan 投影 + /plan 命令通道
//   对话滚动        scrollStep / scrollToBottom → 当前会话的消息列表
//   输入区导航      navStep / navActivate → 自绘蓝环在可聚焦控件间移动（跳过文本输入框与语音控件）
//   仅推理          reasoningStep / reasoningPress → 转动移环、按下确认（**靠界面**，旋钮那条）
//   推理±（直接加减）reasoningAdjust → ctx.modelDirectories → directory.select（**不开菜单**，见 effort.js）
//   输入框兜底      pressEnter（服务都拿不到时的最后一条路）
//
// ⚠ 所有「打开某个官方界面」的入口（终端 / 插件页 / 轨迹 / 文件夹 / 上传）都是**可选服务**：
//   DSH 的插件是按需装的，注册在页面上的服务面拿不到就说拿不到（**一律记一行日志**，见各自的
//   「拿不到…」分支）—— 静默 false = 按下去没反应且查不出，这是本项目最贵的一条纪律。
//
// 【2026-09-28 补：出声的两条腿】日志只解决「查得出」，不解决「看得见」——正式版日志只写
//   `$DSH_HOME/logs/dsh-micro.log`，用户那一侧仍然是静音的。所以「没派出去」的那些分支改成
//   `#deny(reason, logText)`：**照旧记一行日志**，同时把「为什么没做成」记进本实例的
//   `#lastDeny`（`lastDeny()` 读它）。谁把它显示出来由**调用方**决定 —— 今天只有按键分派
//   （keypad.js 的 #refuse，且只对动作键 ACT06..ACT12 发顶部提示，见 client/notice.js）。
//   为什么不在这里直接弹提示：门面不知道「是谁在按」，而用户的口径是「只做 act06-12 按键」。
//
//   ⚠ 只记**同步就拦下来**的那些（没入口 / 没会话 / 闸门没开 / 面板上没按钮）。
//     派出去之后被**宿主拒绝**的（归档被拒、/compact 被拒、openWorkspacePath 失败…）仍然只记日志：
//     那种情况 DSH 自己会弹它自己的通知（见下面 archive 的注释），我们再说一句就是重复。
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
// （控制台可直接 `__dshMicro.services.ops.togglePlan()` 手验）。

import {
  focusCollect, highlight, clearHighlight, planChipEl, sidebarToggleEl,
  scrollStepDir, scrollToBottomDir, dispatchEnter, dispatchUndoChord,
  interactionPanelButtons, pickPanelButton, clickComposerFileInput
} from './dom.js'
import { reasoningStepDir, reasoningPressOnce } from './reasoning.js'
import {
  effortStepOf, effortChoicesOf, effortBaseOf, effortEffectiveOf, effortIndexOf, modelReasoningOf
} from './effort.js'
import {
  planActiveOf, currentSessionIdOf, inputOf, commandChannelOf, formatDraft,
  pendingInteractionOf, answerFor, archiveFailureText,
  sessionCwdOf, agentPresetStateOf, agentPresetsChannelOf, nextPresetOf
} from './session.js'

// 子模块的导出原样转发：「DSH 操作的零件」从 actions/index.js 一个入口就能拿到。
export * from './dom.js'
export * from './session.js'
export * from './reasoning.js'
export * from './effort.js'
// 功能总表也从这个入口转发：控制台/自检/三个控制器都只需认 actions/index.js 一条路
// （`__dshMicro.actions.run('fork')` 手验任意功能，不必真按设备）。
// 第三方插件依赖清单**不在**这里：它是配置，住在 config/default.js 的 PLUGIN_DEPS。
export * from './registry.js'

export class DshOps {
  /** ctx.sessions（会话快照 / 投影）。 */
  sessions = null
  /** ctx 上的 conversation 服务（composer 输入机的入口）。 */
  conversation = null
  #services = () => undefined
  #log = null
  /** 「打开本插件设置页」的入口（entry.js 注入，见 openSettings）。 */
  #openSettings = null
  /** 「打开 DSH 通用设置」的入口（entry.js 注入，见 openGeneralSettings）。 */
  #openGeneralSettings = null
  /** composer 的输入动作（由对话输入区槽位组件在挂载时交给我们，见 bindComposer）。 */
  #composer = null
  /** 输入区导航的当前位置（环停在第几个候选上）。 */
  #navIndex = -1
  #navList = []
  /** 最近一次同步拦下来的失败：`{ reason, at }`（见 #deny / lastDeny）。 */
  #lastDeny = null

  /**
   * @param options.sessions - ctx.sessions。
   * @param options.conversation - conversation 服务（拿 composer 输入机）。
   * @param options.services - (name) => service，取 ctx 上的跨插件服务（layout / remote.commands）。
   *                            别的客户端插件晚于本插件加载，所以取值必须延后到调用那一刻。
   * @param options.log - 记一行日志（默认 console.log 加 `[micro] ` 前缀）。
   */
  constructor(options = {}) {
    const o = options || {}
    this.sessions = o.sessions || null
    this.conversation = o.conversation || null
    this.#services = typeof o.services === 'function' ? o.services : (() => undefined)
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[micro] ' + msg) } catch (e) {} }
    // 「打开本插件设置页」的深链实现在 components/sidebar/action.jsx（候选标题、点击顺序都在那儿）。
    // **只能注入**：本文件 import 那个 JSX 模块会形成循环（action.jsx 也要读这边的门面），
    // 而且 Node 侧自检进不去 JSX（见技能 §2）。拿不到注入时 openSettings 如实返回 false。
    this.#openSettings = typeof o.openSettings === 'function' ? o.openSettings : null
    // 「通用设置」与上面同源同形（action.jsx 里同一个 openSection），只是目标分区不同 —— 一并注入。
    // 两个入口各自判断「有没有注入」，不共用：少注入一个只该让那一颗键如实报 false。
    this.#openGeneralSettings = typeof o.openGeneralSettings === 'function' ? o.openGeneralSettings : null
  }

  log = (msg) => { this.#log(msg) }
  #service = (name) => { try { return this.#services(name) } catch (e) { return undefined } }

  /**
   * 「这次没派出去，因为 …」——同步拦截点统一走它：**记一行日志**（照旧，查得出）
   * + 把原因记进 `#lastDeny`（看得见，由调用方决定显示到哪儿）。
   *
   * 为什么用「记下来」而不是「直接弹提示」：门面不知道是谁在按（按键 / 旋钮 / 摇杆 / 控制台），
   * 而用户的口径是「只做 act06-12 按键」——那是个**键码级**的判断，只有分派层（keypad.js）够得着。
   * 于是这里只负责「说出理由」，`lastDeny()` 让分派层紧接着读一次（见 keypad.js 的 #refuse）。
   * @param {string} reason - notice.js 的 NOTICE_REASON 里的 id。
   * @param {string} logText - 那一行日志（照旧是给人查的，比提示长）。
   */
  #deny = (reason, logText) => {
    this.log(logText)
    try { this.#lastDeny = { reason, at: Date.now() } } catch (e) {}
  }

  /**
   * 最近一次「当前页面不能执行」的原因 —— `{ reason, at }`；从没失败过时 null。
   *
   * ⚠ **必须按对象身份比对**（分派层就是拿调用前后两次引用比「这次有没有新记一条」），
   * 所以每次 #deny 都新造一个对象，不要就地改字段。时间戳只是给人看的。
   */
  lastDeny = () => this.#lastDeny

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

  /**
   * 清空当前输入框（「删除」键）—— **只动草稿，不碰已经发出去的消息**。
   *
   * 与 writeDraft 同一条取值链，只是写的是空串：composer 输入动作（槽位交给我们的那套，
   * 实机走它）优先 → 输入机自己的 `setDraft`。两条都没有就**出声**（不静默）：
   * 这条链路一旦断了，用户看到的是「按了删除、字还在」。
   *
   * ⚠ 走 setDraft 而不是直接改 DOM：composer 是 React 受控的，手改 textarea.value 只会让
   * 显示与状态分家（下一次渲染又变回来）。
   * @returns {boolean} 是否真的清掉了。
   */
  clearInput = () => {
    const composer = this.#composer
    if (composer && typeof composer.setDraft === 'function') {
      try { composer.setDraft(''); return true } catch (e) {}
    }
    const input = this.input()
    if (input && typeof input.setDraft === 'function') {
      try { input.setDraft(''); return true } catch (e) {}
    }
    this.#deny('noInput', '清空输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft')
    return false
  }

  /**
   * 上传文件（「上传」键）：点一下输入栏里那个原生文件选择框，等同 DSH 输入框左下角
   * 「+ → 文件」。之后**上传、挂附件、进度全归 DSH 自己管**（我们只负责把框叫出来）。
   *
   * 为什么只能点 DOM：conversation 输入机上只有 `addAttachments(ids)`（收的是已经上传完的
   * 附件 id），「弹选择框 + 上传」这一段没有对外服务面（见 ./dom.js 的 composerFileInput）。
   * @returns {boolean} 是否真的点到了那个输入框。
   */
  pickUpload = () => {
    if (clickComposerFileInput()) return true
    this.#deny('noUpload', '上传失败：输入栏里那个原生文件选择框找不到（当前不是可输入附件的会话，或 DSH 改了输入栏结构）')
    return false
  }

  // ---------------- 待确认交互（批准 / 拒绝两颗键） ----------------

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
        // 提问（question）要逐题作答（可多选/可自定义），这两颗键不该替用户编答案 ——
        // 说清楚**该按哪个**（用户要的「有选项就转旋钮选、按下勾」）。
        this.#deny('panelOptions',
          `待确认交互是「${pending.kind || '?'}」：它要逐项作答，${approve ? '批准' : '拒绝'}键不替你选 —— 转旋钮选、按旋钮勾`)
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
   *
   * 挑哪个按钮**先按文案**（「批准为批准或者下一步，拒绝为跳过」），文案认不出来才退回位置
   * （界面顺序恒为「否定在左、肯定在右」）。判据本体在 ./dom.js 的 pickPanelButton，
   * 面板怎么认（属性 → 文案成对）见同文件的 interactionPanelRoot。
   *
   * 只在服务拿不到时走这条路 —— 优先永远是 `pending.answer()`。
   */
  #answerOnPanel = (approve) => {
    const btns = interactionPanelButtons()
    if (!btns.length) {
      this.#deny('noPanel', `${approve ? '批准' : '拒绝'}失败：当前会话没有待确认的交互，也没在界面上找到审批 / 计划确认面板` +
        '（若弹窗里只有**选项**，那要用旋钮：转着选、按下勾）')
      return false
    }
    const el = pickPanelButton(btns, approve)
    if (!el) {
      this.#deny('noButton', `${approve ? '批准' : '拒绝'}失败：面板上找不到可点的按钮`)
      return false
    }
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
    this.#deny('noInput', '写回输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft')
    return false
  }

  // ---------------- 会话动作（归档 / 分叉 / 新建） ----------------

  /**
   * 归档当前会话。
   * ① 官方客户端服务 `uiWorkspace.archiveSession` —— DSH 侧边栏里那个「归档」动作走的就是它
   *    （会同时处理「归档的正好是当前会话 → 清掉当前选择」）。
   * ② 退路：宿主旁路路由 POST /micro/archive（宿主 workspaceRegistry.archiveSession；见 src/core/index.js）。
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
    if (!sid) { this.#deny('noSession', '归档失败：认不出当前会话（快照里既没有 current，也没有被主视图持有的那条）'); return false }
    const ui = this.#service('uiWorkspace')
    if (ui && typeof ui.archiveSession === 'function') {
      Promise.resolve()
        .then(() => ui.archiveSession(sid))
        .catch((e) => this.log(archiveFailureText(e)))
      return true
    }
    if (typeof fetch === 'function') {
      // 退路也要看响应：以前只 catch 网络异常，宿主路由返回 4xx/5xx 时连一行日志都没有。
      fetch('/micro/archive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sid })
      }).then(
        (res) => { if (res && res.ok === false) this.log(`归档失败：宿主路由 /micro/archive 返回 ${res.status}`) },
        (e) => this.log(`归档失败：宿主路由 /micro/archive 不可达（${(e && e.message) || e}）`)
      )
      return true
    }
    this.#deny('noService', '拿不到归档入口：既没有 uiWorkspace 服务，也不在浏览器环境里')
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
    if (!sid) { this.#deny('noSession', '当前没有会话，无法分叉'); return false }
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
    this.#deny('noService', '拿不到分叉入口：既没有 uiWorkspace.forkSession，sessions 也没有 fork')
    return false
  }

  /**
   * 新建一个对话（「新建」键）。
   * 入口 = `uiWorkspace.startSession()`：官方契约是「Start a New Session flow and navigate to
   * its Session」，**不传 workspaceId 就继承当前（或最近用过的）工作区** —— 正是用户要的
   * 「在现在这个项目里开一条新的聊天」。宿主拒绝创建时会自己弹 Workspace 通知，并且**不动当前选择**，
   * 所以这里不额外兜底（我们没法比宿主说得更清楚）。
   *
   * 为什么不用 `connectWorkspace(workspaceId)`：它要一个 workspaceId，而「当前工作区 id」在
   * 会话快照上**没有稳定读法**（只有 cwd，不是 workspace 标识）；硬猜一个 id 传进去只会更脆弱。
   * @returns {boolean} 是否真的派发出去。
   */
  newSession = () => {
    const ui = this.#service('uiWorkspace')
    if (ui && typeof ui.startSession === 'function') {
      try { ui.startSession(); return true } catch (e) {
        this.log(`新建会话失败：${(e && e.message) || e}`)
        return false
      }
    }
    this.#deny('noService', '拿不到新建会话入口（ctx.uiWorkspace.startSession），忽略')
    return false
  }

  /**
   * 压缩当前会话的上下文（「压缩」键）—— 走 DSH 自己的 `/compact` 命令
   * （人类可读命令，定义在 dsh-command-compact：`name: "compact"`、不带参数）。
   * 复用 /plan 那条命令通道（commandChannelOf，两个服务名都试）。
   * 宿主会在「正在压缩中 / 智能体不空闲 / 没有可压缩的历史」时拒绝，这些都带 message，如实转述。
   * @returns {boolean} 是否真的派发出去。
   */
  compact = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.#deny('noSession', '压缩失败：认不出当前会话'); return false }
    const commands = commandChannelOf(this.#services)
    if (commands && typeof commands.execute === 'function') {
      Promise.resolve()
        .then(() => commands.execute(sid, '/compact', []))
        .then(
          (res) => {
            if (res && res.ok === false) {
              const err = res.error || {}
              this.log(`压缩失败 ${err.code || ''} ${err.message || ''}`.trim())
            }
          },
          (e) => this.log(`压缩调用异常：${(e && e.message) || e}`)
        )
      return true
    }
    this.#deny('noService', '拿不到 /compact 命令通道（ctx.remote.commands），无法压缩')
    return false
  }

  // ---------------- Agent 模式（预设循环） ----------------

  /**
   * 切换 Agent 模式（「模式」键，原来的 FAST/「保留」那一格）—— 在 Agent 预设之间循环。
   *
   * 三步，顺序不能反：
   *   ① 读当前会话绑定的预设（**会话列表快照那一行的** `projectionValues.agentPreset`）
   *      与 blank 标志（同一行的 `blank`）—— 见 session.js 的 agentPresetStateOf；
   *   ② 拿清单 `remote.agentPresets.list()` → 按环形规则算下一个（nextPresetOf，只挑没坏掉的）；
   *   ③ `remote.agentPresets.select(sid, nextId)`。
   *   ⚠ ①里那两个字段**不在** `binding.session` 上（那是个 ObservableSnapshot 源对象，只有
   *     `projections` 与 `getSnapshot()`）：2026-09-28 读错过一次，preset 恒为 null →
   *     每按一次都在算「清单第 0 个」→ 用户看到的是「模式键按了不换」（2026-09-29 修）。
   *
   * ⚠ **官方只允许在还没开跑的空会话（blank）上换预设**（select 对非 blank 会话直接不提交，
   *   见 dsh-client-ui-agent-preset 的 apply）。这一条必须**出声**：静默丢弃就是「按了没反应」。
   *   blank 读不到（null）时不挡 —— 乐观发一次，宿主拒绝的话它的 reason 会告诉我们。
   * @returns {boolean} 是否真的派发出去（清单取得晚，成功与否看日志）。
   */
  cycleAgentMode = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.#deny('noSession', '切换 Agent 模式失败：认不出当前会话'); return false }
    const state = agentPresetStateOf(this.sessions, sid)
    if (state.blank === false) {
      this.#deny('sessionBusy', '切换 Agent 模式失败：这条会话已经开始跑了，DSH 不允许再换预设（新开一条会话再换）')
      return false
    }
    const channel = agentPresetsChannelOf(this.#services)
    if (!channel || typeof channel.select !== 'function') {
      this.#deny('noService', '拿不到 Agent 预设入口（ctx.remote.agentPresets），忽略')
      return false
    }
    Promise.resolve()
      .then(() => channel.list())
      .then((res) => {
        if (!res || res.ok === false) {
          const err = (res && res.error) || {}
          this.log(`切换 Agent 模式失败：取预设清单被拒 ${err.code || ''} ${err.message || ''}`.trim())
          return undefined
        }
        const presets = (res.value && res.value.presets) || []
        const next = nextPresetOf(presets, state.preset)
        if (!next) {
          this.log(`切换 Agent 模式：可用预设不足两个（当前 ${state.preset || '未知'}），没有可切换的对象`)
          return undefined
        }
        return Promise.resolve(channel.select(sid, next.id)).then((r) => {
          if (r && r.ok === false) {
            const err = r.error || {}
            const details = err.details || {}
            const reason = typeof details.reason === 'string' ? details.reason : err.message
            this.log(`切换 Agent 模式到「${this.#presetName(next)}」被拒：${reason || '未知原因'}`)
          }
        })
      })
      .catch((e) => this.log(`切换 Agent 模式失败：${(e && e.message) || e}`))
    return true
  }

  /** 「预设名（id）」用于日志：名字优先，退到 id。 */
  #presetName = (preset) => String((preset && (preset.name || preset.id)) || '?')

  /**
   * 「模式」键的**只读诊断**：这一步按下去会发生什么，先问它。
   *
   * 为什么需要它：2026-09-29 用户报「模式键按了不换」——那种「按一下没反应」的事，
   * 光看界面分不清是「没读对当前预设」「清单是空的」「会话开跑了」还是「宿主拒绝」。
   * 这里把四个答案一次说清，而且**判据与 cycleAgentMode 同源**（同一对纯函数：
   * agentPresetStateOf / nextPresetOf），不另写一份「看起来一样」的逻辑。
   *
   * 控制台也能直接问：`await __dshMicro.services.ops.modeInfo()`；
   * 真机探针 npm run probe:mode 走的就是它（探针**不按键** —— ACT06 会真的换掉当前会话的预设）。
   * @returns {Promise<object>} { sessionId, preset, blank, hasChannel, failure, presets, next }
   *   preset/blank 为 null = 读不到；failure = 取清单被拒的原因；next = 下一个预设 id。
   */
  modeInfo = async () => {
    const sessionId = this.currentSessionId()
    const { preset, blank } = agentPresetStateOf(this.sessions, sessionId)
    const channel = agentPresetsChannelOf(this.#services)
    let rows = null
    let failure = null
    if (channel && typeof channel.list === 'function') {
      try {
        const res = await channel.list()
        if (res && res.ok === false) {
          const err = res.error || {}
          failure = String([err.code, err.message].filter(Boolean).join(' ')) || '被拒绝（没给原因）'
        } else {
          rows = ((res && res.value && res.value.presets) || [])
            .map((p) => ({
              id: p.id,
              name: p.name || null,
              isDefault: p.isDefault === true,
              broken: p.broken || null
            }))
        }
      } catch (e) { failure = String((e && e.message) || e) }
    }
    const next = rows ? nextPresetOf(rows, preset) : null
    return {
      sessionId,
      preset,
      blank,
      hasChannel: !!channel,
      failure,
      presets: rows,
      next: next ? next.id : null
    }
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
    this.#deny('notAvailable', '拿不到 layout 服务，界面上也找不到侧边栏开关，忽略')
    return false
  }

  /**
   * 打开本插件自己的设置页 —— **长按旋钮**的固定手势（见 registry 的 open_settings）。
   *
   * DSH 没给「打开某个设置分区」的接口（展开态与当前分区住在官方组件的内部 state，插件拿不到），
   * 所以真正的深链只能「点设置按钮 → 等导航渲染 → 点掉文字等于本分区标题的那一行」——
   * 那套判据在 components/sidebar/action.jsx 的 openKeyboardSettings，由 entry.js 注入到这里。
   * 好处是「设置页里那个按钮」和「长按旋钮」走的是**同一条**链路，不会一处能开一处打不开。
   *
   * 它是**异步**的（轮询等导航行，预算 ~1.2s）：这里只把「已经派出去」当成功 ——
   * 落空由那条链路自己 console.warn（我们不重复记一条，否则一次失败刷两行日志）。
   * @returns {boolean} 这次打开有没有真的派出去（拿不到注入 → false）。
   */
  openSettings = () => {
    if (!this.#openSettings) {
      this.#deny('notAvailable', '拿不到「打开设置页」的入口（entry.js 没注入 openSettings），忽略')
      return false
    }
    try {
      const r = this.#openSettings()
      if (r && typeof r.then === 'function') r.catch(() => {})
      return true
    } catch (e) {
      this.log(`打开键盘设置页失败：${(e && e.message) || e}`)
      return false
    }
  }

  /**
   * 打开 DSH 自己的**通用设置**页（键帽上那颗齿轮「设置」）。
   *
   * 与 openSettings 是**同一份深链实现**（action.jsx 的 openSection）：唯一的差别是目标分区 ——
   * 那边落到本插件分区（候选来自词典的 `nav`），这边落到导航第一项「通用」。
   * 所以两处的降级路径也一致：拿不到触发按钮 / 等不到导航行都在那条链路上 warn，这里不重复记。
   * @returns {boolean} 这次打开有没有真的派出去（拿不到注入 → false）。
   */
  openGeneralSettings = () => {
    if (!this.#openGeneralSettings) {
      this.#deny('notAvailable', '拿不到「打开通用设置」的入口（entry.js 没注入 openGeneralSettings），忽略')
      return false
    }
    try {
      const r = this.#openGeneralSettings()
      if (r && typeof r.then === 'function') r.catch(() => {})
      return true
    } catch (e) {
      this.log(`打开通用设置失败：${(e && e.message) || e}`)
      return false
    }
  }

  // ---------------- 官方面板与视图（终端 / 插件 / 轨迹 / 文件夹） ----------------
  //
  // 这四件与上面的 toggleSidebar 同源：都是「让 DSH 自己把某个界面打开」，我们只负责按对那个入口。
  // 它们是**可选服务**（对应插件没装 / 服务没注册时拿不到）→ 一律如实出声，见各自的「拿不到…」分支。

  /**
   * 在右侧栏打开一个终端（「终端」键）。
   * 入口 = `ctx.sidebarRight.openTab('terminal')` —— DSH 自己那个「新建终端」走的就是它；
   * kind `"terminal"` 由 dsh-client-ui-sidebar-terminal 注册
   * （`sidebarRightTabs.register({ kind: 'terminal', multiple: true })`）。
   * 不指定 paneId：空着就落在当前活跃格，正是「点一下开一个终端」该有的位置。
   * @returns {boolean} 是否真的派发出去。
   */
  openTerminal = () => {
    const bar = this.#service('sidebarRight')
    if (bar && typeof bar.openTab === 'function') {
      try { bar.openTab('terminal'); return true } catch (e) {
        this.log(`打开终端失败：${(e && e.message) || e}`)
        return false
      }
    }
    this.#deny('noService', '拿不到终端入口（ctx.sidebarRight.openTab 不存在，或终端插件没装），忽略')
    return false
  }

  /**
   * 打开 DSH 的插件管理页（「插件」键）—— 中央主面板。
   * 入口 = `ctx.layout.selectPanel('plugins')`：面板 id 就是 dsh-client-ui-plugin-manager 自己
   * 注册的 `PANEL_ID = "plugins"`，它自己的侧边栏入口也调这一条。`null` 表示回到对话
   * （这里传的是 id，所以是「切到插件页」）。
   * @returns {boolean} 是否真的派发出去。
   */
  openPlugins = () => {
    const layout = this.#service('layout')
    if (layout && typeof layout.selectPanel === 'function') {
      try { layout.selectPanel('plugins'); return true } catch (e) {
        this.log(`打开插件管理页失败：${(e && e.message) || e}`)
        return false
      }
    }
    this.#deny('noService', '拿不到中央面板入口（ctx.layout.selectPanel），忽略')
    return false
  }

  /**
   * 把当前对话切到「轨迹」视图（「轨迹」键）—— 事件时间线。
   * 入口 = `ctx.uiConversation.binding(sid).activate('trajectory')`；视图 id 就是
   * dsh-client-ui-trajectory 注册的 `target: "trajectory"`。
   *
   * ⚠ **这个视图有道闸门**：ui-conversation 的 viewTabs() 里写着
   *   `if (!ctx.configForms.developerTools.enabled.getSnapshot() && entry.options.id === 'trajectory') continue`
   * —— 没开「代码工作工具」时那个标签**压根不存在**，`activate()` 于是静默什么都不发生。
   * 所以这里先看闸门，没开就**出声**（不假装切过去了）；闸门读不到时按「开着」放行，让 activate 去撞。
   * @returns {boolean} 是否真的切了。
   */
  openTrajectory = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.#deny('noSession', '切换轨迹视图失败：认不出当前会话'); return false }
    if (!this.#developerToolsEnabled()) {
      this.#deny('gateOff', '切换轨迹视图失败：DSH 设置里没有开启「代码工作工具」，轨迹标签不存在（开启后再按）')
      return false
    }
    const conv = this.#service('uiConversation')
    if (conv && typeof conv.binding === 'function') {
      try {
        const binding = conv.binding(sid)
        if (binding && typeof binding.activate === 'function') { binding.activate('trajectory'); return true }
      } catch (e) {
        this.log(`切换轨迹视图失败：${(e && e.message) || e}`)
        return false
      }
    }
    this.#deny('noService', '拿不到轨迹视图入口（ctx.uiConversation.binding(sid).activate），忽略')
    return false
  }

  /** 「代码工作工具」开着没（轨迹视图的闸门）。读不到时返回 true —— 让 activate 自己撞一次，比误拦好。 */
  #developerToolsEnabled = () => {
    try {
      const forms = this.#service('configForms')
      const gate = forms && forms.developerTools && forms.developerTools.enabled
      if (gate && typeof gate.getSnapshot === 'function') return gate.getSnapshot() !== false
    } catch (e) {}
    return true
  }

  /**
   * 在系统的文件管理器里打开当前会话的项目文件夹（「文件夹」键）。
   * 入口 = `ctx.remote.session.openWorkspacePath({ path })` —— dsh-client-ui-open-in-app 的
   * 「打开位置」走的就是它。**请求形状照抄它**：`action` 只有 `'reveal'` 一个值（在文件夹里
   * 选中该路径），省略 `action` 才是「用系统默认程序打开」；`signal` 那个参数官方自己也没传。
   * 路径取会话快照行上的 `cwd`（sessionCwdOf）—— 拿不到就出声，不去猜。
   * @returns {boolean} 是否真的派发出去。
   */
  openFolder = () => {
    const sid = this.currentSessionId()
    if (!sid) { this.#deny('noSession', '打开项目文件夹失败：认不出当前会话'); return false }
    const cwd = sessionCwdOf(this.sessions, sid)
    if (!cwd) { this.#deny('noCwd', '打开项目文件夹失败：这条会话没有记录项目目录（cwd）'); return false }
    const remote = this.#service('remote')
    const session = remote && remote.session
    if (session && typeof session.openWorkspacePath === 'function') {
      Promise.resolve()
        .then(() => session.openWorkspacePath({ path: cwd }))
        .then(
          (res) => { if (res && res.ok === false) this.log(`打开项目文件夹失败：宿主没能打开 ${cwd}`) },
          (e) => this.log(`打开项目文件夹失败：${(e && e.message) || e}`)
        )
      return true
    }
    this.#deny('noService', '拿不到「打开位置」入口（ctx.remote.session.openWorkspacePath），忽略')
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
    if (!sid) { this.#deny('noSession', '当前没有会话，无法切换规划模式'); return false }
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
    this.#deny('noService', '拿不到 /plan 命令通道，无法切换规划模式')
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
    let idx = list.indexOf(document.querySelector('[data-micro-knob]'))
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
    if (idx < 0 || idx >= list.length) idx = list.indexOf(document.querySelector('[data-micro-knob]'))
    if (idx < 0) idx = 0
    const el = list[idx]
    if (!el) return false
    try { if (typeof el.click === 'function') el.click() } catch (e) {}
    try { el.focus() } catch (e) {}
    return true
  }

  // ---------------- 推理：等级菜单（仅推理）／直接加减（推理±） ----------------
  //
  // 同一条「推理强度」的两条实现，**谁都不许替谁做决定**：
  //   reasoningStep / reasoningPress —— 靠界面：打开「模型 / 推理等级」菜单，环上/下移一档、按下确认。
  //                                    旋钮的「仅推理」模式走这条（用户要的就是「能看着选」）。
  //   reasoningAdjust              —— 靠服务：直接读目录、算下一档、select 落一次，**不开菜单**
  //                                    （「推理+ / 推理-」两颗键，用户 2026-09-29 的口径）。
  // 判据（等级列表 / 当前档 / 能不能再加）只有一份，在 ./effort.js；这里只负责「取服务 + 出声」。

  /** 转一档：菜单关着时这一转只打开菜单并把环落在当前档（见 ./reasoning.js 的交互契约）。 */
  reasoningStep = (dir) => { reasoningStepDir(dir); return true }

  /** 按下：环在别的档 → 提交；环在当前档 → 只收菜单。 */
  reasoningPress = () => { reasoningPressOnce(); return true }

  /**
   * 推理强度直接升/降一档（「推理+ / 推理-」两颗键）—— **不打开等级菜单**。
   *
   * 用户 2026-09-29 的原话：「如果当前会话使用的模型可以选择推理强度, 不用打开选项, 直接加减,
   * 没有就提示不可用」。所以这条路只碰**服务**（`ctx.modelDirectories`），一个 DOM 都不摸：
   *   ① `directoryFor(sid)` 拿这条会话的模型目录（官方 `ModelSelect` 组件读的就是它，
   *      「/model 弹窗」与输入框那颗模型按钮共享同一份状态，所以这里改完，界面上的档位标签
   *      会自己跟着变）；
   *   ② 读它的**快照**（`store.getSnapshot()`）→ 交给 ./effort.js 的 effortStepOf 算下一档；
   *   ③ `directory.select({ provider, model, reasoningEffort? })` 落一次。
   *
   * **同步判定、异步落盘**，这一点是本方法的关键（也是为什么快照读不到时宁可拒绝）：
   * 「这颗键在当前页面做不了」的顶部提示是**同步**发出的（keypad.js 的 #refuse 在调用后立刻读
   * `lastDeny()`），所以能不能做必须在**返回之前**就知道。若把判定也塞进 Promise，失败就只能
   * 记日志 —— 用户那边又是「按了没反应」。因此：算不出下一档就当场 `#deny` 返回 false；
   * 只要派发出去了就返回 true，之后被宿主拒绝的（session/writer-held 之类）**只记日志**
   * （与本文件其它动作同一条规矩：派出去之后被拒的，DSH 自己会说话）。
   *
   * 出声的三种情况（都由分派层显示，见 notice.js）：
   *   `noReasoning`   这个模型没有可调的档（DSH 菜单里同样写着「当前模型未提供推理等级」）；
   *   `reasoningTop` / `reasoningBottom`  已经在最高/最低档（**不绕圈**，与蓝环的夹边一致）；
   *   `notAvailable`  连「当前用的是哪个模型」都读不到（目录还没加载完）——日志里写明是哪一种。
   * 走不下去的还有两种「拿不到入口」，各自有自己的原因 id：没有当前会话 → `noSession`，
   * 拿不到模型目录服务 → `noService`（model-selection 插件没装）。
   * @param {number} dir 正数 = 升一档，负数 = 降一档（只看符号）。
   * @returns {boolean} 是否真的把选择派发给了宿主（成功与否看日志 / `effortInfo()`）。
   */
  reasoningAdjust = (dir) => {
    const step = dir >= 0 ? 1 : -1
    const sid = this.currentSessionId()
    if (!sid) { this.#deny('noSession', '调整推理强度失败：认不出当前会话'); return false }
    const resolver = this.#service('modelDirectories')
    if (!resolver || typeof resolver.directoryFor !== 'function') {
      this.#deny('noService', '拿不到模型选择服务（ctx.modelDirectories），忽略')
      return false
    }
    let directory = null
    try { directory = resolver.directoryFor(sid) } catch (e) {
      // 会话没有 scope / binding 时官方那条路也会抛（`unknown sessions fail loud`）—— 如实报
      this.#deny('noService', `拿不到这条会话的模型目录：${(e && e.message) || e}`)
      return false
    }
    const store = directory ? directory.store : null
    if (!store || typeof store.getSnapshot !== 'function' || typeof directory.select !== 'function') {
      this.#deny('noService', '模型目录缺少快照或 select，忽略')
      return false
    }
    let state = null
    try { state = store.getSnapshot() } catch (e) { state = null }
    const plan = effortStepOf(state, step)
    if (!plan.ok) {
      if (plan.why === 'edgeTop') this.#deny('reasoningTop', '调整推理强度：已经在最高一档，忽略')
      else if (plan.why === 'edgeBottom') this.#deny('reasoningBottom', '调整推理强度：已经在最低一档，忽略')
      else if (plan.why === 'noReasoning') {
        this.#deny('noReasoning', `调整推理强度：当前模型没有可调的推理等级（${this.#routeName((state || {}).current)}）`)
      } else {
        // unknownModel：目录还没加载完（或这条会话没有绑定）→ 读不到「现在用的是哪个模型」
        this.#deny('notAvailable', `调整推理强度失败：读不到当前模型（目录还没加载好？status=${(state || {}).status}）`)
      }
      return false
    }
    const target = plan.target
    // ⚠ **同步**调 select（不是塞进 Promise.resolve().then）：`ModelDirectory.select()` 会在
    // 进第一个 await 之前就把 `pending` 写进快照 —— 于是**同一拍内**的第二次按键读快照时
    // 已经能看到第一次的目标，连按才真的累积（塞进微任务就来不及，两次会算出同一个目标）。
    // select 是 async 方法，抛错会变成 rejected promise（下面 catch），这里的 try 只是兜
    // 「实现不是 async 函数」那种意外。
    let pending = null
    try { pending = directory.select(target) } catch (e) {
      this.#deny('noService', `提交推理强度失败：${(e && e.message) || e}`)
      return false
    }
    Promise.resolve(pending)
      .then((r) => {
        if (r && r.ok === false) {
          const err = r.error || {}
          const reason = [err.code, err.message].filter(Boolean).join(' ') || '未知原因'
          this.log(`调整推理强度到「${plan.to.effort || '默认'}」被拒：${reason}`)
        }
      })
      .catch((e) => this.log(`调整推理强度失败：${(e && e.message) || e}`))
    return true
  }

  /** 「provider/model」用于日志（读不到时给一个明确说法的占位，不写 undefined）。 */
  #routeName = (selection) => {
    const p = selection && selection.provider
    const m = selection && selection.model
    return (typeof p === 'string' && p && typeof m === 'string' && m) ? `${p}/${m}` : '未知模型'
  }

  /**
   * 「推理±」的**只读诊断**：这颗键现在按下去会发生什么，先问它（同 `modeInfo` 的做法）。
   *
   * 为什么需要它：这台设备上的「按了没变化」有三种完全不同的来源 —— ①服务没装上；
   * ②目录里压根没有当前模型（还没加载完 / 这个部署没配）；③模型在、但它没有可调的档。
   * 光看界面分不清，而这两颗键**会真的改设置**（所以探针不该盲按）。
   *
   * 判据与 reasoningAdjust **同源**（同一对纯函数：effortBaseOf / effortStepOf），这里不许再算一遍。
   * 控制台：`await __dshMicro.services.ops.effortInfo()`；真机探针：`npm run probe:effort`。
   * ⚠ 唯一的副作用：`directoryFor()` 会像官方那条路一样给这条会话**惰性建**一个模型目录
   *   （DSH 自己的模型按钮挂载时也这么做），所以这是「官方入口同款」，不是我们另开门路。
   * @returns {Promise<object>} { sessionId, hasService, failure, status, current, pending, routable,
   *   reasoning, choices, index, effective, nextUp, nextDown } —— nextUp/nextDown 为
   *   `✗ <why>` 时表示按那颗键不会改档（why 见 effortStepOf）。
   */
  effortInfo = async () => {
    const sessionId = this.currentSessionId()
    const resolver = this.#service('modelDirectories')
    const out = {
      sessionId,
      hasService: !!(resolver && typeof resolver.directoryFor === 'function'),
      failure: null,
      status: null,
      current: null,
      pending: null,
      routable: null,
      reasoning: null,
      choices: [],
      index: -1,
      effective: null,
      nextUp: null,
      nextDown: null
    }
    if (!out.hasService) { out.failure = '拿不到 ctx.modelDirectories（model-selection 插件没装？）'; return out }
    if (!sessionId) { out.failure = '认不出当前会话'; return out }
    let directory = null
    try { directory = resolver.directoryFor(sessionId) } catch (e) {
      out.failure = `拿不到模型目录：${(e && e.message) || e}`
      return out
    }
    let state = null
    try { state = directory.store.getSnapshot() } catch (e) { state = null }
    if (!state) { out.failure = '目录快照读不出来'; return out }
    const base = effortBaseOf(state)
    const reasoning = modelReasoningOf(state, base)
    out.status = state.status
    out.current = state.current || null
    out.pending = state.pending || null
    out.routable = state.routable === undefined ? null : state.routable
    out.reasoning = reasoning
      ? { defaultEffort: reasoning.defaultEffort || null, efforts: (reasoning.efforts || []).map((e) => ({ id: e.id, name: e.name })) }
      : null
    // 下标的判据与门面同一份（effortEffectiveOf / effortIndexOf），且**用同一份 choices**
    const choices = effortChoicesOf(reasoning)
    const effective = effortEffectiveOf(base, reasoning)
    out.choices = choices.map((c) => ({ effort: c.effort === undefined ? null : c.effort, name: c.name }))
    out.effective = effective === undefined ? null : effective
    out.index = effortIndexOf(choices, effective)
    const brief = (p) => (p.ok ? (p.to.effort === undefined ? '（Provider 默认）' : p.to.effort) : `✗ ${p.why}`)
    out.nextUp = brief(effortStepOf(state, 1))
    out.nextDown = brief(effortStepOf(state, -1))
    return out
  }
}
