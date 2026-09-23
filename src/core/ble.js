// dsh-omkb · 宿主 BLE/HID 模块
// BLE = 蓝牙 HID。macOS 上标准 HID 键盘被系统独占，node-hid 读不到；
// 只能读"厂商自定义类"设备。omkb 的 ReportMap 为 Usage Page 0xFF00、
// Report ID 6、63 字节输入 + 63 字节输出，与 Codex Micro 同款。
//
// 设备识别：product 名包含 'omkb' 且 manufacturer 为 'OM'（均可通过环境变量覆盖）。
// 报告分帧：node-hid 每次给 63 字节数据 = [channel(1=debug,2=RPC), len, payload<=61]，
// 首字节可能是 report id(0x06)。JSON 行以 '\n' 结尾，可能跨多帧，需累计重组。
// 本模块负责：打开目标设备、按分帧拆包并解析 RPC JSON 通知、防抖计数，
// 并在 webServer 上暴露 GET /omkb/state 返回状态快照供浏览器客户端轮询
// （每个输入源各有自己的累加计数器：enc/knobPress/joyPush+joyDir，见 #state 声明）。
// 另外解析 `device.status`（其 params 带 battery / is_charging）→ state.battery / state.charging，
// 设置页的「电池」那一行就是读它（见 parseDeviceStatus）。设备**不会自己定时推**：连上之后由
// 宿主主动发一条 `device.status` 去问（#requestStatus），设备才上报 —— 所以在 open() 成功、
// 且 data 监听器挂好之后立刻问一次。
// 灯光：浏览器把「哪个会话占哪颗键、平时什么颜色」POST 到 /omkb/agents，本模块负责实际写 HID；
// 会话**运行失败**时由宿主的 agent/error 事件触发对应键闪红灯（flashError），窗口结束自动回空闲。

import { createRequire } from 'node:module'
import { JOYSTICK_METHOD, parseJoystick } from './joystick.js'
import { createExitGuard } from './exit-guard.js'

const require = createRequire(import.meta.url)

// 槽位状态标识（st）的词表 —— 与 src/client/agents.js 的 AGENT_STATUS 逐字一致。
// 放在模块级而不是类里：老版本 Node 对「私有静态字段」支持不全，且词表本来就是全局约定。
export const AGENT_STATUSES = new Set(['running', 'idle', 'error', 'empty'])
// 浏览器**只能**报这三种：error 是宿主在红灯窗口内自己叠加的（见 #renderAgents）。
// 若允许浏览器发 error，它就能谎报一个「永远不会自动解除」的失败态，而灯并不红。
export const AGENT_STATUS_INBOUND = new Set(['running', 'idle', 'empty'])
export const AGENT_STATUS_DEFAULT = 'empty'

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
 * 宿主连上时会主动发一条 `device.status` 去问（见 #requestStatus），设备很可能按 JSON-RPC
 * 的规矩回 `{"id":N,"result":{...}}` —— 那种消息**没有 method**，只认 `params` 就会把应答
 * 整条丢掉，界面永远显示「—」。
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

export class BleController {
  // ---------- 配置（可用环境变量覆盖） ----------
  #reportId = 0x06 // ReportMap: 0x85, 0x06
  #channelRpc = 0x02 // 2 = RPC（1 = debug，忽略）
  // 设备匹配：优先按 VID:PID；默认 0x303A:0x8361，可用 DSH_HID_VID/DSH_HID_PID（十六进制字符串）覆盖；
  // 未配置 VID/PID 时回退到旧的 name/manufacturer 匹配（DSH_HID_NAME/DSH_HID_MFR）
  #vendorId = this.#parseHex(process.env.DSH_HID_VID || '0x303A')
  #productId = this.#parseHex(process.env.DSH_HID_PID || '0x8361')
  #deviceName = (process.env.DSH_HID_NAME || 'OMKB').toLowerCase()
  #deviceMfr = (process.env.DSH_HID_MFR || 'OMKB LAB').toLowerCase()
  #triggerMethod = process.env.DSH_HID_METHOD || null // 可选：只响应某个 method
  #triggerKey = process.env.DSH_HID_KEY || null // 可选：只响应某个 params.k
  #debounceMs = 250 // 一次物理按压只计一次

  #statePath = '/omkb/state'
  #configPath = '/omkb/config'
  #reconnectPath = '/omkb/reconnect'
  #agentsPath = '/omkb/agents'

  // ---------- 状态：计数器 + 连接状态 + 灯光配置，暴露给浏览器客户端 ----------
  // 关键：**每个输入源都有自己的累加计数器**，浏览器据此归属事件，而不是靠 t 猜。
  // t 只是「发生过一件事」的全局计数，而设备状态字段会被后续事件覆盖（推完立刻松手，
  // 轮询那一刻 joy 已经回中），拿它当「事件类型」用必然误判——曾经的后果是旋钮/摇杆
  // 操作被当成「麦克风键」而触发语音输入（见 src/client/hid-bridge.js 顶部注释）。
  //   enc      带符号累计步数 → 旋钮旋转（差值即步数）
  //   knobPress           计数 → 旋钮按下（不受 #bump 去抖影响）
  //   joyPush/joyDir      计数 + 最近一次有效方向 → 摇杆推了一次（回中不计，方向不走丢）
  //   joyT                含回中的方向变化计数（老客户端用，语义保持不变）
  //   down / keyAct       **当前按住的键** + 本次事件的边沿（见 HID_ACT）。
  //                       宿主以前只会说“发生了一件事”，于是“还按着”和“已经松开”在浏览器侧
  //                       无法区分（设置页的布局特效只能按定时器猜着弹回来）。设备给了 act，
  //                       这里就如实翻译：down = 真相（快照即状态），keyAct = 本次边沿；
  //                       老固件两者分别是 [] 和 null。
  //   battery / charging  设备的**电平型**状态（device.status 上报，见 parseDeviceStatus）。
  //                       故意**不给它配计数器**：它是「现在多少」而不是「发生了一件事」，
  //                       拿它判事件就会退回「靠状态字段猜事件类型」那类老 bug（见文件头）。
  //                       断开时清成 null/false —— 留着旧读数等于在展示一台已经拔掉的键盘的电量。
  #state = { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], errors: [], idle: null, keyT: {} }
  /** 当前物理按住的键名（只有拿到 act 才会维护；见 #handleLine 的松开分支）。 */
  #held = new Set()
  #logger
  #last = 0
  #lineBuf = '' // 跨帧重组 buffer，按 '\n' 切 JSON 行
  #rpcId = 0 // 灯光控制（Codex Micro 兼容协议，见 src/core/ble.js 顶部注释）
  #dimmed = false // 是否已因空闲而自动调暗
  #lastActivity = Date.now()
  /**
   * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
   * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
   */
  #allIdle = null
  #idleSince = 0 // 进入「全空闲」的时刻（0 = 未知）
  #hid = null
  #diagnostics = null
  #dimTimer = null
  /**
   * 进程退出安全网（见 ./exit-guard.js）。
   * **只有真的打开了设备才会 install()**：手上没有句柄就完全不碰进程信号，
   * 宿主启动失败时也就不会因为我们而变成「退不掉」。
   */
  #exitGuard = null
  #reconnectTimer = null

  // ---------- 运行失败的红色闪灯 ----------
  // 分工：**浏览器**决定「哪个会话占哪颗键、平时是什么颜色」（它才知道会话列表），
  // **宿主**决定「失败的那颗键临时变红多久」（它才收得到 agent/error，也是唯一写 HID 的人）。
  // 因此浏览器下发的槽位里带上会话 id（sid），宿主用它把失败事件定位到具体某个键。
  #desiredAgents = [] // 浏览器下发的期望灯态（设备字段 + st/sid 元数据）
  #slotSessions = [] // 槽位下标 → 会话 id
  #errorSlots = new Map() // 槽位下标 → { until, sid }，红灯窗口
  #errorTimer = null // 指向最近一次到期的单个定时器（不是每个槽位一个）
  #errorMs = 3000 // 红灯持续时长；可用 DSH_OMKB_ERROR_MS 覆盖（自检脚本调小它）
  #errorColor = 0xff0000 // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）

  // ---------- 槽位状态标识（st） ----------
  // 每个槽位随灯态一起带一个「会话状态」字段，跟着 v.oai.thstatus 下发到设备：
  //   running — 会话正在运行      idle — 会话空闲
  //   empty   — 该键没有会话      error — 该会话运行失败（**宿主叠加**，只在红灯窗口内）
  // 为什么要它：以前状态只体现在颜色里（蓝/白），设备只能靠猜颜色反推；有了 st，设备可以
  // 自己按状态做灯效，而颜色随时可调不影响语义。词表必须与 src/client/agents.js 的
  // AGENT_STATUS 一致（两边自检都会断言这一串）。
  // 校验状态标识：合法就用它，非法/缺字段 → 按槽位自身推断
  // （有会话在亮 = e 开着或有颜色 → idle；否则 empty）。老客户端不发 st 也能正常工作。
  #statusFrom = (slot, allowed) => {
    if (!slot) return AGENT_STATUS_DEFAULT
    if (typeof slot.st === 'string' && allowed.has(slot.st)) return slot.st
    return (Number(slot.e) > 0 || this.#clampRgb(slot.c) > 0) ? 'idle' : AGENT_STATUS_DEFAULT
  }
  /** 浏览器报上来的状态（不接受 error，见 AGENT_STATUS_INBOUND）。 */
  #inboundStatus = (slot) => this.#statusFrom(slot, AGENT_STATUS_INBOUND)
  /** 真正下发到设备前的兜底校验（此时才允许宿主叠加的 error）。 */
  #outboundStatus = (slot) => this.#statusFrom(slot, AGENT_STATUSES)

  constructor({ logger, diagnostics } = {}) {
    this.#logger = logger
    this.#diagnostics = typeof diagnostics === 'function' ? diagnostics : null
    const ms = Number(process.env.DSH_OMKB_ERROR_MS)
    if (Number.isFinite(ms) && ms >= 0) this.#errorMs = ms
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1000)
    this.#dimTimer.unref()
    // 安全网只**建**不装：装的动作在 open() 成功之后（没设备就别碰进程信号）。
    // release 指向 close()：它是幂等的，重复调用安全。
    this.#exitGuard = createExitGuard({ release: () => this.close(), log: (m) => this.#warn(m) })
  }

  // 日志同时打到 Cordis logger 和终端 stdout/stderr，方便从命令行用 `dsh web` 调试
  #log = (...a) => { try { this.#logger?.['info']?.(...a) } catch (e) {}; console.log('[omkb]', ...a) }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; console.error('[omkb]', ...a) }

  get state() { return this.#state }

  /**
   * 自检用：拿到退出安全网句柄。**只给自检脚本用**（`test/verify_exit_guard.js` 用它
   * 在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）；运行时不调用，
   * 真机路径上安全网由 open() 自己 install()。
   */
  get exitGuard() { return this.#exitGuard }

  /**
   * 测试注入：把一行 JSON 当作设备上报处理（与 HID 数据帧走同一条 #handleLine 路径）。
   * 只给自检脚本用（src/verify_joystick.js 用它喂 v.oai.rad 摇杆帧，把
   * 「角度 → 方向 → joy/joyT 计数」这条链路钉在测试里）；运行时不调用。
   * @param line - 一行 JSON 文本（可带尾随换行）。
   * @returns {void}
   */
  feedLine = (line) => { this.#handleLine(String(line)) }

  // 状态快照 = 硬件状态 + 可选诊断。诊断由宿主注入（目前是设置持久化是否在线）：
  // 终端里的 logger 输出不一定会落到 stdout，把关键结论挂到 /omkb/state 上，
  // 排查时一条 curl 就能看到，不用重启终端或翻日志。
  #snapshot = () => {
    if (!this.#diagnostics) return this.#state
    try { return { ...this.#state, settings: this.#diagnostics() } } catch (e) { return this.#state }
  }

  // 防抖计数 + 空闲调暗恢复。restoreLight=false 时只通知计数、不写回 LED（用于摇杆这类纯输入事件，
  // 摇杆不应向键盘发回任何灯光信息）
  #bump = (label, restoreLight = true) => {
    const now = Date.now()
    this.#lastActivity = now
    // 空闲调暗状态下，任意按键先恢复亮度
    if (restoreLight) this.#wake()
    if (now - this.#last < this.#debounceMs) return
    this.#last = now
    this.#state.t += 1
    this.#log(`HID 触发 ${this.#state.t}${label ? ' (' + label + ')' : ''}`)
  }

  /**
   * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（#bump）、会话重新开始运行（#applyAgents）。
   * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
   * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
   * @returns {boolean} 是否真的从调暗状态恢复。
   */
  #wake = () => {
    if (!this.#dimmed) return false
    this.#dimmed = false
    if (this.#state.brightness > 0) this.#sendBrightness(this.#state.brightness)
    this.#renderAgents()
    return true
  }

  // 处理一条完整的 JSON 通知行，如 {"method":"v.oai.hid","params":{"k":"AG00"}}
  #handleLine = (line) => {
    console.log(line);
    const raw = line.trim()
    if (!raw) return
    let msg
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      this.#warn('非法 JSON 行:', raw)
      return
    }
    if (!msg || typeof msg !== 'object') return

    // ---- 设备状态（电量）：**插在按键链路之前并直接 return** ----
    // 它不是按键事件。落进下面的链路会让 t 自增、把 state.key 冲成 null，
    // 客户端就会因为这个「有 t 但没有可识别字段」的帧记一条无主事件诊断
    // （见 src/client/hid-bridge.js 的 #noteUnhandled）—— 电量一上报就报一条噪声。
    // 也刻意排在 `#triggerMethod` 过滤之前：那是调试用的「只认某个 method」开关，
    // 不该顺手把电量也挡掉。
    // 位置同样排在下面那条 `method` 守卫**之前**：我们主动问电量的应答是
    // `{"id":N,"result":{...}}`（**没有 method**），晚一步就会被守卫整条丢掉。
    const status = parseDeviceStatus(msg)
    if (status) {
      this.#state.battery = status.battery
      this.#state.charging = status.charging
      return
    }

    if (typeof msg.method !== 'string') return

    if (this.#triggerMethod && msg.method !== this.#triggerMethod) return

    const key = msg.params && msg.params.k
    if (this.#triggerKey && (!key || key !== this.#triggerKey)) return

    // ---- 按键边沿（见 HID_ACT）：按下 / 松开 / 脉冲 ----
    const keyAct = msg.params && typeof msg.params.act === 'number' ? msg.params.act : null
    this.#state.keyAct = keyAct

    // 松开**不是一个新事件**，只更新“当前按住的键”就结束（t 不变 → 客户端不会再执行一次动作）。
    // 以前没有这条分支：松手也会走完整条链路，AG 键会重复打开会话、语音键会被 toggle 两次，
    // 只是 250ms 去抖恰好遮住了大部分（按得慢就会露出来）。
    if (keyAct === HID_ACT.RELEASE) {
      if (key) { this.#held.delete(key); this.#state.down = [...this.#held] }
      return
    }

    // 按住集合：**只有设备明确报了 act 才维护**——老固件只会报“按下”，
    // 若要它就会把键永久钉在按下态（永远收不到松开）。
    // 脉冲（旋钮转一格）是两个边沿之间的瞬时事件，没有“按住”语义，也不入集合。
    if (key && keyAct !== null && keyAct !== HID_ACT.PULSE) {
      this.#held.add(key)
      this.#state.down = [...this.#held]
    }

    // 记录具体按键：
    //   Agent 键 AG00..AG05 → 槽位 0..5
    //   动作键 ACT06..ACT12 → 动作码（'ACT07' 归档 / 'ACT08' 拒绝 / 'ACT09' 同意 /
    //     'ACT10'·'ACT11' 语音 / 'ACT12' 发送 / 'ACT06' 保留）
    this.#state.key = key || null

    // 每个键名一个累加计数器（keyT）：设置页的键盘布局靠它播「按键特效」。
    // 计数的是**按下**次数（松开在上面已经 return），所以「按一下 = +1」；
    // 为什么不用 sticky 的 key 计：它会被后续事件覆盖，两次轮询之间按下的不同键只看得到最后一个。
    if (key) {
      const map = this.#state.keyT || (this.#state.keyT = {})
      if (map[key] !== undefined || Object.keys(map).length < 64) {
        map[key] = (map[key] || 0) + 1
      }
    }

    // 旋钮（编码器）：CW(+1)/CC(-1) 累加带符号步数；旋钮按下 ENC 走下方普通按键路径
    if (key === 'ENC_CW') { this.#state.enc = (this.#state.enc || 0) + 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }
    if (key === 'ENC_CC') { this.#state.enc = (this.#state.enc || 0) - 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }

    // 摇杆：RPC `v.oai.rad`，参数 { a(角度), d(推力) } → 依角度归一化为四方向。
    // 角度→方向映射见 ./joystick.js；回中(d 低于阈值)时置 joy=null。
    if (msg.method === JOYSTICK_METHOD) {
      const j = parseJoystick(msg)
      const dir = (j && j.dir) || null
      this.#state.agent = -1
      this.#state.act = null
      const prev = this.#state.joy
      this.#state.joy = dir
      // 摇杆是连续帧流：只有方向**发生变化**才触发一次，避免同方向持续推导致重复执行
      // 返回/前进等动作。
      //
      // joyT 是方向变化计数器，且**把回中也算作一次变化**（joy → null）。为什么必须
      // 单独计数：t 只在非空方向变化时递增，回中不改 t，于是浏览器端永远看不到
      // 「这一次推杆结束了」——它按 t 变化取状态，第二次推**同一个方向**时会拿
      // joy='left' 和上次的基线比，判成「持续推杆」而整个吞掉。有了 joyT，
      // 「推→回中→再推同向」各记一次，且帧流期间保持不变。
      if (dir !== prev) {
        this.#state.joyT = (this.#state.joyT || 0) + 1
        if (dir) {
          // 非空方向变化 = 「推了一次」。累加计数 + 记住方向，浏览器只靠这两个字段
          // 就能执行动作——即使松手发生在两次轮询之间（那时 joy 已经回中，
          // 光看 joy 会把这个动作整个丢掉）。
          this.#state.joyPush = (this.#state.joyPush || 0) + 1
          this.#state.joyDir = dir
          this.#bump('JOY_' + dir, false) // 纯输入，不写回键盘灯光
        }
      }
      return
    }

    const m = /^AG0([0-5])$/i.exec(key || '')
    const a = /^ACT(0[6-9]|1[0-2])$/i.exec(key || '')
    this.#state.agent = m ? Number(m[1]) : -1
    this.#state.act = a ? 'ACT' + a[1] : null

    // 旋钮按下：单独计数。宿主 #bump 有 250ms 去抖，而设备可能按得比这快，
    // 光靠 t 会漏掉（浏览器也就没法归属这次按下）。旋转在更上面 ENC_CW/CC 分支处理。
    if (key === 'ENC') this.#state.knobPress = (this.#state.knobPress || 0) + 1

    this.#bump(key || msg.method)
  }

  // 把一段 payload 追加进重组 buffer，按 '\n' 切出完整行处理
  #feed = (payload) => {
    this.#lineBuf += payload.toString('utf8')
    let idx
    while ((idx = this.#lineBuf.indexOf('\n')) !== -1) {
      const line = this.#lineBuf.slice(0, idx)
      this.#lineBuf = this.#lineBuf.slice(idx + 1)
      if (line.length) {
        // 单帧解析必须隔离异常：任何一帧出错只跳过该行，绝不让读取泵整体崩溃，
        // 否则主机停止接收，键盘会报 NimBLECharacteristic: failed to send value
        try { this.#handleLine(line) } catch (e) { this.#warn(`丢弃异常行: ${e && e.message ? e.message : e}`) }
      }
    }
    if (this.#lineBuf.length > 4096) this.#lineBuf = '' // 防呆：异常长缓冲直接丢弃
  }

  #onData = (buf) => {
    if (!buf || buf.length < 3) return
    // 部分平台首字节是 report id，先判断并跳过（channel 值只有 1/2，不会跟 0x06 冲突）
    let off = buf[0] === this.#reportId ? 1 : 0
    if (buf.length < off + 2) return

    const channel = buf[off]
    const len = buf[off + 1]
    if (channel !== this.#channelRpc) return // 只处理 RPC 通道（debug=1 忽略）

    this.#feed(buf.slice(off + 2, off + 2 + len))
  }

  // 十六进制字符串（可带 0x 前缀）→ 数值；非法返回 null
  // 注意：必须是原型方法语法（非箭头字段），供上方字段初始化时调用
  #parseHex(v) {
    if (v == null) return null
    const s = String(v).trim().toLowerCase().replace(/^0x/, '')
    if (!/^[0-9a-f]{1,4}$/.test(s)) return null
    return parseInt(s, 16)
  }

  // 设备匹配：优先 VID+PID 精确匹配；未配置 VID/PID 时回退到 name/manufacturer
  #matches = (d) => {
    if (this.#vendorId != null || this.#productId != null) {
      return this.#vendorId != null && d.vendorId === this.#vendorId &&
        this.#productId != null && d.productId === this.#productId
    }
    const p = typeof d.product === 'string' ? d.product.toLowerCase() : ''
    const m = typeof d.manufacturer === 'string' ? d.manufacturer.toLowerCase() : ''
    return p.includes(this.#deviceName) && m === this.#deviceMfr
  }

  open = () => {
    // 幂等：已连接的设备不重复打开（重连定时器只有在连上后才会被清除）
    if (this.#hid || this.#state.open) return
    try {
      const nodehid = require('node-hid')
      if (!nodehid || typeof nodehid.devices !== 'function') {
        this.#log('未安装 node-hid 原生模块，HID 读取关闭')
        return
      }
      const list = nodehid.devices()
      //this.#log('枚举到 HID 设备数:', list.length)
      //for (const d of list) {
      //  this.#log('  -', d.product, '|', d.manufacturer, '| 0x' + (d.vendorId || 0).toString(16).padStart(4, '0') + ':' + (d.productId || 0).toString(16).padStart(4, '0'), '| usagePage=0x' + (d.usagePage || 0).toString(16))
      //}
      const cand = list.find(this.#matches)
      if (!cand) {
        this.#log(
          `未找到 ${this.#vendorId != null || this.#productId != null
            ? `VID:PID = 0x${(this.#vendorId || 0).toString(16)}:0x${(this.#productId || 0).toString(16)}`
            : `name="${this.#deviceName}" & manufacturer="${this.#deviceMfr}"`} 的 HID 设备；` +
          '可设 DSH_HID_VID/DSH_HID_PID（十六进制，如 1235/0a91），或检查设备是否已配对且为厂商自定义类(标准键盘会被系统独占)'
        )
        return
      }
      this.#state.product = cand.product || cand.manufacturer || JSON.stringify({ VID: cand.vendorId, PID: cand.productId })
      this.#hid = new nodehid.HID(cand.path)
      this.#state.open = true
      // ---- 从这里开始我们真的握着一个会持有事件循环的句柄 ----
      // 装上退出安全网：宿主启动失败/优雅退出卡住时，Ctrl+C 仍然能把进程带走
      // （见 ./exit-guard.js 顶部：为什么不能像以前那样在信号回调里同步 close）。
      this.#exitGuard?.install()
      // 连上后停止自动重连定时器
      if (this.#reconnectTimer) { clearInterval(this.#reconnectTimer); this.#reconnectTimer = null }
      this.#log(`已打开 HID 设备: ${this.#state.product} (manufacturer=${cand.manufacturer || ''})`)
      // 设备（重）连后重放灯态。必须走 #renderAgents 而不是直接重放上次的原始参数：
      // 重连可能发生在红灯窗口之内，直接重放会把红色抹掉。
      if (this.#desiredAgents.length) this.#renderAgents()
      this.#hid.on('data', this.#onData)
      this.#hid.on('error', (e) => {
        this.#warn('HID 读取错误:', e && e.message)
        this.close()
        // 断开后每 30 秒自动重连一次，直到设备重新可用
        if (!this.#reconnectTimer) {
          this.#reconnectTimer = setInterval(() => this.open(), 30000)
          this.#reconnectTimer.unref()
          this.#log('设备断开，已启动 30 秒自动重连')
        }
      })
      // 连上后**主动问一次**电量（用户 2026-09-23 明确指出的协议用法）：
      // 设备只在「自己被问」或「它自己刚连上」时才上报 device.status，而宿主重启时
      // BLE 链路是不断的、设备根本不知道换了个人听 —— 不主动问，电池行就永远是「—」。
      // 必须放在 `data` 监听器**之后**发：应答可能立刻就回来，先挂监听才收得到。
      this.#requestStatus()
    } catch (e) {
      this.#warn(
        'node-hid 打开失败(需要正确编译的原生依赖，且设备非标准键盘):',
        e && e.message
      )
      this.#state.open = false
    }
  }

  close = () => {
    if (this.#hid) {
      try { this.#hid.close() } catch (e) {}
      this.#hid = null
    }
    this.#state.open = false
    // 设备走了就不可能还有键按着：不清的话 down 会把键永久钉在按下态
    // （设置页的布局特效会一直显示那颗键陷着）。
    this.#held.clear()
    this.#state.down = []
    // 电量同理：它是「这台设备的读数」，设备不在了就该如实变成「不知道」，
    // 而不是把断开前的 12% 一直挂在界面上（用户看到的就是一台没连上的键盘还有电量）。
    this.#state.battery = null
    this.#state.charging = false
  }

  // ---------- HID 写回：JSON-RPC 分帧写入（用于灯光/亮度控制） ----------
  // 输出报告 64 字节：[0x06 report id][0x02 channel][len][JSON 片段<=61]，超长按 61 字节切片
  #sendRpc = (method, params) => {
    if (!this.#hid || !this.#state.open) {
      this.#warn('设备未连接，忽略写回:', method)
      return false
    }
    const json = Buffer.from(JSON.stringify({ method, params, id: ++this.#rpcId }), 'utf8')
    const MAX = 61
    for (let pos = 0; pos < json.length; pos += MAX) {
      const frag = json.slice(pos, pos + MAX)
      const buf = Buffer.alloc(64)
      buf[0] = this.#reportId
      buf[1] = this.#channelRpc
      buf[2] = frag.length
      frag.copy(buf, 3)
      try {
        this.#hid.write(buf)
      } catch (e) {
        this.#warn('HID 写入失败:', e && e.message)
        return false
      }
    }
    this.#log('已发送 RPC:', method, JSON.stringify(params))
    return true
  }

  /**
   * 向设备要一次状态（电量 / 是不是在充电）。
   *
   * 协议用法（用户 2026-09-23 给的）：**连上之后发一条 `device.status`，设备就会上报**
   * `battery`（电量）与 `is_charging`（是否在充电）。设备自己不会定时推，所以「连上就问一次」
   * 是拿到读数的前提。params 给空对象 —— 这是「把你的状态告诉我」的查询，不带参数。
   *
   * 设备怎么回都能收：通知形状（`{method:'device.status',params:{...}}`）或应答形状
   * （`{id,result:{...}}`）都由 parseDeviceStatus 认，见那里的注释。
   * @returns {boolean} 是否真的写给了设备（没连上时为 false，不抛错）。
   */
  #requestStatus = () => this.#sendRpc(STATUS_METHOD, {})

  // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
  #sendBrightness = (v) => {
    const b = Math.max(0, Math.min(1, v))
    if (b <= 0) {
      return this.#sendRpc('v.oai.rgbcfg', {
        ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
        keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
      })
    }
    return this.#sendRpc('v.oai.rgbcfg', {
      ambient: { e: 2, b, s: 0.4, m: 0, c: 0x304ffe },
      keys: { e: 1, b, s: 0, m: 0, c: 0xffffff }
    })
  }

  // 应用来自设置面板的配置补丁
  #applyConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return
    if (typeof patch.brightness === 'number') {
      this.#state.brightness = Math.max(0, Math.min(1, patch.brightness))
      this.#dimmed = false
      this.#lastActivity = Date.now()
      this.#sendBrightness(this.#state.brightness)
      this.#renderAgents()
    }
    if (typeof patch.autoDim === 'number') {
      this.#state.autoDim = Math.max(0, patch.autoDim)
      // 关掉自动调暗时如果正暗着，要立刻把灯点回来（#wake 只在真暗着时才动手）
      if (this.#state.autoDim <= 0) this.#wake()
      else this.#dimmed = false
    }
  }

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  // 与 #applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
  // 返回是否发生了改动。
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return false
    let changed = false
    if (typeof prefs.brightness === 'number') {
      const b = Math.max(0, Math.min(1, prefs.brightness))
      if (b !== this.#state.brightness) {
        this.#state.brightness = b
        this.#dimmed = false
        this.#lastActivity = Date.now()
        this.#sendBrightness(b)
        this.#renderAgents()
        changed = true
      }
    }
    if (typeof prefs.autoDim === 'number') {
      const d = Math.max(0, prefs.autoDim)
      if (d !== this.#state.autoDim) {
        this.#state.autoDim = d
        if (d <= 0) this.#wake()
        else this.#dimmed = false
        changed = true
      }
    }
    return changed
  }

  #clampRgb = (v) => Math.max(0, Math.min(0xffffff, Math.round(Number(v) || 0)))

  #clamp01 = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  }

  // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
  // 每个槽位带 `st`（状态标识）——设备可以只认它做灯效，不必反推颜色。
  // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
  //
  // 自动调暗期间一律把 e/b 压成 0：调暗是「灯全灭」，而浏览器仍会照常推送灯态
  // （设置页打开、会话列表变化都会触发），不压的话下一次推送就把灯又点亮了。
  #sendThstatus = (slots) => {
    if (!Array.isArray(slots)) return false
    const dimmed = this.#dimmed
    const params = slots.slice(0, 6).map((s, i) => ({
      id: i,
      st: this.#outboundStatus(s),
      c: this.#clampRgb(s && s.c),
      b: dimmed ? 0 : this.#clamp01(s && s.b, 0),
      e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
      s: this.#clamp01(s && s.s, 0),
      sk: 0,
      sa: 0
    }))
    this.#state.agents = params
    return this.#sendRpc('v.oai.thstatus', params)
  }

  // ---------- 期望灯态 + 失败红灯 ⇒ 实际灯态 ----------
  // 唯一的灯态出口：把浏览器下发的期望灯态与「正在闪红的那几颗键」叠加后写 HID。
  // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把红灯
  // 提前冲掉——红灯由宿主自己守到窗口结束。
  // 状态标识同理：红灯窗口内的那颗键报 'error'，窗口结束自动回到浏览器给的状态。
  #renderAgents = () => {
    if (!this.#desiredAgents.length) return false
    const now = Date.now()
    const slots = this.#desiredAgents.map((s, i) => {
      const err = this.#errorSlots.get(i)
      const red = err !== undefined && err.until > now
      return { id: i, st: red ? 'error' : s.st, c: red ? this.#errorColor : s.c, b: s.b, e: s.e, s: s.s, sk: 0, sa: 0 }
    })
    this.#state.errors = [...this.#errorSlots].map(([slot, e]) => ({ slot, sid: e.sid, msLeft: Math.max(0, e.until - now) }))
    return this.#sendThstatus(slots)
  }

  // 红灯窗口到期 → 收起红色、回到期望灯态（也就是「然后再变为空闲灯光」）。
  // 只保留一个定时器并指向最近一次到期：槽位可以同时有多个窗口，逐槽定时器会互相覆盖。
  #armErrorTimer = () => {
    if (this.#errorTimer) { clearTimeout(this.#errorTimer); this.#errorTimer = null }
    if (this.#errorSlots.size === 0) return
    let next = Infinity
    for (const e of this.#errorSlots.values()) if (e.until < next) next = e.until
    this.#errorTimer = setTimeout(() => {
      this.#errorTimer = null
      const now = Date.now()
      for (const [slot, e] of [...this.#errorSlots]) if (e.until <= now) this.#errorSlots.delete(slot)
      this.#renderAgents()
      this.#armErrorTimer() // 还有别的窗口没到期就继续等
    }, Math.max(0, next - Date.now()))
    this.#errorTimer.unref?.()
  }

  /**
   * 某个会话运行失败 → 让它的那颗键闪红灯，窗口结束后自动回到期望灯态。
   *
   * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
   * 时发出：用户主动中断走的是另一条分支，不会闪红灯。
   * @param {string} sessionId - 失败的会话（DSH 里 agent.id 就是会话 id）。
   * @returns {boolean} 是否真的点亮了某个键（该会话没占键时为 false）。
   */
  flashError = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    const slots = []
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i)
    if (slots.length === 0) return false // 不在侧边栏 / 还没下发过灯态 → 没有键可亮
    const until = Date.now() + this.#errorMs
    for (const slot of slots) this.#errorSlots.set(slot, { until, sid: sessionId })
    this.#renderAgents()
    this.#armErrorTimer()
    this.#log(`会话运行失败 → 槽位 ${slots.join(',')} 闪红灯 ${this.#errorMs}ms`)
    return true
  }

  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,s,sid}...], errorColor } 或纯数组）
  #applyAgents = (payload) => {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.slots) ? payload.slots : null)
    if (!list) return
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // 必须严格判定类型：Number(null) === 0 会让「字段缺失/null」被当成合法的黑色，
      // 于是红灯变成一颗看不见的灯（比报错更难查）。
      const c = payload.errorColor
      if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) this.#errorColor = c
      // 「所有会话都空闲」→ 自动调暗的计时起点；有会话重新开始运行 → 立刻把灯点回来。
      // 老客户端不发这个字段（数组形态的老请求更是没有），此时 #allIdle 保持 null = 未知，
      // 自动调暗退回「无按键活动」判据。
      if (typeof payload.allIdle === 'boolean') {
        this.#state.idle = payload.allIdle
        if (payload.allIdle !== this.#allIdle) {
          this.#allIdle = payload.allIdle
          if (payload.allIdle) this.#idleSince = Date.now()
          else { this.#idleSince = 0; this.#wake() }
        }
      }
    }
    const desired = []
    const sessions = []
    for (let i = 0; i < 6; i++) {
      const s = list[i] || {}
      desired.push({
        st: this.#inboundStatus(s),
        c: this.#clampRgb(s.c),
        b: this.#clamp01(s.b, 0),
        e: Math.round(Number(s.e) || 0),
        s: this.#clamp01(s.s, 0)
      })
      sessions.push(typeof s.sid === 'string' && s.sid ? s.sid : null)
    }
    this.#desiredAgents = desired
    this.#slotSessions = sessions
    // 红灯要跟着会话走，不能跟着槽位走：会话列表重排时槽位会换人，红灯必须一起搬家，
    // 会话消失（归档 / 关掉）时则撤掉。这里整表重建，避免原地增删的边界情况。
    const now = Date.now()
    const next = new Map()
    for (const [, e] of this.#errorSlots) {
      if (e.until <= now) continue
      const at = sessions.indexOf(e.sid)
      if (at !== -1 && !next.has(at)) next.set(at, e)
    }
    this.#errorSlots = next
    this.#renderAgents()
    this.#armErrorTimer()
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
    this.#renderAgents() // 灯态也要跟着压灭（否则下一次 thstatus 又把灯点亮）
    this.#log(`空闲自动调暗：关闭灯光（${this.#allIdle === true ? '所有会话空闲' : '无按键活动'} ${this.#state.autoDim}s）`)
  }

  // ---------- HTTP 桥接：状态查询 + 配置写回 + 重连 ----------
  #jsonHead = { 'content-type': 'application/json; charset=utf-8' }

  #readBody = (req, cb) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => cb(body))
  }

  #json = (res, code, obj) => {
    res.writeHead(code, this.#jsonHead)
    res.end(JSON.stringify(obj))
  }

  registerRoute = (webServer) => {
    const disposers = []
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: this.#statePath,
        handler: (_req, res) => { this.#json(res, 200, this.#snapshot()) }
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: this.#configPath,
        handler: (req, res) => {
          if (req.method !== 'POST') { this.#json(res, 405, { error: 'method not allowed' }); return }
          this.#readBody(req, (body) => {
            try {
              this.#applyConfig(JSON.parse(body || '{}'))
              this.#json(res, 200, this.#state)
            } catch (e) {
              this.#json(res, 400, { error: e && e.message ? e.message : String(e) })
            }
          })
        }
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: this.#reconnectPath,
        handler: (_req, res) => {
          this.close()
          this.open()
          this.#json(res, 200, this.#state)
        }
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: this.#agentsPath,
        handler: (req, res) => {
          if (req.method !== 'POST') { this.#json(res, 405, { error: 'method not allowed' }); return }
          this.#readBody(req, (body) => {
            try {
              this.#applyAgents(JSON.parse(body || '{}'))
              this.#json(res, 200, this.#state)
            } catch (e) {
              this.#json(res, 400, { error: e && e.message ? e.message : String(e) })
            }
          })
        }
      }))
      return () => {
        for (const d of disposers) { try { d && d() } catch (e) {} }
      }
    } catch (e) {
      this.#warn('webServer 路由注册失败:', e && e.message)
      return null
    }
  }

  dispose = () => {
    clearInterval(this.#dimTimer)
    if (this.#errorTimer) { clearTimeout(this.#errorTimer); this.#errorTimer = null }
    if (this.#reconnectTimer) { clearInterval(this.#reconnectTimer); this.#reconnectTimer = null }
    // 卸下安全网（只移除我们自己注册的监听者，宿主的一个都不碰；幂等）。
    this.#exitGuard?.dispose()
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
    registerRoute: ctl.registerRoute,
    setPrefs: ctl.setPrefs,
    flashError: ctl.flashError,
    // 测试注入（自检脚本用它喂摇杆帧，见 #feedLine）；宿主运行时不用。
    feedLine: ctl.feedLine,
    dispose: ctl.dispose,
    state: ctl.state
  }
}
