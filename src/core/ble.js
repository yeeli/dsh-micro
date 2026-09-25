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
// 设置页的「电池」那一行就是读它（见 parseDeviceStatus）。设备**不会自己定时推**，要问一次它才报；
// 但「问」的时机是**检测到设备已连接之后**，不是 open() 那一刻（用户 2026-09-25 要求）：
// 启动时句柄可能开得起来而蓝牙链路还没建立，那时候问只是白发一条。
// 判据 = 收到设备的第一帧数据（#onData → #markConnected）；另有兜底：句柄开着但 #probeMs 内
// 一声不吭，才主动问一次（覆盖「链路是旧的、设备不会自己说话」那种情况，见 #armProbe）。
// 灯光：浏览器把「哪个会话占哪颗键、平时什么颜色」POST 到 /omkb/agents，本模块负责实际写 HID；
// 会话**运行失败**时由宿主的 agent/error 触发对应键转红灯（reportError），跑完一轮由
// agent/turn-stopping 触发状态码 2（reportSuccess）。两者都是**结果态、不会自己变回去**
// （用户 2026-09-25 要求「错误后不变白」），直到该会话重新运行（agent/status）才收掉。
// **会话灯态不许重复发**（用户 2026-09-25 要求「一次只发一条」）：一个事件循环拍里可能有好几个
// 来源都要重画（agent/error 与 agent/status 连着来、POST /omkb/agents 里 allIdle 翻转还会顺手
// 唤醒亮度），逐条写出去等于让设备一口气收好几条 thstatus。两道防线各管一段 ——
//   ① `#renderAgents` **不直接写设备**，只记下「此刻应该是什么样」，写入排到这一拍末尾（微任务）
//      合并成一条（见 `#pendingAgents`）→ 管**同一拍**的多次重画；
//   ② `#writeThstatus` 比对「上次真正写出去的那份」，内容一样就**跳过**（见 `#lastThstatus`）
//      → 管**跨拍**的重复（宿主的结论与浏览器那份带 350ms 防抖的快照错开一拍到达，内容相同）。
//      这一层是用户实测「还是会发送两条」之后补的：只做①挡不住跨拍的那一对。
// **进程要走了就把两组灯全部按灭**：设备会保留最后收到的灯效，不关的话就是「app 关了、键盘还亮着」。
// 两个落点：插件卸载（dispose）与**进程级退出**（Ctrl+C/SIGTERM/SIGHUP，见 ./exit-guard.js 的
// blackout 回调 —— 那条路常常等不到 dispose）。灭灯**必须同步写出去**，所以它走 #sendThstatus
// 而不是合并闸门（「exit」钩子里微任务根本不会跑）。**断开连接（close）时刻意不做**灭灯
// —— 断开随时会发生、也随时会重连，在那里关灯换来的只是「重连之后黑一片」。

import { createRequire } from 'node:module'
import { JOYSTICK_METHOD, parseJoystick } from './joystick.js'
import { createExitGuard } from './exit-guard.js'

const require = createRequire(import.meta.url)

// 说明：槽位的状态码 `st`（整数）有过一个来回 —— 2026-09-25 先按要求把整条链删掉
// （浏览器 payload / 宿主期望灯态 / 写给设备的 thstatus 全都不带 st），随后又按要求
// 以 **int** 形式加回来：空闲 0 / 运行 1 / 成功 2 / 失败 3（见 AGENT_ST）。
// 教训：这是**跨进程的线格式**，加/删都必须整条链一起动，且两边词表逐字一致（自检会断言）；
// 只往 thstatus 里塞回一个字段的话，设备会按一个没人认得的数去分支，而且不会有任何报错。

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
  SUCCESS: 2, // 成功 —— 刚跑完一轮（**宿主叠加**，见 reportSuccess）
  ERROR: 3    // 失败 —— 跑失败了（**宿主叠加**，见 reportError，同时把灯转红）
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
  #state = { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], outcomes: [], idle: null, keyT: {} }
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
  /**
   * 「**检测到设备已连接**」的判据 —— 本次链路里有没有真的收到过设备的数据。
   *
   * 为什么不能用「`open()` 成功」当判据（用户 2026-09-25 指出）：启动那一刻句柄可能开得起来
   * （设备还挂在系统里），而**蓝牙链路其实还没建立**，这时候把 `device.status` 发出去只是白发
   * 一条 —— 设备收不到，我们这边也没有任何地方会因此报错（静默白问）。
   * 唯一能证明「设备在链路上、而且在通信」的硬证据，是它自己发来的**数据帧**。
   *
   * 生命期跟着链路走：**每次 `open()` 都重置回 false**（那是「一条新链路开始」的唯一时刻），
   * 所以每次（重）连都会重新检测一次；`close()` 里也顺手清一遍（状态卫生，见那里的注释）。
   */
  #linkSeen = false
  /**
   * 「一句不吭」时的兜底探活定时器：句柄开着、`#probeMs` 里一帧都没收到 → 问一次。
   *
   * 为什么留着它：设备的协议用法是「被问才报」或「它自己刚连上时报」。宿主重启时若链路其实
   * 还在（旧连接），设备不会主动说话，不兜底问一次的话电池行会永远显示「—」（那是 2026-09-23
   * 专门修过的 bug）。代价只是链路真没建起来时白发一条 —— 那种情况写不出去，也不报错。
   */
  #probeTimer = null
  #probeMs = 15000 // 兜底延迟；DSH_OMKB_PROBE_MS 覆盖（自检脚本调小它），0 = 不兜底

  // ---------- 会话的「结果态」：运行失败（红）/ 跑完一轮（成功）----------
  // 分工：**浏览器**决定「哪个会话占哪颗键、平时是什么颜色与状态」（它才知道会话列表），
  // **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
  // 也是唯一写 HID 的人）。因此浏览器下发的槽位里带上会话 id（sid），宿主用它把事件定位到键。
  #desiredAgents = [] // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
  #slotSessions = [] // 槽位下标 → 会话 id
  /**
   * 「同拍合并」的两个暂存位（见 #renderAgents）。
   *
   *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
   *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
   *
   * 为什么要有它（用户 2026-09-25 要求：**会话信息返回给键盘设备时，一次不许发多条**）：
   * 同一个事件循环拍里会有好几个来源都要重画灯态 —— 宿主的 `agent/error` 与 `agent/status`
   * 常常连着来、浏览器 POST /omkb/agents 里 `allIdle` 翻转时还会顺手 `#wake()`。
   * 逐条写出去就是**设备一口气收到好几条 `v.oai.thstatus`**（每条还要切成 5 帧 63 字节的
   * HID 报告）。攒成一条再发，设备收到的永远是「此刻应该是什么样」。
   */
  #pendingAgents = null
  #agentsScheduled = false
  /**
   * 上一次**真正写出去**的那条 `v.oai.thstatus` 长什么样（JSON 字符串，用来比对内容）。
   *
   * 为什么同拍合并还不够（用户 2026-09-25：「thstatus 还是会发送两条」）：`#pendingAgents`
   * 只管**同一个事件循环拍**，而真实时序里同一份灯态会**跨拍**被推两次 —— 宿主的结论
   * （`agent/error`）与浏览器那一份快照相隔一拍到达（浏览器带 350ms 防抖，快照里往往还写着
   * 运行中，可宿主把结果态叠上去之后算出来的**内容完全一样**），或者浏览器自己连着推两遍。
   * 两条一模一样，设备没必要听两遍。
   *
   * 只在**写成功之后**更新（没句柄 / 写失败时不动，下次同内容仍会尝试）；
   * `close()` 清空 —— 「链路断了」是唯一必须忘掉「上次发过什么」的时刻（重连要重放）。
   */
  #lastThstatus = null
  /**
   * 槽位下标 → { sid, kind }，**结果态**（kind: 'error' | 'success'）。
   *
   * ⚠ **它不会自己过期**（2026-09-25 用户要求：「错误后不变白」）。原来的实现是 3 秒窗口，
   * 到点自动回到浏览器下发的常态；现在一直挂着，直到下面三件事之一发生：
   *   1. 该会话**重新开始运行** → 用户重试了，`clearOutcome()`（宿主 agent/status=running 驱动）；
   *   2. 该会话从槽位上消失（归档 / 关掉 / 被别的会话顶掉，见 #applyAgents 的整表重建）；
   *   3. 同一颗键上来了**更新的结论**（又失败一次 / 这回跑成功了，后写覆盖先写）。
   *
   * 「到点自动消失」这件事**不能靠浏览器重新下发来替代**：失败那一刻浏览器快照里这个会话
   * 常常还写着 running（它的推送还带 350ms 防抖），拿浏览器下发的 st 当清除判据，红灯会在
   * 亮起的同一瞬间被自己的陈旧快照抹掉。清除只认宿主的 agent/status（见 #applyAgents 的注释）。
   *
   * 两种表现：
   *   'error'   —— 状态码 st=3，**并且**把颜色换成红灯（用户可见的「上次失败了」）
   *   'success' —— 状态码 st=2，颜色不动（跑完了是正常态，不该抢眼的颜色）
   */
  #outcome = new Map()
  #errorColor = 0xff0000 // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）

  constructor({ logger, diagnostics } = {}) {
    this.#logger = logger
    this.#diagnostics = typeof diagnostics === 'function' ? diagnostics : null
    const probe = Number(process.env.DSH_OMKB_PROBE_MS)
    if (Number.isFinite(probe) && probe >= 0) this.#probeMs = probe
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1000)
    this.#dimTimer.unref()
    // 安全网只**建**不装：装的动作在 open() 成功之后（没设备就别碰进程信号）。
    // release 指向 close()：它是幂等的，重复调用安全。
    // blackout 指向 blackout()：退出（Ctrl+C 等）前必须先把灯关掉 —— 灯是设备自己记着的，
    // 进程一走没人替我们关；而宿主未必来得及走到 dispose()（见 ./exit-guard.js 顶部那一节）。
    // ⚠ blackout 必须排在 release **之前**执行（由安全网保证），否则句柄先没了就写不出去。
    this.#exitGuard = createExitGuard({
      release: () => this.close(),
      blackout: () => this.blackout(),
      log: (m) => this.#warn(m)
    })
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
    // ---- 收到设备的**第一帧** = 检测到「已连接」----
    // 排在解析之前：哪怕这一帧后面认不出来，它也已经证明了链路在通、设备在说话。
    // 这是「设备已连接」的**唯一硬证据**（句柄开得起来只说明设备还在系统里，见 #linkSeen）。
    if (!this.#linkSeen) this.#markConnected() // 里面会按需问一次电量
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
      // 重连可能发生在「结果态挂着」的时候，直接重放会把红灯/成功状态抹掉。
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
      // 这次（重）连开始检测「设备是否真的连上」——**不在这一刻问电量**。
      // 用户 2026-09-25 明确要求：dsh 启动时不要请求 device.status，等检测到设备已连接再问。
      // 理由是他那边实测启动那一刻蓝牙还没连上（句柄开得起来 ≠ 链路建立），问了也白发。
      // 判据是「收到设备的第一帧」（见 #onData → #markConnected），这里只武装兜底探活。
      this.#linkSeen = false
      this.#armProbe()
    } catch (e) {
      this.#warn(
        'node-hid 打开失败(需要正确编译的原生依赖，且设备非标准键盘):',
        e && e.message
      )
      this.#state.open = false
    }
  }

  close = () => {
    // **这里刻意不关灯**（用户 2026-09-25 明确要求）：断开是随时会发生的（设备掉线、点「重连」、
    // 宿主重扫设备），而灯效是设备自己记着的 —— 在这儿把它关掉，换来的只是「重连之后黑一片」。
    // 灭灯只发生在**整个应用要关闭**的时候（插件卸载 = 我们不再管这台设备），见 dispose()。
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
    // 顺手把「这条链路的东西」也清掉：已连接标记、兜底探活定时器。
    // ⚠ 这两句与 open() 里那句 `this.#linkSeen = false` **互为冗余**，两句都反证过：
    //   删掉任一句，跑起来的行为都不变（生产路径上 open() 永远紧跟在 close() 之后 —— 掉线是
    //   `error → close → 30 秒后 open`、重连按钮是 `close + open`、启动那次本来就是 false）。
    //   语义上的机制放在 **open()**（「谁开链路谁重置」）；这里留一份只是不让 close() 之后的状态
    //   撒谎（内部字段，眼下没有任何读取路径）。要改「重新检测」这条语义，去改 open()。
    this.#linkSeen = false
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
    // 排着队还没写出去的那一条灯态也作废（同拍合并的暂存，见 #renderAgents / #flushAgents）：
    // 链路都没了，补写只会多一行「设备未连接，忽略写回」的 warn。重连时 open() 会重新
    // #renderAgents() 重放，所以不会漏掉灯态。
    this.#pendingAgents = null
    // 顺手忘掉「上次写出去的灯态长什么样」（内容去重的账，见 #lastThstatus）：链路断过之后
    // 设备那份画面不再可信（它可能自己重启过 / 被人手动改过），重连时 `#renderAgents()` 必须
    // **真的重放一次**，不能被内容比对挡掉。
    // 机制就放在这里 —— `open()` 开头有 `if (this.#hid || this.#state.open) return` 早退，
    // 把清零写它里面反而会漏；这里不存在「谁先谁后」的歧义。
    this.#lastThstatus = null
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

  // ---------- 「设备已连接」的检测 ⇒ 才去问电量 ----------
  /**
   * 检测到设备已连接时：停掉兜底、必要时问一次电量。
   *
   * 由 `#onData` 在收到**第一帧**时调用，而且必须排在**解析之前** —— 「设备在链路上说话」这件事
   * 只要有一帧就能证明，哪怕这一帧认不出来（调错通道、固件换了字段、JSON 截断）。
   * 把这个判据往后挪（等解析成功）等于给「已连接」加了一道会失败的前置条件：漏判的代价是整个
   * 功能静默失效（电池行永远「—」），而它的收益只是省掉一条请求。
   * 代价如实写在这里：**设备自己刚连上时推的那条 `device.status` 也会触发我们问一次**（因为
   * 判连接在解析之前，那时 `battery` 还是 null）。一次多余的查询，换来判据不吃解析的成败。
   *
   * 「手上已经有读数就不再问」这条留给**兜底路径**（见 #armProbe 与它的守卫）。
   */
  #markConnected = () => {
    this.#linkSeen = true
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
    this.#log('检测到设备已连接（收到第一帧数据）')
    if (this.#state.battery === null) this.#requestStatus()
  }

  /**
   * 武装「一句不吭」的兜底探活：`#probeMs` 内一帧都没收到，才主动问一次电量。
   *
   * 只在 open() 成功后武装一次，设备一开口（#markConnected）或链路一断（close）就撤掉。
   * 它**不是**「连上就问」：它要等满了整个窗口，且期间设备一声不响 —— 那才是「链路可能还活着、
   * 但设备不会自己说话」的那种旧连接（宿主重启）。
   */
  #armProbe = () => {
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
    if (!(this.#probeMs > 0)) return
    this.#probeTimer = setTimeout(() => {
      this.#probeTimer = null
      // 已经说过话 / 已经断开：都不该再兜底（断开时 close() 本来也会把它撤掉，这里是双保险）
      if (!this.#hid || !this.#state.open || this.#linkSeen) return
      this.#log(`打开句柄后 ${this.#probeMs}ms 没收到设备的任何数据 → 兜底问一次电量`)
      this.#requestStatus()
    }, this.#probeMs)
    this.#probeTimer.unref?.()
  }

  /**
   * 向设备要一次状态（电量 / 是不是在充电）。
   *
   * 协议用法（用户 2026-09-23 给的）：**发一条 `device.status`，设备就会上报** `battery`（电量）
   * 与 `is_charging`（是否在充电）。设备自己不会定时推，所以想拿到读数就得问一次。
   *
   * ⚠ 调用时机由**「检测到设备已连接」**决定，不是 open() 那一刻（用户 2026-09-25 改的口径）：
   *   · 正常路径 —— 收到设备的第一帧（#markConnected，且手上还没读数）；
   *   · 兜底路径 —— 句柄开着但 `#probeMs` 内一声不吭（#armProbe）。
   * 启动那一刻蓝牙链路往往还没建立，那时候问就是白发一条（设备收不到、也没人会报错）。
   * params 给空对象 —— 这是「把你的状态告诉我」的查询，不带参数。
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
  // 每个槽位恰好 5 个字段：id / c / b / e / st。
  // 曾经还发过 s / sk / sa —— 它们**从头到尾恒为 0**（没有任何一行代码给过别的值），
  // 2026-09-25 按用户要求删掉。要加新字段，先答得出「谁产出它、谁消费它」。
  //
  // 自动调暗期间一律把 e/b 压成 0：调暗是「灯全灭」，而浏览器仍会照常推送灯态
  // （设置页打开、会话列表变化都会触发），不压的话下一次推送就把灯又点亮了。
  // st **不压**：它是语义而不是光学量，压成「空闲」会让设备以为会话跑完了。
  /**
   * 一组槽位 → 真正写给设备的参数（白名单 5 字段 + 取值范围收敛 + 调暗压灭）。
   * **不改变任何状态、不碰设备** —— 什么时候把它交出去由调用方决定。
   */
  #thstatusParams = (slots) => {
    const dimmed = this.#dimmed
    return slots.slice(0, 6).map((s, i) => ({
      id: i,
      c: this.#clampRgb(s && s.c),
      b: dimmed ? 0 : this.#clamp01(s && s.b, 0),
      e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
      st: this.#clampSt(s && s.st)
    }))
  }

  /**
   * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
   *
   * 内容与**上一次真正写出去的**完全一致时直接跳过，并记一行日志。
   * 比对的是**规范化之后**的参数，所以「先失败、随后浏览器补一份陈旧快照」这种重复也认得出来
   * —— 它算出来的红灯与宿主刚写出去的逐字节相同（见 `#lastThstatus` 的注释）。
   * @returns {boolean} 是否真的写了（内容没变时为 false，这不是错误）。
   */
  #writeThstatus = (params) => {
    const key = JSON.stringify(params)
    if (key === this.#lastThstatus) {
      this.#log('灯态与上次写出去的完全相同 → 跳过重复写回')
      return false
    }
    const ok = this.#sendRpc('v.oai.thstatus', params)
    if (ok) this.#lastThstatus = key
    return ok
  }

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
   * @returns {boolean} 是否真的写给了设备（内容与上次相同 → false）。
   */
  #sendThstatus = (slots) => {
    if (!Array.isArray(slots)) return false
    const params = this.#thstatusParams(slots)
    this.#state.agents = params
    return this.#writeThstatus(params)
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
   *     宿主未必来得及走到 `dispose()`（见 ./exit-guard.js 顶部「退出前必须灭灯」）。
   *
   * 幂等：重复调用只是把同一份「全灭」再写一遍，弄不坏任何状态（插件可能被卸载两次、
   * 安全网也可能在 exit 钩子上再调一次）。
   *
   * 它会让 `state.agents` 也变成全 0（`#sendThstatus` 的正常副作用）：这正是设备此刻
   * 真实的样子，也是 /omkb/state 该报的事实。**期望灯态 `#desiredAgents` 一个字节都不动**。
   * @returns {boolean} 两条指令是否真的写出去了（没连上、或内容与上次完全相同被跳过时 false）。
   */
  #lightsOff = () => {
    const dim = this.#sendBrightness(0)
    const dark = this.#sendThstatus(BLACKOUT_SLOTS)
    return dim && dark
  }

  /**
   * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 `close` 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」（见 test/lib/exit-guard-child.mjs）——
   * 而 `#lightsOff` 是私有的，从外面换不掉。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => {
    if (!this.#hid || !this.#state.open) return false
    return this.#lightsOff()
  }

  // ---------- 期望灯态 + 结果态 ⇒ 实际灯态 ----------
  // 会话灯态的**唯一出口**：把浏览器下发的期望灯态与「上一轮跑出结论的那几颗键」叠加后写 HID。
  // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把结果态
  // 冲掉——收不收只由宿主说了算（见 #latchOutcome 与 #applyAgents）。
  //
  // ⚠ **同拍合并**（用户 2026-09-25）：这里**不直接写设备**，只把「此刻应该是什么样」算出来存进
  // `#pendingAgents`，真正的写入排到当前这一拍的末尾（微任务）。同一拍里再被调用多少次都只是
  // 覆盖那一份内容 —— 设备因此只会收到**一条** `v.oai.thstatus`。谁后到谁赢，因为它们算的都是
  // 同一个问题的答案：此刻应该是什么样。
  //
  // 光有这一层还不够（用户当天实测「thstatus 还是会发送两条」）：它只管**同一拍**，而同一份
  // 灯态常**跨拍**被推两次（宿主结论与浏览器那份带 350ms 防抖的快照错开到达，内容一模一样）。
  // 那一半由 `#writeThstatus` 的**内容去重**兜住 —— 两条防线各管一段，缺一不可。
  //
  // 诊断字段（`#state.agents` / `#state.outcomes`）留在**同步**这一半更新：读它的人
  // （GET /omkb/state、自检）不该被一个微任务的时序影响。
  //
  // 反过来，**灭灯不走这里**（见 #sendThstatus 的注释）：退出路径必须同步写出去。
  #renderAgents = () => {
    if (!this.#desiredAgents.length) return false
    const params = this.#thstatusParams(this.#composeAgents())
    this.#state.agents = params
    // 排查用：哪些键此刻挂着结果态（红/成功）、分别是哪个会话。它们是**不会自己消失**的，
    // 所以「灯的颜色没人解释」时，先来这里看是谁挂的。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }))
    this.#pendingAgents = params
    if (!this.#agentsScheduled) {
      this.#agentsScheduled = true
      queueMicrotask(this.#flushAgents)
    }
    return true
  }

  /**
   * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
   *
   * 断开时 `close()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了多一行
   * 「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 `open()` 会重新 `#renderAgents()`
   * 把灯态重放出来，不会漏（`close()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
   * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
   */
  #flushAgents = () => {
    this.#agentsScheduled = false
    const params = this.#pendingAgents
    this.#pendingAgents = null
    if (!params) return false
    return this.#writeThstatus(params)
  }

  /**
   * 期望灯态 + 结果态 → 6 个槽位（设备字段形态）。不改变状态、不碰设备。
   *
   * 结果态只认「此刻占着这个槽位的那个会话」：会话消失 / 换人时宁可少亮一盏，也不要把
   * 别人上一轮的失败挂到新来的会话身上（`#applyAgents` 已经整表重建过，这里是出口兜底）。
   */
  #composeAgents = () => this.#desiredAgents.map((s, i) => {
    const out = this.#outcome.get(i)
    const mine = out && this.#slotSessions[i] === out.sid ? out : null
    const red = !!mine && mine.kind === 'error'
    return {
      id: i,
      // 失败压过一切；成功只是「状态码是 2」，颜色仍按浏览器给的那份。
      st: red ? AGENT_ST.ERROR : (mine ? AGENT_ST.SUCCESS : s.st),
      c: red ? this.#errorColor : s.c,
      b: s.b,
      e: s.e
    }
  })

  /**
   * 某个会话这一轮跑出了结论 → 让它占的那几颗键**保持**这个结果态，直到该会话重新运行
   * （见 clearOutcome）。
   * @param sessionId - 会话 id（DSH 里 agent.id 就是会话 id）。
   * @param kind - 'error'（运行失败，**顺带把灯换成红灯**）| 'success'（正常跑完一轮，只改状态码）。
   * @returns {boolean} 是否真的命中了某个键（该会话没占键时为 false，不算异常）。
   */
  #latchOutcome = (sessionId, kind) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    const bad = kind === 'error'
    const slots = []
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i)
    if (slots.length === 0) return false // 不在侧边栏 / 还没下发过灯态 → 没有键可亮
    // 同槽位后写覆盖先写：失败之后重试成功，红灯该被成功盖掉（反过来则说明重试又失败了，
    // 那个也是新的结论）。两颗键对应同一会话时一起设。
    for (const slot of slots) this.#outcome.set(slot, { sid: sessionId, kind })
    this.#renderAgents()
    this.#log(bad
      ? `会话运行失败 → 槽位 ${slots.join(',')} 转红灯（保持到该会话重新运行）`
      : `会话跑完一轮 → 槽位 ${slots.join(',')} 报成功（保持到该会话重新运行）`)
    return true
  }

  /**
   * 某个会话运行失败 → 让它的那颗键**一直红着**（状态码同时变 3），不再自己变回白色。
   *
   * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
   * 时发出：用户主动中断走的是另一条分支，不会转红。
   * 收掉它的唯一常规途径是「该会话重新开始运行」（clearOutcome）。
   */
  reportError = (sessionId) => this.#latchOutcome(sessionId, 'error')

  /**
   * 某个会话**正常跑完一轮** → 让它那颗键一直报 st=2（成功），颜色不动。
   *
   * 由宿主的 `agent/turn-stopping` 驱动：那是「这一轮要收尾了」的钩子，用户中断
   * （signal.aborted）与真失败（agent/error）都在它之前就 throw 掉了，走不到这一步 ——
   * 所以它天然就是「成功」的信号，不需要再去比对什么 reason。
   */
  reportSuccess = (sessionId) => this.#latchOutcome(sessionId, 'success')

  /**
   * 某个会话**重新开始运行** → 收掉它的结果态（红 / 成功），回到浏览器下发的常态（蓝）。
   *
   * 这是结果态唯一会「自己走掉」的途径，由宿主的 `agent/status`（status === 'running'）驱动：
   * 那是 agent loop 的相位变化，用户重试 = 新一轮 = 相位从 idle 变 running。
   *
   * 为什么**不**拿浏览器下发的 `st=1` 当清除判据：浏览器那份快照带 350ms 防抖，失败发生的
   * 那一刻它手里往往还写着「这个会话在跑」，把它当成「用户重试了」会让红灯刚亮就被抹掉
   * ——那正是这次要修的病（见 #outcome 的注释）。
   * @param sessionId - 会话 id。
   * @returns {boolean} 是否真的收掉了某个结果态（本来就没挂时为 false）。
   */
  clearOutcome = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    let hit = false
    for (const [slot, t] of [...this.#outcome]) {
      if (t.sid !== sessionId) continue
      this.#outcome.delete(slot)
      hit = true
    }
    if (!hit) return false
    this.#renderAgents()
    this.#log(`会话 ${sessionId} 重新开始运行 → 收掉结果灯`)
    return true
  }

  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor } 或纯数组）
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
    this.#renderAgents()
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
    if (this.#reconnectTimer) { clearInterval(this.#reconnectTimer); this.#reconnectTimer = null }
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
    // **进程要走了就把灯关掉**（用户 2026-09-25 要求）。这里是灭灯的落点之一：插件被卸载
    // = 我们不再管这台设备了，而设备不会因为 BLE 断开自己熄灭 —— 它会一直亮着最后那幅画面
    // （Agent 键亮着、氛围灯亮着），看起来就像「app 都关了，键盘还亮着」。
    // **另一个落点是退出安全网**（Ctrl+C/SIGTERM/SIGHUP，见 ./exit-guard.js）—— 宿主优雅关闭
    // 那条路未必走得到这里（用户实测「Ctrl+C 之后灯还亮着」）。
    // 断开（close）时故意不做这件事，见那里的注释。
    // 必须排在 close() **之前**：唯一出口 #sendRpc 要先看到活着的句柄才写得出去。
    this.blackout()
    // 卸下安全网（只移除我们自己注册的监听者 + 'exit' 钩子，宿主的一个都不碰；幂等）。
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
    reportError: ctl.reportError,
    reportSuccess: ctl.reportSuccess,
    clearOutcome: ctl.clearOutcome,
    // 测试注入（自检脚本用它喂摇杆帧，见 #feedLine）；宿主运行时不用。
    feedLine: ctl.feedLine,
    dispose: ctl.dispose,
    state: ctl.state
  }
}
