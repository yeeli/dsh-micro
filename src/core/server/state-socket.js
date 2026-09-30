// dsh-micro · server/state-socket.js
// **状态推送（WebSocket）** —— 把「浏览器每 120ms 问一次 /micro/state」换成宿主主动推。
//
// ── 为什么换 ──────────────────────────────────────────────────────────────
// HTTP 轮询的两条固有代价：
//   · **延迟与频率绑死**：想更快就得更高频（120ms 已经是一拍 ~60ms 的平均延迟），
//     而绝大多数轮询是空转（设备经常几秒不动一下）；
//   · **每个标签页一份空转流量**：设置页多开几个就多几份。
// 推送把这两条一起解决：**事件驱动**（设备每上报一行、连接/断开、灯态写入、亮度变化都推），
// 另加 500ms 心跳兜底。
//
// ── 为什么同一个路径既能 GET 又能升级（`/micro/state`）─────────────────────
// DSH 的 webServer 内部有三张**互相独立**的表：exact / prefixes / **upgrades**。
// `registerUpgrade({ path, handler })` 只动 upgrades，与 HTTP 路由表不冲突 ——
// 于是 GET /micro/state（快照，设置页与 curl 诊断仍在用）与 WS /micro/state 并存。
// upgrade handler 自己拥有握手与 socket 的全部使用权（见 dsh-host-webserver 的注释）。
//
// ── 心跳为什么是 500ms，而且**内容不变也要发** ─────────────────────────────
// press-state（客户端那种「按下就陷下去、松开才抬起」的视觉）有一条判据：
// 宿主静默超过 STALE_MS=1200ms 就当按键状态不可信、把按住的键全抬起来
// （见 src/client/utils/press-state.js）。**纯事件驱动会打破它** —— 按住一颗键不放时，
// 设备只在按下/松开各发一行，之后一帧都没有，1.2 秒后那顆键在界面上自己弹起。
// 所以心跳必须明显小于 1200ms（取 500ms），且**不做内容去重**（去重了就等于不发）。
//
// ── 为什么握手要校验 Origin ───────────────────────────────────────────────
// WebSocket **没有 CORS**：任意网页都能连本机端口、读走我们的状态（会话标题、电量）。
// 前端与 webserver 同源（dsh-host-frontend-static 用 registerFallback，不带任何 CORS 头），
// 所以判据很简单：**带了 Origin 就必须与请求 Host 同源**；不带 Origin 的（curl、自检脚本、
// 非浏览器客户端）放行。桌面壳/开发态可能出现 localhost 端口分叉，回环地址一律放行。
//
// ── 端口分叉之外的另一条纪律：失败必须降级 ─────────────────────────────────
// ws 解析不到 / 宿主没有 registerUpgrade / 路由被占用 —— 任何一种都只记一条 warning 并返回
// null，**客户端会自动退回 HTTP 轮询**（见 src/client/hid-bridge.js）。推送是优化，不是命脉。

import { PATHS } from './paths.js'
import { loadDep } from '../resolve.js'

/** 合帧窗口（ms）：同一拍里接二连三的状态变更只推最后一条（避免按键连击时刷一串旧帧）。 */
export const COALESCE_MS = 25
/**
 * 心跳间隔（ms）。**必须明显小于客户端 press-state 的 STALE_MS=1200**（见文件头），
 * 且不做内容去重 —— 它存在的意义就是「哪怕什么都没变也证明宿主还活着」。
 */
export const KEEPALIVE_MS = 500
/** ping 间隔（ms）：60 秒内没收到 pong 就掐掉那条连接（对端进程被杀、网卡拔了都不会发 close）。 */
export const PING_MS = 30000

/** 回环地址一律放行（桌面壳 / 开发态的端口分叉都落在这里）。 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * 握手准入：带了 Origin 就必须与请求 Host 同源。
 * @param {object} req - node:http 的 IncomingMessage。
 * @returns {boolean} 是否允许升级。
 */
export const originAllowed = (req) => {
  const origin = req && req.headers ? req.headers.origin : null
  // 没有 Origin = 不是浏览器发起的（curl / 自检 / 非浏览器客户端）：没有「用户的另一个标签页」
  // 这回事，也就没有跨源读取的风险。
  if (typeof origin !== 'string' || origin.length === 0) return true
  let url = null
  try { url = new URL(origin) } catch (e) { return false } // 畸形的 Origin 一律拒
  if (LOOPBACK_HOSTS.has(url.hostname)) return true
  const host = req.headers.host
  return typeof host === 'string' && host.length > 0 && url.host === host
}

/**
 * 建一个状态推送器。**不含 ws 的任何 import** —— WebSocketServer 由调用方（registerStateSocket）
 * 解析后注入，这样本模块可以被自检直接 import（不必先解析到 ws）。
 *
 * @param {object} options
 * @param {object} options.ble - BLE 门面（要 snapshot 与 onChange）。
 * @param {Function} options.WebSocketServer - ws 的 WebSocketServer 构造器。
 * @param {object} [options.logger]
 * @param {number} [options.coalesceMs]
 * @param {number} [options.keepaliveMs]
 * @param {number} [options.pingMs]
 * @returns {{handleUpgrade: Function, push: Function, start: Function, dispose: Function, frame: Function, clientCount: Function}}
 */
export const createStateSocket = ({
  ble,
  WebSocketServer,
  logger = null,
  coalesceMs = COALESCE_MS,
  keepaliveMs = KEEPALIVE_MS,
  pingMs = PING_MS
} = {}) => {
  const warn = (msg) => { try { logger && logger.warn && logger.warn(msg) } catch (e) {} }
  const info = (msg) => { try { logger && logger.info && logger.info(msg) } catch (e) {} }

  /** 已连接客户端：{ socket, alive } 包装（alive 由 pong 复位，见 ping 定时器）。 */
  const clients = new Set()
  const wss = new WebSocketServer({ noServer: true })

  let offChange = null
  let beatTimer = null
  let pingTimer = null
  let flushTimer = null
  let disposed = false

  /** 当前快照的报文（取不到就返回 null，调用方跳过这一帧）。 */
  const frame = () => {
    try { return JSON.stringify(ble.snapshot()) } catch (e) { return null }
  }

  const deliver = () => {
    flushTimer = null
    const payload = frame()
    if (payload === null) return
    for (const c of [...clients]) {
      if (c.socket.readyState !== 1) continue // 1 = OPEN
      try { c.socket.send(payload) } catch (e) { warn(`[micro] 状态推送失败：${(e && e.message) || e}`) }
    }
  }

  /**
   * 推一帧（合帧窗口内只安排一次）。**不做内容去重** —— 心跳必须每拍都发出去，
   * 内容相同恰恰是最需要「报平安」的时候（见文件头）。
   */
  const push = () => {
    if (disposed || flushTimer) return
    flushTimer = setTimeout(deliver, coalesceMs)
    flushTimer.unref?.()
  }

  const handleUpgrade = (req, socket, head) => {
    if (!originAllowed(req)) {
      warn(`[micro] 拒绝跨源 WebSocket 连接：Origin=${req && req.headers && req.headers.origin} Host=${req && req.headers && req.headers.host}`)
      try { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n') } catch (e) {}
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => { wss.emit('connection', ws, req) })
  }

  wss.on('connection', (ws) => {
    const c = { socket: ws, alive: true }
    clients.add(c)
    ws.on('pong', () => { c.alive = true })
    ws.on('error', (e) => { warn(`[micro] 状态推送连接异常：${(e && e.message) || e}`) })
    ws.on('close', () => { clients.delete(c) })
    // 连上立刻给一帧：否则首屏按键/电量要等最多一个心跳（500ms）才出现。
    const payload = frame()
    if (payload !== null) { try { ws.send(payload) } catch (e) {} }
    info(`[micro] 状态推送客户端接入（当前 ${clients.size} 个）`)
  })

  /** 挂上事件源与两个定时器（**定时器一律 unref**，绝不因为推送把宿主进程留住）。 */
  const start = () => {
    if (disposed) return
    if (typeof ble.onChange === 'function') offChange = ble.onChange(() => push())
    beatTimer = setInterval(push, keepaliveMs)
    beatTimer.unref?.()
    pingTimer = setInterval(() => {
      for (const c of [...clients]) {
        if (!c.alive) {
          // 两拍都没回 pong（对端进程被杀、链路已死但没发 close）→ 掐掉，别留一个僵尸在集合里
          try { c.socket.terminate() } catch (e) {}
          clients.delete(c)
          continue
        }
        c.alive = false
        try { c.socket.ping() } catch (e) {}
      }
    }, pingMs)
    pingTimer.unref?.()
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (offChange) { try { offChange() } catch (e) {}; offChange = null }
    if (beatTimer) { clearInterval(beatTimer); beatTimer = null }
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    for (const c of [...clients]) { try { c.socket.close() } catch (e) {} }
    clients.clear()
    try { wss.close() } catch (e) {}
  }

  return { handleUpgrade, push, start, dispose, frame, clientCount: () => clients.size }
}

/**
 * 把状态推送挂到宿主 webserver 上。**任何一种失败都降级**（记 warning、返回 null），
 * 客户端会自动退回 HTTP 轮询。
 *
 * @param {object} webServer - 宿主 webServer 服务（要 registerUpgrade）。
 * @param {object} ble - BLE 门面。
 * @param {object} [logger]
 * @param {object} [options] - 透传给 createStateSocket（自检用来缩短窗口）。
 * @returns {Promise<{socket: object, dispose: () => void} | null>}
 */
export const registerStateSocket = async (webServer, ble, logger = null, options = {}) => {
  const warn = (msg) => { try { logger && logger.warn && logger.warn(msg) } catch (e) {} }
  const info = (msg) => { try { logger && logger.info && logger.info(msg) } catch (e) {} }

  if (!webServer || typeof webServer.registerUpgrade !== 'function') {
    warn('[micro] 宿主未提供 webServer.registerUpgrade，状态推送不可用（客户端退回 HTTP 轮询）')
    return null
  }
  const loaded = await loadDep('ws')
  if (!loaded.ok) {
    warn(`[micro] 未解析到 ws，状态推送不可用（客户端退回 HTTP 轮询）：${loaded.reason}`)
    return null
  }
  const WebSocketServer = (loaded.mod && loaded.mod.WebSocketServer) ||
    (loaded.mod && loaded.mod.default && loaded.mod.default.WebSocketServer)
  if (typeof WebSocketServer !== 'function') {
    warn(`[micro] ws 里没有 WebSocketServer（经 ${loaded.root}），状态推送不可用（客户端退回 HTTP 轮询）`)
    return null
  }

  const socket = createStateSocket({ ble, WebSocketServer, logger, ...options })
  let removeRoute = null
  try {
    removeRoute = webServer.registerUpgrade({ path: PATHS.state, handler: socket.handleUpgrade })
  } catch (e) {
    warn(`[micro] 注册 WebSocket 路由失败（${(e && e.message) || e}），状态推送不可用（客户端退回 HTTP 轮询）`)
    socket.dispose()
    return null
  }
  socket.start()
  info(`[micro] 状态推送已启用：ws ${PATHS.state}（同一路径的 GET 快照保留；客户端连不上时仍退回 HTTP 轮询）`)
  return {
    socket,
    dispose: () => {
      try { socket.dispose() } catch (e) {}
      try { if (removeRoute) removeRoute() } catch (e) {}
    }
  }
}