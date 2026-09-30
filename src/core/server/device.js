// dsh-micro · server/device.js
//
// 与「设备」直接相关的三条只读/写回路由：
//   GET  /micro/state     —— 状态快照（设备状态 + 灯态 + 诊断面）。
//   POST /micro/config    —— 配置写回（亮度 / 自动调暗）。
//   ANY  /micro/reconnect —— 手动重连（关句柄再 open）。
//
// 业务体（#state / applyConfig / 重连）都在 ble.js，这里只做 HTTP 壳。

import { PATHS } from './paths.js'
import { json, postJson } from './http.js'

/**
 * 注册 state / config / reconnect 三条路由。
 * @param {object} webServer
 * @param {object} ble - 门面（snapshot / applyConfig / reconnect）。
 * @param {{ warn: (msg: string) => void }} [log]
 * @returns {() => void} disposer（一次注销三条）。
 */
export const registerDeviceRoutes = (webServer, ble, log = null) => {
  const disposers = [
    webServer.register({
      kind: 'exact',
      path: PATHS.state,
      handler: (_req, res) => json(res, 200, ble.snapshot())
    }),
    webServer.register({
      kind: 'exact',
      path: PATHS.config,
      handler: postJson((patch) => {
        ble.applyConfig(patch)
        return ble.state
      })
    }),
    webServer.register({
      kind: 'exact',
      path: PATHS.reconnect,
      handler: (_req, res) => {
        ble.reconnect()
        json(res, 200, ble.state)
      }
    })
  ]
  return () => {
    for (const d of disposers) {
      try { d && d() } catch (e) { log && log.warn && log.warn(`[micro] 设备路由注销失败: ${e && e.message}`) }
    }
  }
}
