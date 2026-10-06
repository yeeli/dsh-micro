// dsh-micro · server/device.js
//
// 与「设备」直接相关的四条路由：
//   GET  /micro/state     —— 状态快照（设备状态 + 灯态 + 诊断面）。
//   POST /micro/config    —— 配置写回（亮度 / 自动调暗）。
//   POST /micro/status    —— **向设备要一次状态**（电量 / 是否在充电）。注意与 state 的区别：
//                            那条读宿主手上的快照，这条真的写一条 RPC 出去（见下面 handler）。
//   ANY  /micro/reconnect —— 手动重连（关句柄再 open）。
//
// 业务体（#state / applyConfig / requestStatus / 重连）都在 ble.js，这里只做 HTTP 壳。

import { PATHS } from './paths.js'
import { json, postJson } from './http.js'

/**
 * 注册 state / config / status / reconnect 四条路由。
 * @param {object} webServer
 * @param {object} ble - 门面（snapshot / applyConfig / requestStatus / reconnect）。
 * @param {{ warn: (msg: string) => void }} [log]
 * @returns {() => void} disposer（一次注销四条）。
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
      // 客户端打开键盘设置页时打进来（用户 2026-10-06 要求）：设备不会自己定时推读数，
      // 不问的话屏幕上那份可能是几分钟前的。充电中客户端每 10 分钟还会再打一次。
      //
      // 返回里那个 `requested` 的含义**只有**「这条 RPC 有没有写出去」—— 设备是**异步**应答的，
      // 此刻 state 里多半还是旧读数（新读数要靠随后的状态推送/轮询进来）。别把它当「已刷新」。
      path: PATHS.status,
      handler: (_req, res) => json(res, 200, {
        requested: ble.requestStatus() === true,
        state: ble.state
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
