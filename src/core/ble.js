// dsh-micro · core/ble.js
// **装配门面** —— 原先那个上千行的单体（HID 传输 + 协议解析 + 输入翻译 + 灯态状态机全塞在一个
// 类里）按职责拆成了四个模块，这里只剩「把它们接起来」这一件事：
//
//   · ./protocol.js  **线格式契约**：HID_ACT / STATUS_METHOD / AGENT_ST / BLACKOUT_SLOTS 与
//                    电量/状态的纯解析函数（无状态、无副作用、不碰设备）。
//   · ./transport.js **HID 传输**：node-hid 打开/分帧/写回、30 秒重连、兜底探活、退出安全网。
//   · ./leds.js      **灯态状态机**：期望灯态 + 结果态 ⇒ 实际灯态，同拍合并 / 内容去重 / 结果态
//                    窗口三道防线，亮度与空闲自动调暗。
//   · ./input.js     **输入翻译**：一行 JSON → 状态快照里的按键/旋钮/摇杆/电量事实。
//
// 本文件保留**对外门面不变**（`BleController` 的公有落点 + `createBleReader` 的 13 个字段），
// 并把 protocol.js 的全部符号**再导出**（`export *`）—— 自检与其它模块照旧 `from './ble.js'` 取
// HID_ACT / parseDeviceStatus / AGENT_ST / BLACKOUT_SLOTS 等，一个字都不用改。
//
// 三块拼图的依赖是**回调 + 后注入**，没有环：
//   input → leds（markActivity / wake）
//   transport → 上层回调 onLine / onOpened / onBlackout
//   leds → transport（构造后 attach，因为 transport 的构造又依赖 leds 的 lightsOff）
//   安全网的 release/blackout 闭包指向**本类**的 this.close()/this.blackout()：
//   它们是公有类字段、可被自检替换，安全网必须调它们（见 test/lib/exit-guard-child.mjs）。

import { HidTransport } from './transport.js'
import { LedEngine } from './leds.js'
import { InputParser } from './input.js'
import { logSink } from './log.js'

export * from './protocol.js'

export class BleController {
  // ---------- 状态：计数器 + 连接状态 + 灯光配置，暴露给浏览器客户端 ----------
  // 关键：**每个输入源都有自己的累加计数器**，浏览器据此归属事件，而不是靠 t 猜。
  // t 只是「发生过一件事」的全局计数，而设备状态字段会被后续事件覆盖（推完立刻松手，
  // 轮询那一刻 joy 已经回中），拿它当「事件类型」用必然误判——曾经的后果是旋钮/摇杆
  // 操作被当成「麦克风键」而触发语音输入（见 src/client/hid-bridge.js 顶部注释）。
  //   enc      带符号累计步数 → 旋钮旋转（差值即步数）
  //   knobPress           计数 → 旋钮按下（点击；不受去抖影响）
  //   knobLong            计数 → 旋钮长按（≥500ms，见 input.js 的 KNOB_LONG_MS）→ 打开本插件设置页
  //   joyPush/joyDir      计数 + 最近一次有效方向 → 摇杆推了一次（回中不计，方向不走丢）
  //   joyT                含回中的方向变化计数（老客户端用，语义保持不变）
  //   joyA / joyD         原始角度(0..1，0=右、顺时针) + 推力(0..1) —— **纯回显**：客户端拿它画
  //                       摇杆那张实时小卡片（src/client/joystick-hud.js）。不参与任何事件归属，
  //                       也不该被谁拿来判断「推了一次」（那是 joyPush 的活）。
  //   down / keyAct       **当前按住的键** + 本次事件的边沿（见 protocol.js 的 HID_ACT）。
  //   battery / charging  设备的**电平型**状态（device.status 上报，见 protocol.js 的
  //                       parseDeviceStatus）。故意**不给它配计数器**：断开时清成 null/false。
  // 这份字面量**原样搬自拆分前的 ble.js**，三个模块共用同一个对象（各持引用），
  // 谁写哪几个字段的分工见各模块顶部的说明。
  #state = { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, knobLong: 0, joy: null, joyA: null, joyD: 0, joyT: 0, joyPush: 0, joyDir: null, agents: [], outcomes: [], idle: null, agentsCurrent: null, agentsCurrentKnown: false, keyT: {} }
  #logger
  #diagnostics = null
  #leds = null
  #input = null
  #transport = null
  /**
   * 「状态可能变了」的订阅者（见 onChange）。目前只有状态推送（./server/state-socket.js）
   * 一个消费者。
   */
  #listeners = new Set()

  constructor({ logger, diagnostics } = {}) {
    this.#logger = logger
    this.#diagnostics = typeof diagnostics === 'function' ? diagnostics : null
    // 装配顺序被三处依赖钉死：
    //   ① leds 先生成（它是灯的主人，transport 的 onBlackout 要调它）；
    //   ② input 拿 leds 的引用（按键要 markActivity / wake）；
    //   ③ transport 最后建，用回调把三块接起来，再由 leds.attach 反向注入（破环）。
    this.#leds = new LedEngine({ logger, state: this.#state })
    this.#input = new InputParser({ logger, state: this.#state, leds: this.#leds })
    this.#transport = new HidTransport({
      logger,
      state: this.#state,
      onLine: (line) => { this.#input.handleLine(line); this.#notify() },
      onOpened: () => { this.#leds.replayAgents(); this.#notify() },
      // 设备掉线（node-hid 的 'error'）走**本类**的 close —— 不能只让 transport 关自己的句柄。
      // 用户 2026-09-28 报的「断开重连后灯全灭」就出在这里：漏掉 leds.resetOnDisconnect 之后，
      // 「上次写出去的是什么」还留着，重连时那句重放被内容去重当成重复挡下 → 一条都不写。
      onClosed: () => this.close(),
      onBlackout: () => this.#leds.lightsOff(),
      // 安全网的两个落点 —— **必须闭包指向本类的公有字段**（close / blackout）。它们都是公有类
      // 字段、可被自检整套替换（test/lib/exit-guard-child.mjs 就这么观测「到底灭没灭灯」）；
      // 若这里改调私有实现或 transport 自己的方法，那种替换就观测不到了。
      // ⚠ blackout 必须排在 release **之前**执行（由安全网保证）—— 释放会关掉句柄。
      guard: {
        release: () => this.close(),
        blackout: () => this.blackout(),
        log: (m) => this.#warn(m)
      }
    })
    this.#leds.attach(this.#transport)
  }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; logSink.warn(...a) }

  get state() { return this.#state }

  /**
   * 订阅「状态可能变了」的通知（**状态推送**用，见 ./server/state-socket.js）。
   *
   * 语义是**提示**、不是快照：回调不带参数，收到就自己去 `snapshot()` 取最新的一份
   * ——「变了什么」由订阅方自己比对（推送那边本来也不做内容去重，见 state-socket.js）。
   *
   * 通知点只覆盖**外部驱动**的变更：设备每一行上报、连接/断开、门面上的六个方法
   * （applyConfig / setPrefs / applyAgents / reportError / reportSuccess / clearOutcome）。
   * **灯效定时器路径（自动调暗、成功绿灯回落的 setTimeout）故意不挂** —— 它们各自有
   * 500ms 心跳兜底，为它们在各模块里布通知点只会把两个模块耦在一起。
   *
   * @param {Function} fn - 收到通知的回调。
   * @returns {() => void} 退订（幂等）。
   */
  onChange = (fn) => {
    if (typeof fn !== 'function') return () => {}
    this.#listeners.add(fn)
    return () => { this.#listeners.delete(fn) }
  }

  /**
   * 广播一次「可能变了」。**必须用原型方法语法**（不是箭头类字段）：本类历史上踩过
   * 「私有字段在初始化前被箭头字段闭包捕获」→ `Cannot read from private field`
   * （见项目备忘）；原型方法不存在这个初始化顺序问题。
   */
  #notify() {
    if (!this.#listeners.size) return
    for (const fn of [...this.#listeners]) { try { fn() } catch (e) {} }
  }

  /**
   * 自检用：拿到退出安全网句柄。**只给自检脚本用**（`test/verify_exit_guard.js` 用它
   * 在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）；运行时不调用，
   * 真机路径上安全网由 transport 的 open() 自己 install()。
   */
  get exitGuard() { return this.#transport.exitGuard }

  /**
   * 测试注入：把一行 JSON 当作设备上报处理（与 HID 数据帧走同一条解析路径）。
   * 只给自检脚本用（verified 摇杆/按键链路）；运行时不调用。
   * @param line - 一行 JSON 文本（可带尾随换行）。
   * @returns {void}
   */
  feedLine = (line) => { this.#input.handleLine(String(line)); this.#notify() }

  // 状态快照 = 硬件状态 + 可选诊断。诊断由宿主注入（目前是设置持久化是否在线）：
  // 终端里的 logger 输出不一定会落到 stdout，把关键结论挂到 /micro/state 上，
  // 排查时一条 curl 就能看到，不用重启终端或翻日志。
  // 公开给 server/：GET /micro/state 的 handler 调它取「带诊断面」的快照。
  snapshot = () => {
    if (!this.#diagnostics) return this.#state
    try { return { ...this.#state, settings: this.#diagnostics() } } catch (e) { return this.#state }
  }

  open = () => this.#transport.open()

  close = () => {
    // 断开**刻意不关灯**（随时会发生、也随时会重连，在这儿关灯换来的只是「重连之后黑一片」）。
    // 三块各自收自己的账：句柄/链路归 transport，按住集合归 input，灯态与电量归 leds
    // （后者见 leds.js 的 resetOnDisconnect —— 「谁清待写内容谁就得忘了上次写出去的样子」）。
    this.#transport.close()
    this.#input.resetHeld()
    this.#leds.resetOnDisconnect()
    this.#notify()
  }

  // 手动重连（公开给 server/：/micro/reconnect 的 handler 调它）。
  reconnect = () => {
    this.close()
    this.open()
  }

  /**
   * 灭灯的唯一对外落点（自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」—— 而真正的写灯实现在 leds.js（私有），从外面换不掉。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => this.#transport.blackout()

  // 应用来自设置面板的配置补丁（公开给 server/：POST /micro/config）。
  // 六个门面方法的返回值一律**原样透传**（index.js 会读 reportError / clearOutcome 的布尔），
  // 通知只是捎带的一步。
  applyConfig = (patch) => { const r = this.#leds.applyConfig(patch); this.#notify(); return r }

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  setPrefs = (prefs) => { const r = this.#leds.setPrefs(prefs); this.#notify(); return r }

  // 来自设置面板的 Agent 键 LED 配置（公开给 server/：POST /micro/agents）。
  applyAgents = (payload) => { const r = this.#leds.applyAgents(payload); this.#notify(); return r }

  // 结果态：某个会话失败（红）/ 跑完一轮（成功）/ 重新开始运行（收掉）。由宿主总线驱动。
  reportError = (sessionId) => { const r = this.#leds.reportError(sessionId); this.#notify(); return r }

  reportSuccess = (sessionId) => { const r = this.#leds.reportSuccess(sessionId); this.#notify(); return r }

  clearOutcome = (sessionId) => { const r = this.#leds.clearOutcome(sessionId); this.#notify(); return r }

  dispose = () => {
    // 插件卸载（进程要走了）：三块各自收尾，顺序有两条硬约束 ——
    //   ① 停掉自动调暗定时器（leds.dispose）—— 别让一条灯效把进程留住；
    //   ② **灭灯必须排在 close() 之前**（用户 2026-09-25 要求）：唯一出口要看到活着的句柄
    //      才写得出去；灯是设备自己记着的，进程一走没人替我们关。
    // 另一个落点是**退出安全网**（Ctrl+C/SIGTERM/SIGHUP）—— 宿主优雅关闭那条路未必走到这里。
    this.#leds.dispose()
    this.blackout()
    this.#transport.dispose()
    this.close()
  }
}

/**
 * 创建 HID 读取器。
 *
 * 这里可以放心用解构形参，但前提是宿主构建关掉了 tree-shaking（见 vite.core.config.js）：
 * rollup 会按「被调用方的解构形参」裁剪对象字面量实参，`createBleReader({ logger, diagnostics })`
 * 遇上只解构 logger 的工厂会被打包成 `createBleReader({ logger })`——多传的选项静默消失
 * （源码里有、产物里没有、不报错）。若哪天重新打开 tree-shaking，这里要么改成不透明形参
 * `(options = {}) => new BleController(options)`，要么记得验证产物。
 * @param {{ logger?: any, diagnostics?: Function }} [options] - logger 与可选诊断回调。
 * @returns 读取器门面。
 */
export const createBleReader = ({ logger, diagnostics } = {}) => {
  const ctl = new BleController({ logger, diagnostics })
  return {
    open: ctl.open,
    close: ctl.close,
    reconnect: ctl.reconnect,
    setPrefs: ctl.setPrefs,
    applyAgents: ctl.applyAgents,
    applyConfig: ctl.applyConfig,
    reportError: ctl.reportError,
    reportSuccess: ctl.reportSuccess,
    clearOutcome: ctl.clearOutcome,
    // 测试注入（自检脚本用它喂摇杆帧，见 feedLine）；宿主运行时不用。
    feedLine: ctl.feedLine,
    // 状态推送的挂点（见 ./server/state-socket.js）：回调不带参数，自己去 snapshot() 取最新一份。
    onChange: ctl.onChange,
    dispose: ctl.dispose,
    state: ctl.state,
    snapshot: ctl.snapshot
  }
}