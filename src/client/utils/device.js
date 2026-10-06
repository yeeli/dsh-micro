// dsh-micro · client/src/utils/device.js
// **设备层面的纯逻辑**：电量怎么显示、什么状态算「这台键盘被移除了」、移除要清哪些字段。
//
// 为什么单拎出来：这几条规则要么会在真机上悄悄失效（「移除之后刷新又冒出来」「没连上也显示电量」），
// 要么是**破坏性操作**的一部分（移除=清空全部偏好）。放进 utils/ 才能被自检直接 import ——
// 判据文件不碰 DOM、不碰 DSVI、不碰控制器状态，node 里跑得起来。
//
// 另外两个**接线常量**也住这里（端点地址 + 充电追问间隔）：它们与下面那几条判据是同一个功能的
// 参数，且同样要被自检按**值**验（见 test/verify_device.js）—— 写在 .jsx 里就进不了 node 了。

/** 低电量阈值（%）：到这个数及以下就用告警色（参考产品那张图里 12% 是红的）。 */
export const BATTERY_LOW_PCT = 20

/**
 * 「向设备要一次状态」的宿主端点（POST）。
 *
 * 为什么需要这一条：设备**不会**自己定时推状态（见 src/core/transport.js 的 #requestStatus），
 * 宿主手上那份读数是「上次被问时」的值 —— 用户打开设置页看电量时，屏幕上那份可能已经是
 * 几分钟前的，而界面完全看不出来。所以打开这一页就先问一次（用户 2026-10-06 要求）。
 *
 * ⚠ 别与 `/micro/state` 混了：那条读**宿主手上**的快照（被动、只读），这条是**主动问设备**。
 */
export const DEVICE_STATUS_URL = '/micro/status'

/**
 * 充电中「继续追问状态」的间隔（ms）—— 10 分钟。
 *
 * 只服务于充电这一种情形（**不充电时一条都不发**）：充电时电量变化最快，也是用户最想盯着的
 * 时刻；而放电时读数几十分钟才动 1%，追着问只是白白占着蓝牙链路。
 * 10 分钟这个量级按「充电 5%–10%/10min」估的 —— 每次追问都看得见变化，又不至于打扰设备。
 */
export const CHARGE_POLL_MS = 10 * 60 * 1000

/**
 * 设置文件里记「这台键盘已被移除」的字段名。
 * 为什么它必须住在设置里而不是 localStorage：隐藏得活过刷新与换浏览器，
 * 否则「移除」只生效到下次刷新，用户看到的就是「点了没用」。
 */
export const REMOVED_KEY = 'removed'

/**
 * 写入回读的重试策略（**写入算不算成功**的唯一口径，设置页与控制台共用）。
 *
 * DSH 客户端 `scope.set()` 在「命名空间未注册 / 只读 / 校验失败」时同样会 resolve，
 * 光挂 then/catch 会把失败显示成「已保存」（历史上真的这么错过）。
 * 所以成败一律以**回读到的快照**为准；而镜像刷新要几拍，读一次常常读到上一版。
 */
export const SCOPE_RETRY = { tries: 4, delayMs: 120 }

/**
 * 回读快照的准入判据：必须「已就绪 + 还写着」（unavailable = 命名空间没注册，写入必定被丢弃）。
 * @param snap - `scope.getSnapshot()` 的产物。
 * @returns {boolean}
 */
export const readbackOk = (snap) => !!snap && snap.status === 'ready' && snap.writable !== false

/** 快照里的值对象（拿不到就给空对象，调用方不必到处判空）。 */
export const snapValue = (snap) => (snap && snap.value && typeof snap.value === 'object' ? snap.value : {})

/** 深比较（写入回读时比字段值；比 JSON 文本足够且不引依赖）。 */
export const sameJson = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch (e) { return false }
}

/**
 * 电量读数归一化。宿主已经归一过一遍（见 src/core/ble.js 的同名函数），这里**再挡一道**：
 * 客户端要兼容不认识新字段的老宿主（`undefined`），也可能撞上被别的客户端写坏的快照。
 * 布尔值必须拒掉 —— `Number(true) === 1`，不挡的话 `charging` 被误当电量就是「1%」。
 * @param v - 来自 /micro/state 的 battery 字段。
 * @returns {number|null} 0..100 的整数，或 null（不知道）。
 */
export const normalizeBattery = (v) => {
  if (typeof v === 'boolean' || v === null || v === undefined || v === '') return null
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 100) return null
  return Math.round(n)
}

/**
 * 电量 → 界面要用的那几个结论（面板只管照着画，不再自己判断据）。
 * @param state - `{ battery, charging }`（来自 /micro/state）。
 * @returns {{known: boolean, pct: number|null, charging: boolean, low: boolean}}
 *   known —— 到底有没有读数（没有就显示「—」，不显示一个假数字）；
 *   low   —— 要不要用告警色。**充电时不告警**：红色说的是「该去充电了」，
 *            而插上电这件事已经有人管了，这时候还红着只会让人以为出了问题。
 */
export const batteryView = (state = {}) => {
  const pct = normalizeBattery(state && state.battery)
  const charging = !!(state && state.charging === true)
  const known = pct !== null
  return { known, pct, charging, low: known && !charging && pct <= BATTERY_LOW_PCT }
}

/**
 * 界面该不该收起来（隐藏设置页分区 + 侧边栏入口）。
 *
 * 判据是**两件事同时成立**：用户点过「移除」，**且此刻设备没连上**。
 *   - 没连上 → 这台键盘现在不在这台机器上，界面收起来（用户不用它了）；
 *   - 又连上了 → 显然还在用，界面立刻回来（并把 removed 清掉，见 device.js）。
 * `open` 严格等于 true 才算连上（老宿主缺这个字段 → 当作没连上，与 utils/guide.js 同一档）。
 * @param {{removed?: boolean, open?: boolean}} state
 * @returns {boolean}
 */
export const isDeviceHidden = (state = {}) =>
  !!(state && state.removed === true && state.open !== true)

/**
 * 侧边栏入口该不该挂「断开」红点（2026-09-24）。
 *
 * 判据是**两件事同时成立**：已经听到宿主说过设备状态（`known`），**且**它说的不是「连上了」。
 *
 * 为什么必须带 `known`：页面刚加载时谁都还没说话，`open` 天然是 false —— 只看它的话，
 * 每次刷新都会先闪一下红点，那是在喊一个还不知道真假的结论（跟电量读不出来就显示「—」
 * 是同一档纪律：不知道就不说）。所以「从没听过消息」与「听说过、它说没连上」必须分开。
 * @param {{known?: boolean, open?: boolean}} state
 * @returns {boolean} true = 确实断开，界面该提示「重新连接」。
 */
export const isDeviceOffline = (state = {}) =>
  !!(state && state.known === true && state.open !== true)

/**
 * 「移除键盘」要清掉哪些设置字段 = 全部偏好，**除了 removed 自己**。
 * 它既是判据也是操作对象：清掉它就没法记住「已经移除」，下次刷新界面又回来了。
 * 从 defaults 推导而不是手写第二份清单 —— 以后加偏好字段时不会漏（自检守着这条）。
 * @param defaults - `DSVI.MICRO_DEFAULTS`（与宿主 schema 逐字段对齐的那份）。
 * @returns {string[]} 需要 unset 的字段名。
 */
export const removeKeys = (defaults) =>
  Object.keys(defaults && typeof defaults === 'object' ? defaults : {})
    .filter((k) => k !== REMOVED_KEY)
