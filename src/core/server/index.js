// dsh-micro · server/index.js
//
// 「宿主与 webserver 通信」的唯一入口。所有 /micro/* 路由（8 条）都在这里汇总注册，
// 由 server/ 下按功能域拆分的三个模块各自认领：
//   device.js  —— state / config / status / reconnect（与设备直接相关）
//   agents.js  —— agents（灯态，最重的一条）
//   system.js  —— monitor / open-privacy / archive（系统与宿主能力）
// 另有一条**不是 HTTP 路由**的挂点：
//   state-socket.js —— ws `/micro/state`（状态推送；与 device.js 那条 GET 同路径，
//                      占的是 webserver 的 upgrades 表，见那边的注释）
//
// 与 ble.js / index.js 的分界：
//   · ble.js 只管「设备 + 灯态业务」，**一行 HTTP 代码都不认识**；
//   · 这里的各模块只管「怎么从 HTTP 进来、怎么回 JSON」，业务体调 ble 门面；
//   · index.js（插件主体）把 ctx / ble / logger 递给 registerServerRoutes，自己不再碰路由细节。
//
// 注册动作发生在宿主注入 webServer 服务的上下文里（ctx.inject(['webServer'])），这是
// 依赖注入的硬要求：webServer 不是全局，必须声明依赖后才能访问。

import { registerDeviceRoutes } from './device.js'
import { registerAgentsRoute } from './agents.js'
import { registerSystemRoutes } from './system.js'
import { registerStateSocket } from './state-socket.js'

/**
 * 汇总注册全部 8 条 /micro/* 路由。
 *
 * @param {object} ctx - 宿主插件上下文（有 inject / get）。
 * @param {object} deps
 * @param {object} deps.ble - BLE 读取器门面（snapshot / state / requestStatus / applyAgents / applyConfig / reconnect）。
 * @param {object} deps.monitor - 带缓存的输入监控检测器（read(force)）。
 * @param {(pane: string) => Promise<boolean>} deps.openPrivacy - 打开隐私面板。
 * @param {{ warn: (msg: string) => void, info?: (msg: string) => void }} [deps.logger]
 * @returns {{ dispose: () => void }} 统一清理句柄（ble 相关 + 系统相关一起退订）。
 */
export const registerServerRoutes = (ctx, deps) => {
  const { ble, monitor, openPrivacy, logger = null } = deps
  const warn = (msg) => { logger && logger.warn && logger.warn(msg) }

  let disposeAll = null

  ctx.inject(['webServer'], (wctx) => {
    const webServer = wctx.webServer
    if (!webServer || typeof webServer.register !== 'function') {
      warn('[micro] 宿主未提供 webServer 服务，HTTP 路由不可用')
      return
    }

    // 归档服务可选：宿主版本可能没给 workspaceRegistry。
    let ws = null
    try {
      ws = (typeof wctx.get === 'function' && wctx.get('workspaceRegistry')) || wctx.workspaceRegistry || null
    } catch (e) {
      ws = null
    }
    if (!ws || typeof ws.archiveSession !== 'function') {
      warn('[micro] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用')
    }

    const disposers = [
      registerDeviceRoutes(webServer, ble, logger),
      registerAgentsRoute(webServer, ble, logger),
      registerSystemRoutes(webServer, { monitor, openPrivacy, workspaceRegistry: ws }, logger)
    ]
    disposeAll = () => { for (const d of disposers) d() }

    // ---- 状态推送（WebSocket）：与 GET /micro/state **同一条路径** ----
    // DSH webserver 的 upgrades 表与 HTTP 路由表互相独立（见 state-socket.js 顶部），
    // 所以这里不新增地址，客户端 URL 一个字都不用改。
    //
    // 注册是**异步**的（要先从宿主环境解析 ws，见 ../resolve.js），任何一种失败都降级 ——
    // 客户端会自动退回 120ms 轮询，所以失败只记 warning、不影响其余七条路由。
    //
    // ⚠ 回调可能在**插件已经卸载之后**才回来（宿主立刻关闭、或解析很慢）：那时再往
    //   路由表里挂一条 upgrade 就是纯泄漏。用 socketTorn 兜住 —— 回来时若已卸载，就地拆掉。
    let socketTorn = false
    let disposeSocket = null
    const registerRoutes = disposeAll
    registerStateSocket(webServer, ble, logger)
      .then((sock) => {
        if (!sock) return
        if (socketTorn) { sock.dispose(); return }
        disposeSocket = sock.dispose
      })
      .catch((e) => warn(`[micro] 状态推送注册异常（客户端退回 HTTP 轮询）：${(e && e.message) || e}`))
    disposeAll = () => {
      socketTorn = true
      registerRoutes()
      if (disposeSocket) { try { disposeSocket() } catch (e) {} }
    }
  })

  return { dispose: () => { if (disposeAll) { try { disposeAll() } catch (e) {} } } }
}
