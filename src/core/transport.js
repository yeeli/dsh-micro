// dsh-omkb · core/transport.js
// **HID 传输层** —— 与 node-hid 打交道的那一半，从 ble.js 分拆出来。
//
// BLE = 蓝牙 HID。macOS 上标准 HID 键盘被系统独占，node-hid 读不到；
// 只能读"厂商自定义类"设备。omkb 的 ReportMap 为 Usage Page 0xFF00、
// Report ID 6、63 字节输入 + 63 字节输出，与 Codex Micro 同款。
//
// 设备识别：product 名包含 'omkb' 且 manufacturer 为 'OM'（均可通过环境变量覆盖）；
// 优先按 VID:PID 精确匹配，默认 0x303A:0x8361，可用 DSH_HID_VID/DSH_HID_PID 覆盖。
// 报告分帧：node-hid 每次给 63 字节数据 = [channel(1=debug,2=RPC), len, payload<=61]，
// 首字节可能是 report id(0x06)。JSON 行以 '\n' 结尾，可能跨多帧，需累计重组。
//
// 本模块负责：打开目标设备、按分帧拆包成「一行 JSON」交给上层解析（#onLine）、
// 把 JSON-RPC 分帧写回设备（writeRpc）、设备断开后每 30 秒重连、以及两处**时机**：
//   · 「设备已连接」的判据 = 收到设备的第一帧数据（#markConnected），到那时才问一次电量；
//     另有兜底：句柄开着但 #probeMs 内一声不吭，才主动问一次（见 #armProbe）。
//   · 退出安全网（见 ./guard.js）：句柄会持有事件循环引用，握上它之后要保证 Ctrl+C
//     依然能把进程带走 —— 但**只有真的打开了设备才 install()**（没句柄就完全不碰进程信号）。
//
// 它**不认识灯态/按键语义**：数据行原样递出去，由 input.js / leds.js 各自解释。
// guard 的两个回调（release/blackout）由上层注入，且闭包指向**上层**的 this —— 上层
// 把 close/blackout 写成公有类字段（可被自检替换），我们必须调它们、而不是自己实现。

import { createRequire } from 'node:module'
import { createExitGuard } from './guard.js'
import { logSink } from './log.js'
import { STATUS_METHOD } from './protocol.js'

const require = createRequire(import.meta.url)

export class HidTransport {
  // ---------- 配置（可用环境变量覆盖） ----------
  #reportId = 0x06 // ReportMap: 0x85, 0x06
  #channelRpc = 0x02 // 2 = RPC（1 = debug，忽略）
  // 设备匹配：优先按 VID:PID；默认 0x303A:0x8361，可用 DSH_HID_VID/DSH_HID_PID（十六进制字符串）覆盖；
  // 未配置 VID/PID 时回退到旧的 name/manufacturer 匹配（DSH_HID_NAME/DSH_HID_MFR）
  #vendorId = this.#parseHex(process.env.DSH_HID_VID || '0x303A')
  #productId = this.#parseHex(process.env.DSH_HID_PID || '0x8361')
  #deviceName = (process.env.DSH_HID_NAME || 'OMKB').toLowerCase()
  #deviceMfr = (process.env.DSH_HID_MFR || 'OMKB LAB').toLowerCase()

  #state = null
  #logger
  #hid = null
  #lineBuf = '' // 跨帧重组 buffer，按 '\n' 切 JSON 行
  #rpcId = 0 // 灯光/查询控制（Codex Micro 兼容协议）
  #onLine = null
  #onOpened = null
  #onBlackout = null
  /**
   * 进程退出安全网（见 ./guard.js）。
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

  /** @param {{logger?: any, state: object, onLine: Function, onOpened?: Function, onBlackout?: Function, guard?: {release: Function, blackout: Function, log?: Function}}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null, onLine = null, onOpened = null, onBlackout = null, guard = {} } = options
    this.#logger = logger
    this.#state = state
    this.#onLine = onLine
    this.#onOpened = onOpened
    this.#onBlackout = onBlackout
    const probe = Number(process.env.DSH_OMKB_PROBE_MS)
    if (Number.isFinite(probe) && probe >= 0) this.#probeMs = probe
    // 安全网只**建**不装：装的动作在 open() 成功之后（没设备就别碰进程信号）。
    // release / blackout 指向**上层**的公有落点（close / blackout，都是类字段、可被自检替换）：
    // blackout 必须排在 release **之前**执行（由安全网保证），否则句柄先没了就写不出去。
    this.#exitGuard = createExitGuard({
      release: guard.release,
      blackout: guard.blackout,
      log: guard.log || ((m) => this.#warn(m))
    })
  }

  // 自检用：拿到退出安全网句柄（`test/verify_exit_guard.js` / `test/lib/exit-guard-child.mjs`
  // 用它在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）。
  get exitGuard() { return this.#exitGuard }

  // 日志同时打到 Cordis logger 和「我们自己那一份」（开发版 = 终端 stdout/stderr，方便
  // 从命令行用 `dsh web` 调试；**正式版 = 只写 $DSH_HOME/logs/dsh-omkb.log**，终端安静）。
  // 去向由 ./log.js 的 logSink 定（构建期常量 __OMKB_RELEASE__，见那边的注释）。
  #log = (...a) => { try { this.#logger?.['info']?.(...a) } catch (e) {}; logSink.info(...a) }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; logSink.warn(...a) }

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
      // （见 ./guard.js 顶部：为什么不能像以前那样在信号回调里同步 close）。
      this.#exitGuard?.install()
      // 连上后停止自动重连定时器
      if (this.#reconnectTimer) { clearInterval(this.#reconnectTimer); this.#reconnectTimer = null }
      this.#log(`已打开 HID 设备: ${this.#state.product} (manufacturer=${cand.manufacturer || ''})`)
      // 设备（重）连后重放灯态。交给上层走 #renderAgents 而不是直接重放上次的原始参数：
      // 重连可能发生在「结果态挂着」的时候，直接重放会把红灯/成功状态抹掉。
      this.#onOpened?.()
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
    // 灭灯只发生在**整个应用要关闭**的时候（插件卸载 = 我们不再管这台设备），见 leds.js 与上层 dispose()。
    if (this.#hid) {
      try { this.#hid.close() } catch (e) {}
      this.#hid = null
    }
    this.#state.open = false
    // 顺手把「这条链路的东西」也清掉：已连接标记、兜底探活定时器。
    // ⚠ 这两句与 open() 里那句 `this.#linkSeen = false` **互为冗余**，两句都反证过：
    //   删掉任一句，跑起来的行为都不变（生产路径上 open() 永远紧跟在 close() 之后 —— 掉线是
    //   `error → close → 30 秒后 open`、重连按钮是 `close + open`、启动那次本来就是 false）。
    //   语义上的机制放在 **open()**（「谁开链路谁重置」）；这里留一份只是不让 close() 之后的状态
    //   撒谎（内部字段，眼下没有任何读取路径）。要改「重新检测」这条语义，去改 open()。
    this.#linkSeen = false
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
  }

  // --- 设备走了之后属于「链路」、不属于「灯态」的那部分收尾，由上层 close() 调本方法后
  //     再让 leds 清自己的账（见 ble.js 的 close 与 leds.js 的 resetOnDisconnect）。
  // 断开后每 30 秒自动重连一次，直到设备重新可用（手动重连：先关再开）。
  reconnect = () => {
    this.close()
    this.open()
  }

  // recoverable 的收尾（插件卸载）：停重连/探活定时器 + 卸下安全网。
  // **不关句柄** —— 上层要先灭灯（唯一出口 #sendRpc 要看到活着的句柄才写得出去），
  // 灭完灯再由上层 close()。顺序见 ble.js 的 dispose。
  dispose = () => {
    if (this.#reconnectTimer) { clearInterval(this.#reconnectTimer); this.#reconnectTimer = null }
    if (this.#probeTimer) { clearTimeout(this.#probeTimer); this.#probeTimer = null }
    // 卸下安全网（只移除我们自己注册的监听者 + 'exit' 钩子，宿主的一个都不碰；幂等）。
    this.#exitGuard?.dispose()
  }

  /**
   * 灭灯的对外落点（由上层 blackout 调用；自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」。
   * 真正的写灯实现在 leds.js（#onBlackout）—— 它必须**同步**写出去（退出路径上没有微任务）。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => {
    if (!this.#hid || !this.#state.open) return false
    return this.#onBlackout?.() || false
  }

  // ---------- HID 写回：JSON-RPC 分帧写入（用于灯光/亮度/查询控制） ----------
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

  /** 上层（leds.js）写灯的入口 —— 只是 #sendRpc 的公有包装。 */
  writeRpc = (method, params) => this.#sendRpc(method, params)

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
        try { this.#onLine?.(line) } catch (e) { this.#warn(`丢弃异常行: ${e && e.message ? e.message : e}`) }
      }
    }
    if (this.#lineBuf.length > 4096) this.#lineBuf = '' // 防呆：异常长缓冲直接丢弃
  }
}