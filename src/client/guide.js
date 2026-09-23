// dsh-omkb · client/src/guide.js
// 首次连接引导的**控制器**：盯着 /omkb/state 的 `open`，在「设备刚连上 + 用户还没看过」时
// 把引导弹出来，并把「已看过」落盘。
//
// 三条边界，都别越：
//
//  * **只读状态，不写 HID。** 它订阅的是 hid-bridge 的广播（每帧 /omkb/state 都发一次），
//    只取 `open` 一个字段。引导是纯界面，绝不参与按键分派 —— 这里多认一个字段，
//    就等于给「认不出来的事件」又开了一条通路（见 hid-bridge.js 顶部那段教训）。
//
//  * **`#shown` 是一次性闸门，与落盘解耦。** 判断只做一次：`#shown` 一旦为真，后面每帧
//    直接返回。为什么不能只靠「读回 prefs.guideSeen」：写盘是异步的，而广播 120ms 一帧，
//    用户点「跳过」之后的那几帧里 `guideSeen` 还是 false，只靠回读会让弹窗关掉又立刻弹回来
//    （看起来就像按钮点不动）。落盘失败时也保持 `#shown`：宁可这台浏览器少弹一次，
//    也不要每次刷新都糊用户一脸。
//
//  * **sticky 的 `seen` 由设置层负责。** 这里只管「要不要弹 / 现在第几屏」，写盘走
//    `scope.set('guideSeen', true)`（与设置页同一条持久化路径，落 ~/.dsh/settings.yaml）。
//    scope 没装配起来时（设置那一段装配失败）就**不弹** —— 弹了也记不住，不如不打扰。
//    这个取舍写在 `#canRemember()` 里，自检直接验它。
import { GUIDE_STEPS, nextStep, prevStep, shouldShowGuide } from './utils/guide.js'

/** 为什么没弹（诊断用，别让「怎么不弹了」只能靠猜）。 */
const WHY = {
  ready: 'ok',
  seen: '已看过（guideSeen=true）',
  offline: '设备未连接（/omkb/state.open !== true）',
  already: '本次页面会话里已经弹过',
  norecord: '设置作用域不可写，弹了也记不住',
  nodeps: '没有 hid 桥（收不到 /omkb/state 广播）'
}

export class GuideController {
  /** hid-bridge：取它只为订阅状态广播（见文件头「只读状态」）。 */
  #hid = null
  /** settingsScope 的绑定；`set` 不可用时整个引导不弹（见文件头）。 */
  #scope = null
  /** 最近一次偏好快照（只看 guideSeen；prefs 也直接给预览用）。 */
  #prefs = {}
  #open = false
  #step = GUIDE_STEPS[0]
  /** 一次性闸门：本次页面会话里已经弹过了。 */
  #shown = false
  #off = null
  #subs = new Set()

  constructor({ hid } = {}) {
    this.#hid = hid || null
  }

  /** 设置作用域（entry.js 的 UI 段装配好之后灌进来）。 */
  setScope = (scope) => { this.#scope = scope || null }

  /** 偏好快照（entry.js 的 refresh effect 每次变化都灌）。 */
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return
    const was = this.seen
    this.#prefs = prefs
    // 「重置布局」会把 guideSeen 清回 false —— 此刻要把一次性闸门也放开，
    // 否则「重置之后下次连上会再弹一遍」这条承诺只在刷新页面之后才成立。
    if (was && !this.seen) this.#shown = false
  }

  get open() { return this.#open }
  get step() { return this.#step }
  get prefs() { return this.#prefs }
  get shown() { return this.#shown }

  /** 用户看过没有（只看已落盘/已读回的值）。 */
  get seen() { return this.#prefs && this.#prefs.guideSeen === true }

  /**
   * 能不能把「已看过」记下来。
   * 记不住就不弹：弹窗的价值全在「只弹一次」，每次都弹的话它就从引导变成了骚扰。
   */
  #canRemember = () => !!(this.#scope && typeof this.#scope.set === 'function')

  /** 订阅「要不要弹 / 第几屏」的变化（供 React 重渲染）。 */
  subscribe = (fn) => {
    if (typeof fn !== 'function') return () => {}
    this.#subs.add(fn)
    return () => { this.#subs.delete(fn) }
  }

  #emit = () => { for (const fn of [...this.#subs]) { try { fn() } catch (e) {} } }

  /** 开始盯设备状态（由 ctx.effect 管生命周期）。幂等：重复调用不会叠订阅。 */
  start = () => {
    if (this.#off) return true
    if (!this.#hid || typeof this.#hid.subscribe !== 'function') return false
    this.#off = this.#hid.subscribe(this.#onState)
    return true
  }

  stop = () => {
    if (this.#off) { this.#off(); this.#off = null }
  }

  /**
   * 每帧 /omkb/state 都会走这里 —— 所以第一件事就是短路，
   * 别让一个纯界面的判断跑在 120ms 的热路径上做大动作。
   */
  #onState = (s) => {
    if (this.#shown || this.#open) return
    const open = !!(s && s.open === true)
    if (!this.#canRemember()) return
    if (!shouldShowGuide({ open, seen: this.seen })) return
    this.#shown = true
    this.#step = GUIDE_STEPS[0]
    this.#open = true
    this.#emit()
  }

  /** 关掉引导并**记住**（走完 / 跳过 / 右上角 × 都是这条路）。 */
  dismiss = () => {
    if (!this.#open) return false
    this.#open = false
    // 本地先把 seen 立起来：写盘回读要几拍，这期间若有渲染也不能再弹。
    if (!this.seen) this.#prefs = { ...this.#prefs, guideSeen: true }
    this.#emit()
    this.#remember()
    return true
  }

  #remember = () => {
    const sc = this.#scope
    if (!sc || typeof sc.set !== 'function') return false
    try {
      // 与设置页同一条写入路径；失败时 promise 仍会 resolve（见 settings.js 的注释），
      // 所以这里不看返回值 —— 成败靠下次页面加载时「还弹不弹」自然体现。
      Promise.resolve(sc.set('guideSeen', true)).catch(() => {})
      return true
    } catch (e) { return false }
  }

  /** 下一屏（已经在最后一屏时无动作）。 */
  next = () => {
    if (!this.#open) return false
    const to = nextStep(this.#step)
    if (to === this.#step) return false
    this.#step = to
    this.#emit()
    return true
  }

  /** 上一屏（已经在封面时无动作）。 */
  back = () => {
    if (!this.#open) return false
    const to = prevStep(this.#step)
    if (to === this.#step) return false
    this.#step = to
    this.#emit()
    return true
  }

  /**
   * 从头重放（设置页里的「重新播放引导」）。
   * 与 `#onState` 的区别：**不查 seen、不看设备**——用户明确要再看一次。
   * 也不动 `guideSeen`：重放不是「没看过」，关掉之后仍然不再自动弹。
   */
  replay = () => {
    this.#step = GUIDE_STEPS[0]
    this.#open = true
    this.#shown = true
    this.#emit()
    return true
  }

  /** 诊断快照：`__dshOmkb.services.guide.diagnose()` 直接答「为什么没弹」。 */
  diagnose = () => {
    let why = WHY.ready
    if (this.#shown || this.#open) why = WHY.already
    else if (!this.#hid || typeof this.#hid.subscribe !== 'function') why = WHY.nodeps
    else if (!this.#canRemember()) why = WHY.norecord
    else if (this.seen) why = WHY.seen
    // 前提都满足却还开着 → 只是这一帧设备没连上（或刚断开）
    else why = WHY.offline
    return {
      shown: this.#shown, open: this.#open, step: this.#step,
      seen: this.seen, canRemember: this.#canRemember(), why
    }
  }
}
