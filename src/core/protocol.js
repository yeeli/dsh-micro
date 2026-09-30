// dsh-micro · core/protocol.js
// **跨进程的线格式契约** —— 设备协议里那些「宿主与客户端、宿主与设备双方逐字一致」的
// 常量与纯解析函数。从 ble.js 分拆出来，因为它与「谁持有 HID 句柄」无关：
//   · 按键边沿词表 HID_ACT（浏览器按它区分「还按着」与「已经松开」）；
//   · 槽位状态码 AGENT_ST（浏览器 agents.js 的 AGENT_STATE 必须逐字一致）；
//   · 电量归一化/状态解析（纯函数，自检直接喂 JSON 验，见 test/verify_device.js）；
//   · 全灭槽位 BLACKOUT_SLOTS（关闭前写给设备的最后一份 thstatus）。
//
// 这里**没有状态、没有副作用、不碰设备** —— 任何一处改动都必须整条链一起看
// （加/删字段两边词表要同步，设备不会报错，只会按一个没人认得的数去分支）。

/**
 * 设备上报的 `params.act` —— **按键边沿**（一个物理键发一对事件）：
 *   1 = 按下、0 = 松开、2 = 脉冲（旋钮转过一格的瞬时事件，没有“按住”态）。
 * 长这样：`{"method":"v.oai.hid","params":{"k":"AG00","act":1,"ag":0}}`。
 * 老固件不带这个字段 → 一律按“按下”处理，行为与引入它之前逐字一致。
 */
export const HID_ACT = { RELEASE: 0, PRESS: 1, PULSE: 2 }

/**
 * 设备状态上报的 method 名（电量就住在它的 params 里）：
 *   `{"method":"device.status","params":{"battery":12,"is_charging":false}}`
 * 和其它上报一样走 RPC 通道（channel=2），与按键/摇杆共用同一条 JSON 行流。
 */
export const STATUS_METHOD = 'device.status'

/**
 * 电量百分比：**认不出来就返回 null**，绝不猜。
 *   - 0..100 的数字（或能转成数字的字符串）→ 四舍五入的整数；
 *   - 越界（负 / >100）→ null。固件真给了 255 这种「未知」编码时，界面上显示「—」
 *     比显示一个凭空的 100% 诚实；
 *   - 布尔值**必须拒掉**：`Number(true) === 1`，不挡的话 `is_charging` 被误当电量就是「1%」。
 * @param v - 设备给的原始值。
 * @returns {number|null} 0..100 的整数，或 null。
 */
export const normalizeBattery = (v) => {
  if (typeof v === 'boolean' || v === null || v === undefined || v === '') return null
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 100) return null
  return Math.round(n)
}

/** 是否在充电：只认真正的布尔与 0/1，其余（undefined / 字符串）一律当「没在充」。 */
export const normalizeCharging = (v) => v === true || v === 1

/**
 * 从一条设备上报里取状态（**纯函数**，自检直接喂 JSON 验它，见 test/verify_device.js）。
 *
 * 认两条路：
 *   ① method 就是 `device.status`（大小写不敏感；允许厂商前缀，如 `v.oai.device.status`
 *      —— 已有上报都叫 `v.oai.*`，固件换个命名空间不该让界面永远显示「—」）；
 *   ② 任何 method，只要载荷里带着**合法**的 battery —— 电量只可能来自设备状态，
 *      多认这一条能省掉一次「固件改了 method 名 → 电池行一直空着」的排查。
 * 载荷取 `params`（设备主动上报的通知）**或** `result`（我们发了 RPC 之后设备给的应答）：
 * 宿主连上时会主动发一条 `device.status` 去问（见 transport.js #requestStatus），设备很可能按
 * JSON-RPC 的规矩回 `{"id":N,"result":{...}}` —— 那种消息**没有 method**，只认 `params` 就会把
 * 应答整条丢掉，界面永远显示「—」。
 * 两条都不成立 → null（调用方据此早返回，别让它落进按键链路去）。
 * @param msg - 已解析的一条上报对象。
 * @returns {{battery: number|null, charging: boolean}|null}
 */
export const parseDeviceStatus = (msg) => {
  if (!msg || typeof msg !== 'object') return null
  const bag = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null)
  const params = bag(msg.params) || bag(msg.result)
  if (!params) return null
  const method = typeof msg.method === 'string' ? msg.method.toLowerCase() : ''
  const named = method === STATUS_METHOD || method.endsWith('.' + STATUS_METHOD)
  const battery = normalizeBattery(params.battery)
  if (!named && battery === null) return null
  return { battery, charging: normalizeCharging(params.is_charging) }
}

// 说明：槽位的状态码 `st`（整数）有过一个来回 —— 2026-09-25 先按要求把整条链删掉
// （浏览器 payload / 宿主期望灯态 / 写给设备的 thstatus 全都不带 st），随后又按要求
// 以 **int** 形式加回来：空闲 0 / 运行 1 / 成功 2 / 失败 3（见 AGENT_ST）。
// 教训：这是**跨进程的线格式**，加/删都必须整条链一起动，且两边词表逐字一致（自检会断言）；
// 只往 thstatus 里塞回一个字段的话，设备会按一个没人认得的数去分支，而且不会有任何报错。

/**
 * 下发给设备的**槽位状态码**（整数）—— 就是 v.oai.thstatus 里每个槽位的 `st`。
 *
 * **必须与 `src/client/agents.js` 的 `AGENT_STATE` 逐字一致**（两边自检都会断言这两个表相等；
 * 改一边忘一边 = 设备按一个没人认得的数去分支，且不会有任何报错）。
 * 放在模块级而不是类里：它是跨进程的线格式约定，本来就不属于某个实例。
 */
export const AGENT_ST = {
  IDLE: 0,    // 空闲 —— 会话在、没在跑
  RUNNING: 1, // 运行 —— agent loop 在跑
  SUCCESS: 2, // 成功 —— 刚跑完一轮（**宿主叠加**，见 leds.js reportSuccess）
  ERROR: 3    // 失败 —— 跑失败了（**宿主叠加**，见 leds.js reportError，同时把灯转红）
}
/**
 * 浏览器**只能**报这两种：成功/失败由宿主自己在结果态里叠加 —— 只有宿主收得到那条总线，
 * 也只有它分得清「用户主动中断」（不发 agent/error）与「真失败」。
 * 若允许浏览器发 ERROR，它会用一份自己并不知道真假的结论去覆盖宿主的判断，而灯并不红——
 * 设备那边看到的就是自相矛盾的一对（状态码说失败、颜色说正常）。
 */
export const AGENT_ST_INBOUND = [AGENT_ST.IDLE, AGENT_ST.RUNNING]
/** 认不出 / 缺字段时回落到哪一档（老客户端不发 st，就是这个下场：空闲）。 */
export const AGENT_ST_DEFAULT = AGENT_ST.IDLE

/**
 * 「全灭」槽位 —— **整个应用关闭前**写给设备的最后一份 thstatus（6 个槽位的 c/b/e 全 0）。
 *
 * 为什么单独抽出来当契约：自检要能直接验这份形状（见 test/verify_blackout.js），
 * 而且「关闭时灭灯」这件事**不能**靠「把浏览器的灯态清空」来实现 —— 那样只在宿主
 * 重启时才成立，而关闭是插件卸载那一刻才发生的。
 * 深冻结：它是一份只读的字面量契约，谁都不许在运行时改它。
 */
export const BLACKOUT_SLOTS = Object.freeze(
  Array.from({ length: 6 }, (_, id) => Object.freeze({ id, c: 0, b: 0, e: 0, st: AGENT_ST.IDLE }))
)