// dsh-omkb · client/src/device.js
// **设备级状态的控制器**：管「这台键盘被移除了没有」这件事 —— 移除动作本身（清空全部偏好 +
// 立标记）、被移除时把界面收起来、以及设备重新连上后自动恢复。
//
// 三条边界：
//
//  * **电量不在这里。** 它是 /omkb/state 的一个电平字段，设置页自己就在轮询那个端点
//    （1s 一次，见 components/settings-panel.jsx），再经这里转一手只是多一条通路。
//    这里只订阅 `open` 一个字段 —— 移除之后的恢复判据只需要它；顺带把「听到过宿主说话没有」
//    记成 `known`，给侧边栏那个「已断开」的红点用（判据在 utils/device.js 的 isDeviceOffline）。
//
//  * **判据在 utils/device.js，这边只管接线与落盘。** 「什么算被移除」「要清哪些字段」
//    都是纯函数，自检直接 import 它们验（见 test/verify_device.js）；控制器里不留第二份判断。
//
//  * **成败以回读为准，不乐观改本地态。** `scope.set()` 在命名空间没注册时也会 resolve，
//    所以 remove() 写完必须回读确认**真的落盘**了，再把界面收起来 —— 否则会出现
//    「界面消失了、其实什么都没写、一刷新又回来了」这种最气人的假成功。
//    （唯一的例外是重连后的自动恢复：那里乐观改本地态是有意的，见 #restore 的注释。）
//
// 与 guide.js 的关系：两者都订阅同一份 /omkb/state 广播，互不干扰。移除会**清掉 guideSeen**
// （「移除 = 把这台键盘的痕迹清干净」，用户 2026-09-23 明确选的），于是重连之后首次连接引导
// 会像新装一样再弹一次 —— 这是设计，不是 bug。
import { REMOVED_KEY, SCOPE_RETRY, isDeviceHidden, isDeviceOffline, readbackOk, removeKeys, sameJson, snapValue } from './utils/device.js'

/** 为什么界面是现在这样（诊断用；`__dshOmkb.services.device.diagnose()`）。 */
const WHY = {
  visible: 'ok（界面正常显示）',
  hidden: '已被移除 + 设备没连上 → 界面收起',
  connected: '设备已连上 → 界面显示（removed 会被自动清掉）',
  nodeps: '没有 hid 桥（收不到 /omkb/state 广播）',
  noscope: '设置作用域不可写（移除/恢复都无法落盘）'
}

export class DeviceController {
  /** hid-bridge：只取它订阅状态广播（读 `open`）。 */
  #hid = null
  /** settingsScope 的绑定（entry.js 的 UI 段装配好之后灌进来）。 */
  #scope = null
  /** 与宿主 schema 逐字段对齐的默认值（清空偏好要用它）。 */
  #defaults = {}
  /** 最近一次偏好快照（只看 removed）。 */
  #prefs = {}
  #open = false
  /**
   * 已经收到过宿主的状态帧没有（2026-09-24）。
   *
   * 为什么要它：`open` 的初值是 false，而「从没听过宿主说话」与「听说过、它说没连上」
   * 对界面是两件事 —— 前者不该挂「已断开」的红点，否则每次刷新都会先闪一下
   * （见 utils/device.js 的 isDeviceOffline）。
   */
  #seen = false
  #off = null
  #subs = new Set()
  /**
   * 正在清 removed（防重入）。广播 120ms 一帧、写盘要几拍，不挡的话每帧都会再写一次；
   * 失败后**不立刻重试**，等下一次「连上」的边沿再试（见 #onState）——
   * 那说明作用域暂时写不进去，每 120ms 重试一轮只会在控制台刷屏。
   */
  #restoring = false
  /** 恢复写盘失败过（只在控制台提醒一次）。 */
  #restoreWarned = false

  constructor({ hid, defaults } = {}) {
    this.#hid = hid || null
    if (defaults && typeof defaults === 'object') this.#defaults = defaults
  }

  /** 设置作用域（entry.js 的 UI 段）。 */
  setScope = (scope) => { this.#scope = scope || null }

  /** 默认值（entry.js 灌 DSVI.OMKB_DEFAULTS；与设置页/宿主同一份）。 */
  setDefaults = (defaults) => { if (defaults && typeof defaults === 'object') this.#defaults = defaults }

  /** 偏好快照（entry.js 的 refresh effect 每次变化都灌）。 */
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return
    const was = this.hidden
    this.#prefs = prefs
    // 「移除」是落盘字段：设置页那边写成功之后镜像一变，这里就要跟着把界面收掉/放出来。
    if (was !== this.hidden) this.#emit()
  }

  /** 用户点过「移除」没有（只看已落盘/已读回的值）。 */
  get removed() { return this.#prefs && this.#prefs[REMOVED_KEY] === true }
  /** 设备此刻连上没有（严格等 true）。 */
  get open() { return this.#open }
  /** 已经收到过宿主的状态帧没有（false = 还不知道设备在不在 → 界面一律按正常画）。 */
  get known() { return this.#seen }
  /** 界面该不该收起来（判据在 utils/device.js）。 */
  get hidden() { return isDeviceHidden({ removed: this.removed, open: this.#open }) }

  /** 订阅「隐藏与否」的变化（侧边栏入口、设置页导航行都靠它）。 */
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
   * 每帧 /omkb/state 都会走这里（120ms），所以先比再发，不做多余的重渲染。
   */
  #onState = (s) => {
    const open = !!(s && s.open === true)
    // **第一帧无条件广播**：页面加载时 #open 天然是 false，若这一帧也是「没连上」，
    // 按「变了才发」永远发不出去 —— 于是「一打开就已经断开」这种情况里，
    // 侧边栏那个红点再也不会出现（要等设备连上一次又断开才补得上）。第一帧必须表态。
    const first = !this.#seen
    this.#seen = true
    if (first || open !== this.#open) {
      this.#open = open
      // 新的一次「连上」= 重新给恢复写盘一次机会（上一轮失败过也不再管它，见 #restoring）
      if (open) this.#restoring = false
      this.#emit()
    }
    // 连上了 = 这台键盘还在用 → 撤销「移除」（清掉标记，界面就回来了）
    if (open && this.removed) this.#restore()
  }

  #snapshot = () => {
    try {
      return this.#scope && typeof this.#scope.getSnapshot === 'function' ? this.#scope.getSnapshot() : null
    } catch (e) { return null }
  }

  /** 回读重试：镜像刷新要几拍，读一次常常还读到上一版（判据与设置页同源）。 */
  #readBack = (check, tries = SCOPE_RETRY.tries) => new Promise((resolve) => {
    let left = tries
    const attempt = () => {
      const snap = this.#snapshot()
      if (readbackOk(snap) && check(snap)) { resolve(true); return }
      left -= 1
      if (left <= 0) { resolve(false); return }
      setTimeout(attempt, SCOPE_RETRY.delayMs)
    }
    attempt()
  })

  /** 清掉一个字段的用户层覆盖（回落 schema 默认）；老客户端没有 unset 时就写默认值。 */
  #unset = async (key) => {
    const sc = this.#scope
    if (!sc) return
    try {
      if (typeof sc.unset === 'function') await sc.unset(key)
      else await sc.set(key, this.#defaults[key])
    } catch (e) {}
  }

  /**
   * 「移除这台键盘」：清空**全部**偏好，再记下 removed。
   *
   * 顺序要紧：先清偏好、最后立标记。反过来的话中途失败会留下「界面没了、偏好还在」的
   * 中间态，而用户看到的是「已经移除了」。
   *
   * 收界面**只在回读确认之后**（见文件头第三条）：落盘没成就不该把界面收掉。
   * @returns {Promise<boolean>} 是否真的落盘成功。
   */
  remove = async () => {
    const sc = this.#scope
    if (!sc || typeof sc.set !== 'function') return false
    const before = this.#snapshot()
    if (before && before.status === 'unavailable') return false // 命名空间没注册，写了必丢
    const keys = removeKeys(this.#defaults)
    for (const key of keys) await this.#unset(key)
    try { await sc.set(REMOVED_KEY, true) } catch (e) {}
    const ok = await this.#readBack((snap) => {
      const v = snapValue(snap)
      // 「清掉了」有两种同样正确的样子：DSH 的镜像会把 schema 默认值补齐（unset 之后读回来
      // 是默认值），而有的版本干脆不返回这个字段。**两种都算成功** —— 只认前者的话，
      // 换个 DSH 版本就会把「写成功了」判成失败，界面收不起来。
      return v[REMOVED_KEY] === true &&
        keys.every((k) => v[k] === undefined || sameJson(v[k], this.#defaults[k]))
    })
    if (ok) {
      this.#prefs = { ...this.#prefs, [REMOVED_KEY]: true }
      this.#emit()
    }
    return ok
  }

  /**
   * 设备重新连上 → 撤销「移除」。
   *
   * 这里**故意乐观**：先把本地态改成「没被移除」并广播，界面立刻回来，写盘在后台做。
   * 理由与 remove() 相反 —— 写失败的后果不一样：只要设备连着，`hidden` 恒为 false，
   * 界面本来就是对的；写失败唯一的影响是「以后拔掉设备会再收一次界面」，所以只提醒一行。
   * 反过来（等写盘回读再放行）会出现「键盘明明已经连上了，界面还要等半秒才回来」。
   */
  #restore = () => {
    if (this.#restoring) return false
    const sc = this.#scope
    if (!sc || typeof sc.set !== 'function') return false
    this.#restoring = true
    this.#prefs = { ...this.#prefs, [REMOVED_KEY]: false }
    this.#emit()
    const run = typeof sc.unset === 'function' ? () => sc.unset(REMOVED_KEY) : () => sc.set(REMOVED_KEY, false)
    Promise.resolve()
      .then(run)
      .then(() => this.#readBack((snap) => snapValue(snap)[REMOVED_KEY] !== true))
      .then((ok) => {
        if (ok || this.#restoreWarned) return
        this.#restoreWarned = true
        try { console.warn('[omkb] 设备已重连，但没能把「已移除」标记写回设置（界面照常显示，只是下次拔掉设备会再收起来一次）') } catch (e) {}
      })
      .catch(() => {})
    return true
  }

  /** 诊断快照：直接答「界面为什么是这个样子」。 */
  diagnose = () => {
    let why = WHY.visible
    if (!this.#scope || typeof this.#scope.set !== 'function') why = WHY.noscope
    else if (!this.#hid || typeof this.#hid.subscribe !== 'function') why = WHY.nodeps
    else if (this.hidden) why = WHY.hidden
    else if (this.removed && this.#open) why = WHY.connected
    return {
      open: this.#open,
      known: this.#seen,
      offline: isDeviceOffline({ known: this.#seen, open: this.#open }),
      removed: this.removed,
      hidden: this.hidden,
      canWrite: !!(this.#scope && typeof this.#scope.set === 'function'),
      restoring: this.#restoring,
      clearKeys: removeKeys(this.#defaults),
      why
    }
  }
}
