// dsh-micro · core/leds.js
// **灯态引擎** —— 「浏览器下发的期望灯态 + 宿主收到的结果态 ⇒ 实际写给设备的灯」。
// 从 ble.js 分拆出来：它是设备灯语（v.oai.rgbcfg / v.oai.thstatus）的**唯一出口**，
// 而「谁持有 HID 句柄」是 transport.js 的事 —— 本模块只会调 transport.writeRpc()。
//
// 分工：**浏览器**决定「哪个会话占哪颗键、平时什么颜色与状态」（它才知道会话列表），
// **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
// 也是唯一写 HID 的人）。浏览器下发的槽位带上会话 id（sid），宿主用它把事件定位到键。
//
// 三条主线（每条都带「一次只许发一条」的硬约束，**完整沿革与反证见技能 §2**）：
//   · **结果态**（失败转红 st=3 / 跑完一轮 st=2）**不会自己变回去**，直到该会话重新运行才收掉；
//   · **`st` 只报当前会话**（规则 1，见 `#currentSession`），判据压平在 `#stOfSlot` **只此一处**；
//     （「会话重新运行 → 6 槽 st 全空闲」的规则 2 自 2026-09-27 起停用，形态保留待恢复。）
//   · **三道防线**：① 同拍合并（`#pendingAgents`）② 跨拍内容去重（`#lastThstatus`）
//     ③ 结果态等浏览器那条（`#outcomeWindowMs`）。
//
// **进程要走了就把两组灯全部按灭**：设备会保留最后收到的灯效，不关就是「app 关了、键盘还亮着」。
// 两个落点：插件卸载（dispose）与**进程级退出**（Ctrl+C/SIGTERM/SIGHUP，见 ./guard.js 的 blackout
// 回调 —— 那条路常常等不到 dispose）。灭灯**必须同步写出去**，所以走 `#sendThstatus` 而不是合并
// 闸门（「exit」钩子里微任务根本不会跑）。
// ⚠ **断开连接（close）时刻意不灭灯** —— 断开随时会重连，在那里关灯只换来「重连之后黑一片」。

import { logSink } from './log.js'
import { AGENT_ST, AGENT_ST_DEFAULT, AGENT_ST_INBOUND, BLACKOUT_SLOTS } from './protocol.js'

export class LedEngine {
  #state = null
  #transport = null
  #logger
  #errorColor = 0xff0000 // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js
  /**
   * 「跑完一轮」的成功色（用户 2026-09-28）：**绿**。默认 0x00ff00，浏览器可用
   * `payload.successColor` 覆盖（与 #errorColor 同一套：调色板归客户端，宿主不另立一份）。
   *
   * ⚠ 与红灯的**三处不同**（别顺手对称过去）：
   *   ① 只给**当前会话**那一槽（用户原话「当前会话反馈成功状态后…」）—— 红灯不吃这道闸门；
   *   ② **不常驻** —— 亮 `#successHoldMs` 就到点回落成浏览器下发的空闲色（红灯要等到会话重新运行）；
   *   ③ 是**看得见的一帧**，所以它必须真的写出去（见 #latchOutcome 里 success 的 defer 口径）。
   */
  #successColor = 0x00ff00
  /**
   * 成功绿灯亮多久（毫秒）—— 到点自动回落到浏览器下发的期望色（用户 2026-09-28 选定「固定时长」，默认 3 秒）。
   *
   * `DSH_MICRO_SUCCESS_HOLD_MS` 覆盖；**0 = 关掉绿灯**（成功不再改色，回到这条改动之前的行为）。
   * 关掉这一档是给自检用的：那几套盯的是「一次只发一条 / st 只响一次」，与颜色无关，
   * 开着绿灯只会让每一处 success 断言多改一个色值。绿灯本身的行为在 verify_led_error 里单独验。
   */
  #successHoldMs = 3000
  /** 槽位下标 → 成功绿灯的回落定时器（见 `#successHoldMs`）。到点把该槽的 success 收掉再重画。 */
  #successTimers = new Map()

  /**
   * **弹窗覆盖色**（用户 2026-09-29）：界面上有弹窗时，把**当前会话**那颗键换成提醒色。
   *
   *   · `approval` —— 有「批准 / 拒绝」弹窗（审批 / 计划确认 / 多步确认）→ **琥珀黄**；
   *   · `menu`     —— 按下旋钮、或点输入框「+」招来的弹窗 → **玫粉**。
   *
   * ⚠ 与红灯 / 绿灯的关系（**三条都要记牢**）：
   *   ① **只给当前会话**那一槽 —— 判据与绿灯同一个（`#isCurrentSession`）；
   *   ② **优先于结果态** —— 弹窗在场时黄/粉盖过红灯（用户 2026-09-29 选定）；红灯的结论
   *      （`#outcome`）**一个字节都不动**，所以弹窗一关就自己回到红色，不需要谁去补一笔；
   *   ③ **不常驻、也不需要定时器** —— 什么时候收，是浏览器那条报文说了算（`attention: null`）。
   *      宿主这边**刻意不做超时**：超时是第二份判据，只会跟浏览器那份打架（浏览器看得见
   *      弹窗真的关了没有，宿主看不见）。
   *
   * 色值由浏览器下发（`payload.approvalColor` / `payload.menuColor`，与 errorColor 同一套：
   * 调色板归客户端，宿主不另立一份）。`attention` 由 ./attention.js 探测界面后随灯态上报。
   */
  #approvalColor = 0xffc800
  #menuColor = 0xff69b4
  /** 当前弹窗态：`'approval'` / `'menu'` / `null`（没有弹窗）。见 `#approvalColor`。 */
  #attention = null

  // ---------- 浏览器下发的期望灯态 ----------
  // 槽位里带上会话 id（sid），宿主靠它把 agent/error 这类事件定位到具体那颗键。
  #desiredAgents = [] // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
  #slotSessions = [] // 槽位下标 → 会话 id
  /**
   * **当前会话** = 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`；**只有浏览器算得
   * 出来** —— 由 `src/client/utils/session-list.js` 的 `currentSessionIdIn` 算出，随 POST
   * /micro/agents 的 `current` 字段报上来）。
   *
   * ⚠ **规则 1**：`st` 只报当前会话占的那颗键，其余槽位一律 `IDLE`，**颜色照旧**（别的会话在跑
   * 就还是蓝的，那由 `c` 说）。判据压平在 `#stOfSlot`，全项目**只此一处**。
   * （规则 2「会话重新运行 → 6 槽 st 全空闲」自 2026-09-27 起停用：`clearOutcome` 一条报文都不发。）
   *
   * ⚠ **`null` 不覆盖本字段**：浏览器在**主视图重渲染的间隙**会报一次 `current: null`，把它也当成
   * 「当前会话 = 没有」会让 6 槽 `st` 压成空闲、真实 id 报回来再变回去 = 多发两条；切会话的日志也会
   * 被打成 A → null → B 两条。所以这里**只装真实会话 id**，`null` =「不知道 / 暂时没有」，排布按
   * 上一次那条来。（诊断面另用 `state.agentsCurrent` 如实报**这一拍报上来的原始值**，两者一起才
   * 说得清「知道但没有」与「压根不知道」。）
   *
   * ⚠ `#currentKnown` 区分两种「没有」——**缺 ≠ 空**：`false` = 老客户端压根没报这个字段 →
   * **不替它压平**（逐槽照旧，与改动前逐字节一致）；`true` + `null` = 报了、只是还没有（或没有）
   * 当前会话 → 没有一槽算当前会话。
   *
   * 详见技能 §2「st 只报当前会话」。
   */
  #currentSession = null
  #currentKnown = false
  /**
   * 「同拍合并」的暂存位（三道防线的第一道，见 `#renderAgents`）。
   *
   *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
   *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
   *   `#pendingForce`    —— 这一份是不是**结论**驱动的（是则不许被内容去重挡下）
   *   `#pendingFrom`     —— 这一份是**谁**排的（只进日志，见下）
   *
   * ⚠ 同一拍里多个来源都会重画（宿主的 error/status 连着来、`allIdle` 翻转顺手唤醒亮度），
   * 逐条写 = 设备一口气收到好几条 `thstatus`（每条要切成 5 帧 63 字节的 HID 报告）。
   * 沿革见技能 §2「一次只发一条」。
   */
  #pendingAgents = null
  #agentsScheduled = false
  /**
   * 待写的这一份是不是**结论**驱动的 —— 是则**必须真发出去**，不许被内容去重挡下。
   *
   * ⚠ 结论是**事件**，不是「此刻的样子」：红色为宿主独占（浏览器那份改不动），于是同一个会话
   * 连续失败两次算出的报文**逐字节相同**，不绕过去重就是「第二次失败设备根本不知道」。
   * 只给 **error** 开口子 —— success 的颜色要等浏览器更正，且两次颜色本就不同，用不着。
   * ⚠ 跟着**内容**走（谁后到谁赢，与 `#pendingAgents` 同语义）。切会话曾是本字段的第二个来源，
   * 2026-09-27 已撤回：强制写对「内容不同 / 相同」两种下落都只能产生重复。
   *
   * 三轮取舍与反证见技能 §2「一次只发一条 → 结论不吃内容去重」。
   */
  #pendingForce = false
  /**
   * 这一份待写报文是**谁**排的（`applyAgents` / `reportError` / `reportSuccess` / `leds` 之类）。
   *
   * ⚠ 只用于**日志**：用户 2026-09-27 要求「增加一个日志，用来查看是哪个方法调用了它」——
   * 设备上多出一条 `thstatus` 时，先说得出是谁发的。常态路径的写入发生在微任务 / 定时器里，
   * 栈上只剩 `#flushAgents`（拿 `new Error().stack` 冒充出处必然指向它），所以出处必须**跟内容一起**
   * 从调用点带过来。
   * ⚠ 与 `#pendingAgents` / `#pendingForce` **同生同灭**：`#renderAgents` 里一起设、`#flushAgents`
   * 里一起消费、`resetOnDisconnect()` 里一起作废（少一处就会把出处漏给下一条无关灯态）。
   */
  #pendingFrom = null
  /**
   * 上一次**真正写出去**的那条 `v.oai.thstatus` 长什么样（JSON 字符串，用来比对内容）。
   *
   * ⚠ 第二道防线：同拍合并只管**同一拍**，挡不住同一份内容**跨拍**被推两次（宿主结论与浏览器
   * 那份快照错开到达，内容却完全一样）。设备没必要听两遍。
   * ⚠ 只在**写成功之后**更新（失败时不动，下次同内容仍会尝试）；`resetOnDisconnect()` 清空 ——
   * 「链路断了」是唯一必须忘掉「上次发过什么」的时刻（重连要重放）。
   */
  #lastThstatus = null
  /**
   * 上一次**真正写出去**的那份画面里，**除 `st` 之外**的部分（见 `#shapeOf`）—— 见 `#stOnce`。
   *
   * ⚠ 只用来认出「这一条与设备手里那份只差在 st 回落」这一种：喇叭那一位是一次性事件信号，
   *   设备收到就等于知道了，为了把它抹回 0 再占一条报文不值当（用户反复报的「多发一条」）。
   *   与 `#lastThstatus` 同生同灭 —— 只在写成功后一起更新、`resetOnDisconnect()` 里一起清空。
   */
  #lastShape = null
  /**
   * 上一次**决定要写**的那幅画面的**指纹**（见 `#pictureKey`）—— 第四道防线。
   *
   * ⚠ 挡的是内容去重漏掉的一类：**同一幅画面只换了键位**。会话列表「最新在前」重排、切会话时，
   * 6 颗键的画面**多集**没变，只是谁长在哪颗键上换了位；按内容比对会认为「变了」而白发一条，
   * 设备侧其实一模一样（用户 2026-09-27 第四次报的「发消息后挪到第一条，多发一条」）。
   * `applyAgents` 拿新算出来的指纹与它比：相同 ⇒ 这条推送只带来键位变化 ⇒ **一条都不发**
   * （键位留到下一次真实变化一起带过去，见 verify_blackout §8j / §8l t7）。因此这条抑制必须
   * **在渲染之前**早退：诊断面 `#state.agents` 也跟着停在旧键位上，那正是设备手里那份画面。
   * ⚠ 由 `#renderAgents`（决定要写什么时）更新，不是由 `#writeThstatus` 更新 —— 「刚才算出来的
   * 那一幅」与「设备手里那一幅」在**被内容去重挡下**时仍然是同一幅，只有按「决定」记账才分得清
   * 「这次推送带没带来新画面」（否则一条被挡下的写入会把它留成过期指纹，见 verify_led_error §11）。
   * `resetOnDisconnect()` 清空：链路断过之后设备那份画面不再可信，重连必须真的重放。
   */
  #lastPicture = null
  /**
   * **结果态的等待窗口**（毫秒）—— 结果态**不立刻下发**，先等一个窗口。
   *
   * ⚠ **为什么**：「会话状态变了」有**两条速率不同的通道** —— 宿主的事件是即时的，浏览器那份带
   * 350ms 防抖且要等列表重算，同一个物理时刻它晚 350ms 以上才到。不等就是拿**旧颜色**写一条
   * 抢跑态（实测一次「跑完一轮」设备收到 3 条，中间那条纯属抢跑）。
   * ⚠ **窗口到点 ≠ 可以写**：要先确认浏览器那条真到了（看待写内容有没有被消费掉），
   * 窗口只是「回头看一眼」的检查点 —— 取值因此不需要「比对方长」。一直不来由 `#outcomeMaxMs` 兜底。
   *
   * 诊断面不受影响（`#state.agents` 仍在同一拍同步更新）。0 = 立即写（`DSH_MICRO_OUTCOME_MS` 覆盖）。
   * 两轮演化与反证见技能 §2「一次只发一条 → 第三道防线」。
   */
  #outcomeWindowMs = 500
  /**
   * 等浏览器那条的**硬上限**（毫秒）—— 从**首次**开窗算起，不因期间又来结论而重排。
   *
   * 为什么必须有：「等对方」的判据对面可能**永远不来**（页面关了 / 崩了 / 被挂起）。
   * 没有上限就变成「灯一直不变」，那是用户明确反对的另一头。
   * 为什么是 2s：正常路径下浏览器那条 350ms~1s 内必到（防抖 + 渲染 + 后台节流），
   * 2s 已是「这次真的不会来了」的量级；再长只会让「页面关了」的场景更迟钝。
   * `DSH_MICRO_OUTCOME_MAX_MS` 覆盖（自检要调小，否则每节都得多等 2 秒）。
   */
  #outcomeMaxMs = 2000
  /** 当前这轮结果态**首次**开窗的时刻（0 = 没在等）。算 `#outcomeMaxMs` 的起点，**不重排**。 */
  #outcomeSince = 0
  /** 结果态窗口的定时器（null = 窗口没开）。见 #outcomeWindowMs / #deferAgentsWrite。 */
  #outcomeTimer = null
  /**
   * 槽位下标 → { sid, kind }，**结果态**（kind: 'error' | 'success'）。
   *
   * ⚠ **它不会自己过期**（2026-09-25 用户要求：「错误后不变白」）。原来的实现是 3 秒窗口，
   * 到点自动回到浏览器下发的常态；现在一直挂着，直到下面三件事之一发生：
   *   1. 该会话**重新开始运行** → 用户重试了，`clearOutcome()`（宿主 agent/status=running 驱动）；
   *   2. 该会话从槽位上消失（归档 / 关掉 / 被别的会话顶掉，见 applyAgents 的整表重建）；
   *   3. 同一颗键上来了**更新的结论**（又失败一次 / 这回跑成功了，后写覆盖先写）。
   *
   * 「到点自动消失」这件事**不能靠浏览器重新下发来替代**：失败那一刻浏览器快照里这个会话
   * 常常还写着 running（它的推送还带 350ms 防抖），拿浏览器下发的 st 当清除判据，红灯会在
   * 亮起的同一瞬间被自己的陈旧快照抹掉。清除只认宿主的 agent/status（见 applyAgents 的注释）。
   *
   * 两种表现：
   *   'error'   —— 状态码 st=3，**并且**把颜色换成红灯（用户可见的「上次失败了」）
   *   'success' —— 状态码 st=2，颜色不动（跑完了是正常态，不该抢眼的颜色）
   */
  #outcome = new Map()
  /**
   * **喇叭**（用户 2026-09-27 第八轮口径）：`st` 只和 `reportError` / `reportSuccess` 相关，
   * 只在收到这两个反馈的那一条报文里带上当前状态**一次**；其它任何行为（浏览器推送、切会话、
   * 唤醒、亮度、重放）写出去的 `st` 一律 `IDLE`。
   *
   * ⚠ 所以它**不是**「此刻的状态」，而是**一次性的事件信号**：`#latchOutcome` 在这里排一格，
   *   `#composeAgents` 读它算出那一条的 st，`#flushAgents` 把这一份交出去之后就清掉
   *   （下一次写入自然就是 0）。设备侧按「收到即响」处理，不靠我们回落。
   * ⚠ 仍然只看**当前会话**（第七轮口径，见 `#isCurrentSession`）：非当前会话的结论不响，
   *   而且**不会补响** —— 事后再切过去属于「其它行为」，那一条写出去是 0。
   * ⚠ 颜色**不吃**这一位：红灯照旧由 `#outcome` 常驻（见 `#composeAgents`），
   *   「失败后不变白」与喇叭是两件事。
   * @type {null | {sid: string, st: number}}
   */
  #stOnce = null

  // ---------- 电源/空闲（自动调暗）----------
  #dimmed = false // 是否已因空闲而自动调暗
  #lastActivity = Date.now()
  /**
   * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
   * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
   */
  #allIdle = null
  #idleSince = 0 // 进入「全空闲」的时刻（0 = 未知）
  #dimTimer = null

  /** @param {{logger?: any, state: object}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null } = options
    this.#logger = logger
    this.#state = state
    // 结果态窗口（见 #outcomeWindowMs）：自检设 0 退回「同拍合并后立刻写」的老路径。
    const outcome = Number(process.env.DSH_MICRO_OUTCOME_MS)
    if (Number.isFinite(outcome) && outcome >= 0) this.#outcomeWindowMs = outcome
    // 等浏览器那条的硬上限（见 #outcomeMaxMs）：自检调小，否则每节都得多等 2 秒。
    const outcomeMax = Number(process.env.DSH_MICRO_OUTCOME_MAX_MS)
    if (Number.isFinite(outcomeMax) && outcomeMax > 0) this.#outcomeMaxMs = outcomeMax
    // 成功绿灯亮多久（见 #successHoldMs）：自检设 0 = 关掉绿灯（那几套只关心条数与 st）。
    const hold = Number(process.env.DSH_MICRO_SUCCESS_HOLD_MS)
    if (Number.isFinite(hold) && hold >= 0) this.#successHoldMs = hold
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1000)
    this.#dimTimer.unref()
  }

  /** 装配后注入传输层（写灯的唯一出口）—— 构造顺序上 transport 依赖 leds 的 lightsOff，故后接。 */
  attach = (transport) => { this.#transport = transport }

  #log = (...a) => { try { this.#logger?.['info']?.(...a) } catch (e) {}; logSink.info(...a) }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; logSink.warn(...a) }

  // ---------- 电源：亮度 / 自动调暗 ----------
  /** 有输入活动（input.js 每次入站都报）—— 自动调暗的计时基准。 */
  markActivity = (now = Date.now()) => { this.#lastActivity = now }

  /**
   * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（input.js #bump）、会话重新开始运行（applyAgents）。
   * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
   * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
   * @returns {boolean} 是否真的从调暗状态恢复。
   */
  wake = () => {
    if (!this.#dimmed) return false
    this.#dimmed = false
    if (this.#state.brightness > 0) this.#sendBrightness(this.#state.brightness)
    this.#renderAgents({ from: '唤醒（按键/会话重新运行）' })
    return true
  }

  // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
  #sendBrightness = (v) => {
    const b = Math.max(0, Math.min(1, v))
    if (b <= 0) {
      return this.#transport.writeRpc('v.oai.rgbcfg', {
        ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
        keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
      })
    }
    return this.#transport.writeRpc('v.oai.rgbcfg', {
      ambient: { e: 2, b, s: 0.4, m: 0, c: 0x304ffe },
      keys: { e: 1, b, s: 0, m: 0, c: 0xffffff }
    })
  }

  // 应用来自设置面板的配置补丁（公开给 server/：POST /micro/config 的 handler 调它）。
  applyConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return
    if (typeof patch.brightness === 'number') {
      this.#state.brightness = Math.max(0, Math.min(1, patch.brightness))
      this.#dimmed = false
      this.markActivity()
      this.#sendBrightness(this.#state.brightness)
      this.#renderAgents({ from: '设置面板改亮度' })
    }
    if (typeof patch.autoDim === 'number') {
      this.#state.autoDim = Math.max(0, patch.autoDim)
      // 关掉自动调暗时如果正暗着，要立刻把灯点回来（#wake 只在真暗着时才动手）
      if (this.#state.autoDim <= 0) this.wake()
      else this.#dimmed = false
    }
  }

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  // 与 applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
  // 返回是否发生了改动。
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return false
    let changed = false
    if (typeof prefs.brightness === 'number') {
      const b = Math.max(0, Math.min(1, prefs.brightness))
      if (b !== this.#state.brightness) {
        this.#state.brightness = b
        this.#dimmed = false
        this.markActivity()
        this.#sendBrightness(b)
        this.#renderAgents({ from: '持久化偏好回灌' })
        changed = true
      }
    }
    if (typeof prefs.autoDim === 'number') {
      const d = Math.max(0, prefs.autoDim)
      if (d !== this.#state.autoDim) {
        this.#state.autoDim = d
        if (d <= 0) this.wake()
        else this.#dimmed = false
        changed = true
      }
    }
    return changed
  }

  // 空闲自动调暗：autoDim(秒) 到了就关灯（亮度 0 = ambient 与键灯一起熄）。
  //
  // 计时基准有两条路：
  //   * 浏览器报过 allIdle（新客户端）→ 用「进入全空闲的时刻」与「最后一次按键」里较晚的那个
  //     起算。会话在跑 = 有活干，直接不关；刚敲过键盘也不关——否则会出现
  //     「到点关灯 → 一按键又亮 → 1 秒后又关」的闪烁。
  //   * 还没这份信息（老客户端 / 从未上报）→ 退回原来的「无按键活动」判据，行为与以前完全一致。
  #autoDimCheck = () => {
    if (this.#state.autoDim <= 0 || this.#dimmed || !this.#state.open) return
    if (this.#allIdle === false) return // 有会话在运行：不关灯
    const ref = Math.max(this.#lastActivity, this.#idleSince)
    if (Date.now() - ref < this.#state.autoDim * 1000) return
    this.#dimmed = true
    this.#sendBrightness(0)
    this.#renderAgents({ from: '空闲自动调暗' }) // 灯态也要跟着压灭（否则下一次 thstatus 又把灯点亮）
    this.#log(`空闲自动调暗：关闭灯光（${this.#allIdle === true ? '所有会话空闲' : '无按键活动'} ${this.#state.autoDim}s）`)
  }

  #clampRgb = (v) => Math.max(0, Math.min(0xffffff, Math.round(Number(v) || 0)))

  #clamp01 = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  }

  /**
   * 状态码的白名单校验：**必须是整数**且在 allowed 里，否则回落到 IDLE。
   *
   * 为什么要判类型而不是只 `Number()` 一下：`Number(true) === 1`、`Number('1') === 1` ——
   * 只做数值转换的话，浏览器塞个 `true` 就能伪装成「运行中」。设备拿这个数直接分支，
   * 所以校验必须严于「能转成数字」。
   */
  #stOf = (v, allowed) => (typeof v === 'number' && Number.isInteger(v) && allowed.includes(v) ? v : AGENT_ST_DEFAULT)

  /** 浏览器报上来的状态码：只接受 IDLE/RUNNING（见 AGENT_ST_INBOUND）。 */
  #inboundSt = (v) => this.#stOf(v, AGENT_ST_INBOUND)

  /** 真正下发到设备前的兜底（此时才允许宿主叠加的 SUCCESS/ERROR）。 */
  #clampSt = (v) => this.#stOf(v, Object.values(AGENT_ST))

  // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
  // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
  //
    // 每个槽位恰好 5 个字段：id / c / b / e / st（曾经多发的 s / sk / sa 恒为 0，已删）。
    // 要加新字段，先答得出「谁产出它、谁消费它」。
  //
  // 自动调暗期间一律把整幅画面压成「全灭」：c/b/e 三个光学量**连同 st** 一起压 0 ——
  // 调暗＝灯全灭，写出去的那一份要跟 BLACKOUT_SLOTS 是同一幅画面（浏览器仍会照常推送灯态，
  // 设置页打开、会话列表变化都会触发，不压的话下一次推送就把灯又点亮了）。
  // ⚠ **c 也必须压**：只压 b/e 的话报文里仍带着颜色值，设备照旧按颜色点亮 ——
  //   用户 2026-10-04 报的「关闭灯光时发送给设备依然还是带颜色的灯光，导致关闭失败」就是这个。
  // （曾有一条「st 不压，压成空闲会让设备以为会话跑完了」的说法，已废弃：调暗期间 st 本就是
  //   一次性结论信号、flush 后即归 0，留着它与「全灭」不一致，且非零 st 仍可能被设备点亮。）
  /**
   * 一组槽位 → 真正写给设备的参数（白名单 5 字段 + 取值范围收敛 + 调暗压灭）。
   * **不改变任何状态、不碰设备** —— 什么时候把它交出去由调用方决定。
   */
  #thstatusParams = (slots) => {
    const dimmed = this.#dimmed
    return slots.slice(0, 6).map((s, i) => ({
      id: i,
      c: dimmed ? 0 : this.#clampRgb(s && s.c),
      b: dimmed ? 0 : this.#clamp01(s && s.b, 0),
      e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
      st: dimmed ? AGENT_ST.IDLE : this.#clampSt(s && s.st)
    }))
  }

  /**
   * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
   *
   * ⚠ **只有常态灯态才吃这套去重**。`force`（= **结论**，见 `#pendingForce`）为真时，
   *   内容再一样也**必须发**：结论是**一件事发生了**，「设备此刻已经是红色」并不等于「设备已经知道
   *   又失败了一次」。用户 2026-09-26 第四次报的「连续两次失败，第二次不发」就是被这条挡下的。
   * @param params - `#thstatusParams` 规范化过的 6 槽参数。
   * @param force - true = **结论**驱动（见 `#pendingForce`），跳过内容比对直接发。
   * @param from - 报文出处（见 `#pendingFrom`），只进日志。
   * @returns {boolean} 是否真的写了（内容没变且非结论时为 false，这不是错误）。
   */
  #writeThstatus = (params, force = false, from = '') => {
    const key = JSON.stringify(params)
    if (key === this.#lastThstatus) {
      if (!force) {
        this.#log(`灯态与上次写出去的完全相同 → 跳过重复写回（来自 ${from}）`)
        return false
      }
      // 结论态照发 —— 这一行是给「又失败一次，终端里却什么都没有」留的证据。
      this.#log(`这一条是结论态 → 内容与上次相同也照发（内容去重只挡常态灯态）（来自 ${from}）`)
    }
    // **喇叭那一位的回落不算变化**（见 `#stOnce`）：结论那一条已经把 st 交给设备了，它是
    // **一次性事件信号**（收到即响），没必要为了把它抹回 0 再发一条 —— 那正是用户反复报的
    // 「多发一条」（浏览器那条随后到达时，画面与设备手里那份只差这一位）。
    // 判据：这一条与设备手里那份**除 st 外逐字节相同**，且这一条自己的 st 全是 0。
    // ⚠ force（结论）不受这条约束；颜色/亮度/开关有任何一处不同都会走正常那条路（照发）。
    if (!force && this.#lastShape !== null && this.#shapeOf(params) === this.#lastShape
      && params.every((p) => p.st === AGENT_ST.IDLE)) {
      this.#log(`与设备手里那份只差在 st 回落（喇叭那一位是一次性信号）→ 跳过（来自 ${from}）`)
      return false
    }
    const ok = this.#transport.writeRpc('v.oai.thstatus', params)
    if (ok) {
      this.#lastThstatus = key
      this.#lastShape = this.#shapeOf(params)
      this.#log(force ? `→ 写 thstatus（结论，来自 ${from}）` : `→ 写 thstatus（来自 ${from}）`)
    }
    return ok
  }

  /**
   * 把 `st` 抹平之后的那份形态（颜色 / 亮度 / 开关）—— 只给上面那条「只差在 st 回落」的比对用。
   */
  #shapeOf = (params) => JSON.stringify(params.map((p) => ({ id: p.id, c: p.c, b: p.b, e: p.e })))

  /**
   * **立刻**把一组槽位写给设备（规范化 + 记诊断 + 写）。
   *
   * 只有「进程要走了」那条线该用它（`#lightsOff` 灭灯），因为那条路**必须同步**：
   *   · `dispose()` 的灭灯要排在 `close()` 之前，早一步句柄就没了；
   *   · 安全网的 `'exit'` 钩子跑在 process 退出回调里，**微任务根本不会被执行**。
   * 会话灯态走 `#renderAgents()`（同拍合并 + 内容去重），**不要**拿这个函数去写常态灯。
   *
   * 它也过内容去重（见 `#writeThstatus`）：连续两次灭灯只会写出去一条 —— 「全灭」本来就已经
   * 是设备此刻的样子。
   * @param slots - 要写的槽位（灭灯那条路给 `BLACKOUT_SLOTS`）。
   * @param from - 报文出处（见 `#pendingFrom`），只进日志。
   * @returns {boolean} 是否真的写给了设备（内容与上次相同 → false）。
   */
  #sendThstatus = (slots, from = '') => {
    if (!Array.isArray(slots)) return false
    const params = this.#thstatusParams(slots)
    this.#state.agents = params
    return this.#writeThstatus(params, false, from)
  }

  /**
   * 把灯**全部**关掉 —— 两组灯各一条指令，缺一不可。
   *
   * 为什么要主动关：灯效是**设备自己记着**的状态，BLE 链路断开并不会让它熄灭。设备会一直
   * 保持最后收到的那个画面（Agent 键亮着、氛围灯亮着），看起来就像「app 都关了，键盘还亮着」。
   *
   * 两条指令覆盖两组互不相干的灯：
   *   · `v.oai.rgbcfg` 全 0  —— 普通键背光 + 外周氛围灯；
   *   · `v.oai.thstatus` 全 0 —— Agent 键那圈灯（它**不走** rgbcfg）。
   * 只关一组就是「亮着一半」，用户照样看得出没关干净。
   *
   * **只在「进程要走了」这条线上调用，绝不在 close() 里**：断开是随时会发生的（掉线 /
   * 点「重连」/ 宿主重扫设备），在那儿关灯只会让「重连之后黑一片」（用户明确要求做出这个区别）。
   * 两个落点 ——
   *   · `dispose()`：插件卸载（宿主优雅关闭 / 重载）；
   *   · **退出安全网**（exit-guard）：Ctrl+C / SIGTERM / SIGHUP 这类进程级退出，
   *     宿主未必来得及走到 `dispose()`（见 ./guard.js 顶部「退出前必须灭灯」）。
   *
   * 幂等：重复调用只是把同一份「全灭」再写一遍，弄不坏任何状态（插件可能被卸载两次、
   * 安全网也可能在 exit 钩子上再调一次）。
   *
   * 它会让 `state.agents` 也变成全 0（`#sendThstatus` 的正常副作用）：这正是设备此刻
   * 真实的样子，也是 /micro/state 该报的事实。**期望灯态 `#desiredAgents` 一个字节都不动**。
   * @returns {boolean} 两条指令是否真的写出去了（没连上、或内容与上次完全相同被跳过时 false）。
   */
  #lightsOff = () => {
    const dim = this.#sendBrightness(0)
    const dark = this.#sendThstatus(BLACKOUT_SLOTS, '插件卸载/进程退出灭灯')
    return dim && dark
  }

  /**
   * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫在 transport）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：上层（ble.js 的 blackout / 退出安全网）
   * 拿它当回调，自检也可以换掉它来观测「退出路径到底有没有灭灯」。
   * @returns {boolean} 是否真的写给设备了。
   */
  lightsOff = () => this.#lightsOff()

  // ---------- 期望灯态 + 结果态 ⇒ 实际灯态 ----------
  // 会话灯态的**唯一出口**：把浏览器下发的期望灯态与「上一轮跑出结论的那几颗键」叠加后写 HID。
  // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把结果态
  // 冲掉——收不收只由宿主说了算（见 #latchOutcome 与 applyAgents）。
  //
  // ⚠ **不直接写设备**：把「此刻应该是什么样」算出来存进 `#pendingAgents`，写入排到本拍末尾
  //   （微任务、同拍再多次也只是覆盖）→ 管**同拍**；跨拍的重复由 `#writeThstatus` 的**内容去重**
  //   兜住 → 管**跨拍**。两条防线各管一段，缺一不可（见技能 §2「一次只发一条」）。
  //
  // ⚠ 诊断字段（`#state.agents` / `#state.outcomes`）必须留在**同步**这一半更新：读 /micro/state
  //   与自检的人不该被一个微任务的时序影响。**灭灯不走这里**：退出路径必须同步写。
  //
  // @param {{defer?: boolean, force?: boolean, from?: string}} [opts]
  //   defer - 排到结果态窗口之后（见 #deferAgentsWrite），只给 success 那条用（error 要立刻亮）。
  //   force - 这一份是**结论** → 写出去时不吃内容去重（见 #pendingForce）。
  //   from  - 报文出处（见 #pendingFrom）。**每个调用点都必须给** —— 漏一个，日志里那条写入就
  //           只剩「来自 」说不出是谁。
  #renderAgents = (opts = {}) => {
    const { defer = false, force = false, from = 'leds' } = opts || {}
    if (!this.#desiredAgents.length) return false
    const params = this.#thstatusParams(this.#composeAgents())
    // ⚠ 下面两行**同步**更新，与「什么时候写设备」无关：读诊断面的人（GET /micro/state、
    //   自检）不该被一个写设备的时机左右。defer 只推迟 #pendingAgents 的落地。
    this.#state.agents = params
    // 排查用：哪些键此刻挂着结果态（红/成功）、分别是哪个会话。它们是**不会自己消失**的，
    // 所以「灯的颜色没人解释」时，先来这里看是谁挂的。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }))
    // 第四道防线按「**决定**要写的那一幅」记账（见 #lastPicture）：即使下面被内容去重挡下、
    // 或 defer 到窗口之后才落地，指纹也已经是这一幅了 —— applyAgents 靠它判断「这次推送有没有
    // 带来新画面」。
    this.#lastPicture = this.#pictureKey(params)
    this.#pendingAgents = params
    // 「是不是结论」与出处都跟着**内容**一起记（谁后到谁赢，与 #pendingAgents 同一套语义）。
    this.#pendingForce = force
    this.#pendingFrom = from
    if (defer) { this.#deferAgentsWrite(); return true }
    if (!this.#agentsScheduled) {
      this.#agentsScheduled = true
      queueMicrotask(this.#flushAgents)
    }
    return true
  }

  /** 设备（重）连后重放灯态（open() 成功时由 transport 回调）—— 空期望态时什么也不做。 */
  replayAgents = () => this.#renderAgents({ from: '设备（重）连后重放' })

  /**
   * 把待写的那份灯态排到**一个窗口之后**（见 `#outcomeWindowMs`）—— 只给**结果态**用
   * （`#latchOutcome` / `clearOutcome`），常态灯态照旧走同拍合并后立刻写。
   *
   * 窗口内再来多少次都只是覆盖 `#pendingAgents`（谁后到谁赢，算的都是「此刻应该是什么样」），
   * 到点只写一条。**已经在窗口里就直接返回，起点不重排** —— 否则连续事件会把写入无限往后推，
   * 变成「一直不亮」。
   *
   * 窗口为 0（自检 / `DSH_MICRO_OUTCOME_MS=0`）时走的还是老路径：同拍合并后立刻写。
   * 这样「结果态延后」这件事不会把「同拍只发一条」那套既有语义搅乱。
   */
  #deferAgentsWrite = () => {
    if (this.#outcomeWindowMs <= 0) {
      if (!this.#agentsScheduled) {
        this.#agentsScheduled = true
        queueMicrotask(this.#flushAgents)
      }
      return
    }
    if (this.#outcomeTimer) return
    if (!this.#outcomeSince) this.#outcomeSince = Date.now()
    this.#outcomeTimer = setTimeout(this.#afterOutcomeWindow, this.#outcomeWindowMs)
    // 绝不因为一条灯效把进程留住（窗口到点前进程就该能走；那时灯也没人看了）。
    this.#outcomeTimer.unref?.()
  }

  /**
   * 窗口到点：**回头看一眼浏览器那条来了没有** —— 只有来了（或等过头了）才把灯写出去。
   *
   * 怎么知道它来了：**看 `#pendingAgents` 还在不在**。浏览器那条一到就走
   * `applyAgents` → `#renderAgents()`（非 defer）→ 微任务把终态写下去，这一份随即被消费掉；
   * 所以「到点后 `#pendingAgents` 还在」= 这期间没有任何东西写过灯。此刻写出去的是
   * 「旧颜色 + 新 st」，等浏览器到了还得再写一条，设备就收到两条 —— 那正是用户报的病。
   * 于是**继续等**，等到 `#outcomeMaxMs` 才认输兜底。
   *
   * ⚠ 曾经这里还比过一个「浏览器推送序号」（`#browserSeq` / `#outcomeSeq`）。反证时发现
   *   **摘掉它行为完全不变** —— 因为「浏览器推过」的充分表现就是上面那份待写内容被消费掉，
   *   序号是第二份判据、多一个可以不同步的字段。按「不留无法反证的分支」删掉了。
   */
  #afterOutcomeWindow = () => {
    this.#outcomeTimer = null
    const patientLeft = Date.now() - this.#outcomeSince < this.#outcomeMaxMs
    if (this.#pendingAgents && patientLeft) {
      this.#deferAgentsWrite()
      return
    }
    // 认输：连同窗口一起撤掉（`#flushAgents` 里的 #cancelOutcomeWindow），别留孤儿。
    this.#flushAgents()
  }


  /**
   * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
   *
   * 链路断开时 `resetOnDisconnect()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了
   * 多一行「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 open() 会重新让灯态重放出来，
   * 不会漏（`resetOnDisconnect()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
   * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
   */
  #flushAgents = () => {
    this.#agentsScheduled = false
    // 这一轮等待到此结束（灯已经有人写了）→ **窗口必须一起撤掉**（`#cancelOutcomeWindow`）：
    // 只清一半会留下**孤儿窗口**，它到点会把 flush 之后新来的那份**抢跑**写出去 = 设备收到两条
    // （用户第三次报的「点击发送后还是两条」，详见那里与 verify_blackout §8g）。
    this.#cancelOutcomeWindow()
    const params = this.#pendingAgents
    // 「是不是结论」与**出处**都跟内容一起消费掉（同一个暂存位的几半，少一个就会漏给下一条）。
    const force = this.#pendingForce
    const from = this.#pendingFrom
    this.#pendingAgents = null
    this.#pendingForce = false
    this.#pendingFrom = null
    if (!params) return false
    // **喇叭那一位用完了**（见 `#stOnce`）：这一份是它唯一的去处，交出去之后下一次写入就是 0。
    // 放在这里而不是 `#renderAgents` 里 —— defer 的那条（成功）要等窗口/浏览器那条，
    // 期间可能重画好几次，那几位必须一直跟着待写内容走到真正落笔。
    this.#stOnce = null
    return this.#writeThstatus(params, force, from)
  }

  /**
   * 撤掉还没到点的结果态窗口，并清掉「这一轮从何时算起」。
   *
   * 谁清 `#outcomeSince` 谁就得清 `#outcomeTimer` —— 这两个字段是**同一件事的两半**：
   * 窗口活着 = 这一轮还在等浏览器那条。只清一个就会留下孤儿窗口，它到点时按「已经等过头了」
   * 处理，把不该写的待写内容抢跑写出去（见 `#flushAgents` 与 §8g）。
   *
   * ⚠ 这条曾经被当成「删掉也没有断言变红」的冗余代码删过一次 —— 那是**当时漏了场景**：
   *   §8f 覆盖的是「开窗后没有新的结果态变化」，而 orphan 要的是
   *   「开窗 → 浏览器那条到（flush）→ **又来一次结果态变化**（点击发送 / clearOutcome）」。
   *   §8g 补上之后，删掉它立刻红 3 条。**别再删了。**
   */
  #cancelOutcomeWindow = () => {
    if (this.#outcomeTimer) { clearTimeout(this.#outcomeTimer); this.#outcomeTimer = null }
    this.#outcomeSince = 0
  }

  /**
   * 某一槽位挂着的会话**是不是当前会话**（规则 1 的第一半，见 `#currentSession`）。
   *
   * 三种「没有」要分开（**缺 ≠ 空**）：
   *   · `#currentKnown === false` —— 老客户端**压根没报**这个字段 → 不替它压平（逐槽照旧）；
   *   · 报过、`#currentSession === null` —— 报了但（暂时）没有当前会话 → 没有一槽算当前会话；
   *   · 报过真实 id —— 只认那一条。
   */
  #isCurrentSession = (sid) => {
    if (!sid) return false
    if (!this.#currentKnown) return true
    return this.#currentSession !== null && this.#currentSession === sid
  }

  /**
   * 槽位挂着的结论（若有）该报的状态码 —— **全项目只此一处**。
   *
   * ⚠ 三道限制叠在一起，缺一条就会多响：
   *   ① 只有**结论**能产生非 0（浏览器下发的 st 一位都不进报文 —— 它带 350ms 防抖，
   *      只区分 running/idle，下发就成了「抢跑态」）；
   *   ② 只给**当前会话**那一槽（第七轮口径）；
   *   ③ **一次性** —— 只有结论事件驱动的那一条报文带它（见 `#stOnce`），
   *      之后同样的画面/切会话再写出去都是 `IDLE`，喇叭不会因为「你切回来看它」再响一次。
   *
   * 而**颜色不吃这三道闸门**（见 `#composeAgents`）：失败的红必须一直亮着，
   * 不能因为「当前会话换人了」「那把已经响过了」就被抹成日常色。
   */
  #stOfSlot = (mine, sid) => {
    if (!mine || !this.#isCurrentSession(sid)) return AGENT_ST.IDLE
    const once = this.#stOnce
    if (!once || once.sid !== sid) return AGENT_ST.IDLE
    return once.st
  }

  /**
   * 期望灯态 + 结果态 ⇒ 实际灯态（6 槽，**下发前**那一份）。
   *
   * 颜色：全交给 `#colorOf` —— 失败转红（常驻）、成功转绿（当前会话 + 只亮一会儿）、
   * 其余用浏览器下发的期望色。状态码：全交给 `#stOfSlot`（三道闸门压在一处）。
   */
  #composeAgents = () => this.#desiredAgents.map((s, i) => {
    const out = this.#outcome.get(i)
    const sid = this.#slotSessions[i]
    const mine = out && sid === out.sid ? out : null
    return {
      id: i,
      st: this.#stOfSlot(mine, sid),
      c: this.#colorOf(mine, sid, s.c),
      b: s.b,
      e: s.e
    }
  })

  /**
   * 结论态该用哪个颜色 —— `mine` 是这一槽挂着的结论（没有则用浏览器那份 `fallback`）。
   *
   *   · **弹窗覆盖色最优先**（见 `#attentionColor`）：界面上有批准弹窗 / 旋钮或「+」招来的弹窗时，
   *     当前会话那颗键转黄 / 转粉，**盖过红灯**（用户 2026-09-29 选定）。弹窗关了就自然落回下面。
   *   · **失败 → 红**（`#errorColor`），**不吃「当前会话」闸门**：那颗键在侧边栏哪儿都得红着，
   *     那是「这个会话上次失败了」的事实，与你看不看它无关（第七轮口径，verify_led_error §6）。
   *   · **成功 → 绿**（`#successColor`），**只给当前会话**（用户 2026-09-28 原话）+ **只亮一会儿**
   *     （到点由 `#successHoldMs` 的定时器把结论收掉，见 `#armSuccessHold`）。
   *
   * 绿灯这道闸门与喇叭（`#stOfSlot`）是同一个判据：**你看不见的那个会话跑完了，不该在你眼前闪一下**
   * —— 切过去也不补（那时结论早已到点收掉）。
   */
  #colorOf = (mine, sid, fallback) => {
    const att = this.#attentionColor(sid)
    if (att !== null) return att
    if (!mine) return fallback
    if (mine.kind === 'error') return this.#errorColor
    if (!(this.#successHoldMs > 0)) return fallback // 绿灯关着（见 #successHoldMs）
    return this.#isCurrentSession(sid) ? this.#successColor : fallback
  }

  /**
   * 弹窗覆盖色：这一槽该不该因为是「当前会话」而转黄 / 转粉。没弹窗、或不是当前会话 → null。
   *
   * ⚠ 与绿灯共用 `#isCurrentSession`（用户口径都是「**当前会话**」）。差别在**优先级**：
   *   绿灯排在红灯**后面**（失败的红更紧急，且失败了的会话也不会正在跑），
   *   黄/粉排在红灯**前面**（弹窗正等着你动手，那一刻它比「上次失败了」更要紧）。
   * ⚠ 老客户端（`#currentKnown === false`）不会发 `attention`，本字段恒为 null ——
   *   所以「不知道当前是谁」退化成「每槽都算当前」这件事，在这条路上影响不到任何老客户端。
   */
  #attentionColor = (sid) => {
    if (!this.#attention) return null
    if (!this.#isCurrentSession(sid)) return null
    return this.#attention === 'approval' ? this.#approvalColor : this.#menuColor
  }

  /**
   * 画面指纹 —— 「这一幅画长什么样」，与**它长在哪颗键上**无关（第四道防线，见 `#lastPicture`）。
   *
   *   · 各槽 `st/c/b/e` **排序后拼接**（多集）—— 会话列表重排时同一幅画面换了键位，多集不变；
   *   · **红灯（st=ERROR）那几颗键要把键位带上** —— 「红灯跟着会话搬家」是用户看得见的结果
   *     （verify_led_error §6），不许被当成「只换了键位」压回旧键上；「键位晚一步」那条取舍
   *     只适用于常态画面与成功态（verify_blackout §8j / §8l t7）。
   * null = 还没写过。
   */
  #pictureKey = (params) => {
    const cells = params.map((p) => `${p.st}/${p.c}/${p.b}/${p.e}`).sort().join('|')
    const errs = params.filter((p) => p.st === AGENT_ST.ERROR).map((p) => p.id).join(',')
    return `${cells}#${errs}`
  }

  #latchOutcome = (sessionId, kind) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    const bad = kind === 'error'
    const slots = []
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i)
    if (slots.length === 0) return false // 不在侧边栏 / 还没下发过灯态 → 没有键可亮
    for (const slot of slots) this.#outcome.set(slot, { sid: sessionId, kind })
    // **喇叭那一位**（见 `#stOnce`）：只有当前会话的结论才响；非当前会话**不响、也不补响**。
    // 它跟结论本身（`#outcome`，决定红灯、常驻）是两件事：颜色照旧进诊断面，st 只进这一条报文。
    this.#stOnce = this.#isCurrentSession(sessionId)
      ? { sid: sessionId, st: bad ? AGENT_ST.ERROR : AGENT_ST.SUCCESS }
      : null
    // **成功绿灯的回落**（见 `#successHoldMs`）：亮一段就自己收掉；失败没有这一步（红灯常驻）。
    // 成功来了就先撤掉这几槽上还挂着的回落定时器，再由 #armSuccessHold 重新起一个。
    if (bad) this.#cancelSuccessHold(sessionId)
    else this.#armSuccessHold(sessionId)
    // 失败要**立刻亮**（defer:false），成功等浏览器那条跟进（defer:true，见 #deferAgentsWrite）。
    // 结论都带 force（见 #pendingForce），但只有 error 会走到「内容相同也照发」那一支。
    this.#renderAgents({ defer: !bad, force: bad, from: bad ? 'reportError' : 'reportSuccess' })
    this.#log(bad
      ? `会话运行失败 → 槽位 ${slots.join(',')} 转红灯（保持到该会话重新运行）`
      : `会话跑完一轮 → 槽位 ${slots.join(',')} 转绿灯（${this.#successHoldMs > 0 ? `${this.#successHoldMs}ms 后回落空闲` : '绿灯关着，颜色不变'}）`)
    return true
  }

  reportError = (sessionId) => this.#latchOutcome(sessionId, 'error')

  reportSuccess = (sessionId) => this.#latchOutcome(sessionId, 'success')

  /**
   * 起一个「成功绿灯亮多久」的定时器（见 `#successHoldMs`）—— 到点把该会话的 success 收掉再重画。
   *
   * ⚠ **按会话 id 记，不按槽位**：会话列表重排会让结论**换键**（`applyAgents` 里整表重建
   *   `#outcome`），按槽位记的定时器到点会找不到自己那条结论 —— 绿灯就永远不回落了。
   * ⚠ 到点那一刻只认「这些槽**现在**还挂着这个会话的 success」：期间会话重新运行
   *   （`clearOutcome`）、又失败了一次（`#latchOutcome` 会 `#cancelSuccessHold`）都算别人说了算。
   * ⚠ 定时器**必须 unref**（本项目的硬约定）：一条灯效不该把进程留住。
   * ⚠ 到点后重画走的是 `#renderAgents` 的**常态**那一支（不 defer、不 force）：这次回落只是
   *   「把绿灯换成浏览器下发的期望色」，不是一条新的结论 —— 内容没变就该被去重挡下。
   */
  #armSuccessHold = (sessionId) => {
    this.#cancelSuccessHold(sessionId)
    if (!(this.#successHoldMs > 0)) return
    const t = setTimeout(() => {
      this.#successTimers.delete(sessionId)
      let hit = false
      for (const [slot, cur] of [...this.#outcome]) {
        if (cur.sid !== sessionId || cur.kind !== 'success') continue
        this.#outcome.delete(slot)
        hit = true
      }
      if (!hit) return // 期间被收掉 / 换成了失败 → 已经有人说了算
      this.#renderAgents({ from: '成功绿灯到点回落空闲' })
      this.#log(`会话 ${sessionId} 的成功绿灯到点 → 回落成浏览器下发的期望色`)
    }, this.#successHoldMs)
    t.unref?.()
    this.#successTimers.set(sessionId, t)
  }

  /** 撤掉这个会话的成功回落定时器（结论被更新/收掉、或插件卸载）。没起过就什么都不做。 */
  #cancelSuccessHold = (sessionId) => {
    const t = this.#successTimers.get(sessionId)
    if (!t) return
    clearTimeout(t)
    this.#successTimers.delete(sessionId)
  }

  clearOutcome = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    let hit = false
    for (const [slot, t] of [...this.#outcome]) {
      if (t.sid !== sessionId) continue
      this.#outcome.delete(slot)
      hit = true
    }
    if (hit) this.#cancelSuccessHold(sessionId) // 会话重新运行 → 那颗绿灯连同它的回落定时器一起作废
    // 只更新诊断面，**不渲染、不写设备**（原因见上面的注释）。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }))
    if (hit) this.#log(`会话 ${sessionId} 重新开始运行 → 收掉结果灯（不再额外发清除报文）`)
    return hit
  }

  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor, allIdle, current } 或纯数组）。
  // 公开给 server/：POST /micro/agents 的 handler 调它。
  applyAgents = (payload) => {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.slots) ? payload.slots : null)
    if (!list) return
    // **这一份是不是一次「切会话」** —— 只用来打一行日志：写不写设备由**内容**说了算
    // （末尾那段：这一幅画面设备手里已经有了就一条都不写）。判据是「在两个真实会话 id 之间
    // 切换」，用 `#currentSession` 自己当上一拍的记忆（见它的注释：**`null` 不覆盖**，
    // 所以 A → null → B 只会记成一次 A → B，而不是两次）。
    let switched = false
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // 必须严格判定类型：Number(null) === 0 会让「字段缺失/null」被当成合法的黑色，
      // 于是红灯变成一颗看不见的灯（比报错更难查）。
      const c = payload.errorColor
      if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) this.#errorColor = c
      // 成功色同一套（见 #successColor）：畸形值一律忽略，保留宿主默认的绿。
      const sc = payload.successColor
      if (typeof sc === 'number' && Number.isInteger(sc) && sc >= 0 && sc <= 0xffffff) this.#successColor = sc
      // 弹窗覆盖色同一套（见 #approvalColor）：畸形值一律忽略，保留宿主默认的黄/粉。
      const ac = payload.approvalColor
      if (typeof ac === 'number' && Number.isInteger(ac) && ac >= 0 && ac <= 0xffffff) this.#approvalColor = ac
      const mc = payload.menuColor
      if (typeof mc === 'number' && Number.isInteger(mc) && mc >= 0 && mc <= 0xffffff) this.#menuColor = mc
      // 弹窗态（见 #attention）：**只在字段真的报了的时候改** —— 老客户端没有这个字段，
      // 不能把它的「没发」当成「弹窗关了」（那对老客户端毫无影响，但语义上必须分清）。
      const at = payload.attention
      if (at === 'approval' || at === 'menu' || at === null) {
        if (at !== this.#attention) {
          this.#attention = at
          this.#log(at === 'approval'
            ? '界面有批准弹窗 → 当前会话那一槽转黄（关了自动回原色）'
            : at === 'menu'
              ? '旋钮 / 输入框「+」招来的弹窗打开 → 当前会话那一槽转粉（关了自动回原色）'
              : '弹窗已关闭 → 当前会话那一槽恢复原色')
        }
        this.#state.attention = at
      }
      // 「所有会话都空闲」→ 自动调暗的计时起点；有会话重新开始运行 → 立刻把灯点回来。
      // 老客户端不发这个字段（数组形态的老请求更是没有），此时 #allIdle 保持 null = 未知，
      // 自动调暗退回「无按键活动」判据。
      if (typeof payload.allIdle === 'boolean') {
        this.#state.idle = payload.allIdle
        if (payload.allIdle !== this.#allIdle) {
          this.#allIdle = payload.allIdle
          if (payload.allIdle) this.#idleSince = Date.now()
          else { this.#idleSince = 0; this.wake() }
        }
      }
      if (typeof payload.current === 'string' || payload.current === null) {
        // ⚠ `null` = 「不知道 / 暂时没有」（主视图重渲染的间隙常报一次）：**不覆盖**上一个真实 id，
        //   否则 6 槽 st 会被压平、真实 id 报回来再变回去 = 多发两条（见 `#currentSession`）。
        const next = payload.current || null
        // 「切换」必须在**覆盖之前**算出来；`null` 不算切换（它压根不改记忆）。
        const prev = this.#currentSession
        switched = typeof next === 'string' && prev !== null && prev !== next
        if (typeof next === 'string') this.#currentSession = next
        this.#currentKnown = true
        if (switched) this.#log(`切会话：当前会话 ${prev} → ${next}`)
        // 诊断面如实报**这一拍报上来的原始值**（`null` 也是事实），与 `#currentSession` 的
        // 「只装真实 id」分开 —— 两者一起才说得出「知道但没有」与「压根不知道」（见 verify_blackout §8k/§8l）。
        this.#state.agentsCurrent = next
        this.#state.agentsCurrentKnown = this.#currentKnown
      }
      // ⚠ 字段**存在但畸形**（数字、对象…）→ 当作「这次没报」：两个字段都**原样不动**
      //   （上面这一整块就是它的守卫；放在块外会让畸形值把 `agentsCurrent` 抹成 null）。
    }
    const desired = []
    const sessions = []
    for (let i = 0; i < 6; i++) {
      const s = list[i] || {}
      desired.push({
        st: this.#inboundSt(s.st),
        c: this.#clampRgb(s.c),
        b: this.#clamp01(s.b, 0),
        e: Math.round(Number(s.e) || 0)
      })
      sessions.push(typeof s.sid === 'string' && s.sid ? s.sid : null)
    }
    this.#desiredAgents = desired
    this.#slotSessions = sessions
    // 结果态要跟着会话走，不能跟着槽位走：会话列表重排时槽位会换人，结果态必须一起搬家，
    // 会话消失（归档 / 关掉）时则撤掉。这里整表重建，避免原地增删的边界情况。
    //
    // ⚠ 这里**不**看浏览器下发的 st：它带 350ms 防抖，失败那一刻常常还是「running」的陈旧
    //   快照（见 #outcome 的注释），拿它收结果态 = 红灯刚亮就被抹掉。收只认 agent/status。
    const next = new Map()
    for (const [, t] of this.#outcome) {
      const at = sessions.indexOf(t.sid)
      if (at !== -1 && !next.has(at)) next.set(at, t)
    }
    this.#outcome = next
    // 第四道防线（见 `#lastPicture`）：这一幅画面设备手里已经有了（只是谁长在哪颗键上换了位），
    // 就**一条都不发** —— 而且必须**在渲染之前**早退：诊断面 `#state.agents` 也停在旧键位上，
    // 那正是设备手里那份（verify_blackout §8j / §8l t7 钉的就是这条）。
    const params = this.#thstatusParams(this.#composeAgents())
    // ⚠ `!this.#pendingAgents` 这一半是 2026-09-28 加成功绿灯时补的：有**待写内容**在排队时，
    //   `#lastPicture` 指的是「刚算好、还没交出去」的那一幅，不是设备手里那一幅 —— 此时早退
    //   只会让这份待写内容一直等到结果态窗口的**硬上限**（2s）才落地。绿灯是「跑完一轮」的
    //   即时反馈，晚 2 秒等于没有；而且不早退也不会多写一条（排队的和重算的是同一幅画面，
    //   写完再来的重复由 `#writeThstatus` 的去重挡下）。
    //   排队为空时语义一字不变：同一幅画面只换了键位 → 一条都不发（§8j / §8l t7）。
    if (!this.#pendingAgents && this.#pictureKey(params) === this.#lastPicture) {
      this.#log('同一幅画面只换了键位 → 一条都不发（键位留到下一次真实变化一起带过去）')
      return
    }
    this.#renderAgents({ from: 'applyAgents' })
  }

  /**
   * 链路断开时属于**灯态**的那部分收尾（由 ble.js 的 close 调）：
   *   · 电量读数作废 —— 它是「这台设备的读数」，设备不在了就该如实变成「不知道」，
   *     而不是把断开前的 12% 一直挂在界面上（用户看到的就是一台没连上的键盘还有电量）；
   *   · 排着队还没写出去的灯态作废 —— 链路都没了还补写一条，只会多一行「设备未连接」的 warn；
   *   · 还没到点的结果态窗口撤掉，并忘掉「上次写出去的灯态长什么样」：链路断过之后设备那份
   *     画面不再可信（它可能自己重启过 / 被人手动改过），重连时灯态必须**真的重放一次**，
   *     不能被内容比对挡掉。重连时 open() 会重新重放灯态，所以不会漏。
   */
  resetOnDisconnect = () => {
    this.#state.battery = null
    this.#state.charging = false
    this.#pendingAgents = null
    this.#pendingForce = false
    this.#pendingFrom = null
    this.#stOnce = null
    this.#cancelOutcomeWindow()
    this.#lastThstatus = null
    this.#lastShape = null
    this.#lastPicture = null
  }

  /** 插件卸载（进程要走了）：停掉自动调暗定时器与所有成功回落定时器。句柄与安全网由 transport 收尾。 */
  dispose = () => {
    if (this.#dimTimer) { clearInterval(this.#dimTimer); this.#dimTimer = null }
    for (const sid of [...this.#successTimers.keys()]) this.#cancelSuccessHold(sid)
  }
}
