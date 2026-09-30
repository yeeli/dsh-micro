// dsh-micro · HTTP 路由路径唯一真源
//
// 宿主侧对外暴露的 7 条 /micro/* 路由，路径只在这里声明一次。其余模块（server/ 下的
// 各 handler、以及需要断言路径的自检）一律 import 这里，绝不各自写死字符串 ——
// 否则「改一条路径要改 N 处」，改漏了就变成「浏览器打新地址、宿主还挂在旧地址上」的
// 静默断连。
//
// ⚠ 客户端（src/client/*）那一侧目前仍是各自写死的字符串（8 处），与这里**不同源**。
// 本轮（2026-09-27）只统一 core 侧；若要根治，得再抽一份无 Node 依赖的共享常量模块让
// client 也 import，属于独立的一轮，见项目备忘。

export const PATHS = Object.freeze({
  /**
   * 状态快照 / 状态推送（**同一路径承载两种协议**）。
   *   · `GET`      → JSON 快照（设置页与 curl 诊断仍在用，见 device.js）；
   *   · `Upgrade`  → WebSocket 推送（浏览器的常态通道，见 state-socket.js）。
   * 两种协议在 DSH webserver 里是**两张互相独立的表**（exact / upgrades），
   * 所以同一个 pathname 不会「撞车」——客户端连不上 WS 时自动退回 HTTP 轮询。
   */
  state: '/micro/state',
  /** 配置写回（POST）：亮度 / 自动调暗。 */
  config: '/micro/config',
  /** 手动重连（任意）：关句柄再 open。 */
  reconnect: '/micro/reconnect',
  /** 灯态上报（POST）：Agent 键 LED 配置 + 当前会话 + 结果态。 */
  agents: '/micro/agents',
  /** 归档当前会话（POST）：宿主 workspaceRegistry.archiveSession。 */
  archive: '/micro/archive',
  /** 输入监控授权状态（GET/POST，仅 macOS）：读系统权限。 */
  monitor: '/micro/monitor',
  /** 打开系统设置的隐私面板（POST）：浏览器不能 spawn，宿主代劳。 */
  openPrivacy: '/micro/open-privacy'
})
