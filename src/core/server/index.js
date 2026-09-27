// dsh-omkb · server/index.js
//
// 「宿主与 webserver 通信」的唯一入口。所有 /omkb/* 路由（7 条）都在这里汇总注册，
// 由 server/ 下按功能域拆分的三个模块各自认领：
//   device.js  —— state / config / reconnect（与设备直接相关）
//   agents.js  —— agents（灯态，最重的一条）
//   system.js  —— monitor / open-privacy / archive（系统与宿主能力）
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

/**
 * 汇总注册全部 7 条 /omkb/* 路由。
 *
 * @param {object} ctx - 宿主插件上下文（有 inject / get）。
 * @param {object} deps
 * @param {object} deps.ble - BLE 读取器门面（snapshot / state / applyAgents / applyConfig / reconnect）。
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
      warn('[omkb] 宿主未提供 webServer 服务，HTTP 路由不可用')
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
      warn('[omkb] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用')
    }

    const disposers = [
      registerDeviceRoutes(webServer, ble, logger),
      registerAgentsRoute(webServer, ble, logger),
      registerSystemRoutes(webServer, { monitor, openPrivacy, workspaceRegistry: ws }, logger)
    ]
    disposeAll = () => { for (const d of disposers) d() }
  })

  return { dispose: () => { if (disposeAll) { try { disposeAll() } catch (e) {} } } }
}
