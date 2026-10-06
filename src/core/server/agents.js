// dsh-micro · server/agents.js
//
// POST /micro/agents —— 浏览器把「Agent 键 LED 配置 + 当前会话 + 结果态」上报给宿主。
// 这是 8 条路由里最重的一条：它的业务体（期望灯态解析、结果态搬家、当前会话判据）都还在
// ble.js 的 applyAgents() 里，这里只做「读 body → 调 applyAgents → 回 state」的薄壳。
//
// 与业务的分界：server/ 只管「怎么从 HTTP 进来、怎么回 JSON」；「这条报文该把灯改成什么样」
// 属于设备/宿主逻辑，留在 ble.js。这样 ble.js 一行 HTTP 代码都不必认识。

import { PATHS } from './paths.js'
import { postJson } from './http.js'

/**
 * 注册灯态路由。
 * @param {object} webServer - 宿主注入的 webServer（有 register()）。
 * @param {object} ble - BLE 读取器门面（有 applyAgents / snapshot）。
 * @param {{ warn: (msg: string) => void }} [log] - 日志出口。
 * @returns {() => void} disposer。
 */
export const registerAgentsRoute = (webServer, ble, log = null) => {
  const disposer = webServer.register({
    kind: 'exact',
    path: PATHS.agents,
    handler: postJson((payload) => {
      ble.applyAgents(payload)
      return ble.snapshot()
    })
  })
  // 与改动前一致：注册失败不该连累按键功能，只告警。
  return () => { try { disposer && disposer() } catch (e) { log && log.warn && log.warn(`[micro] 灯态路由注销失败: ${e && e.message}`) } }
}
