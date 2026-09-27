// dsh-omkb · HTTP 路由路径唯一真源
//
// 宿主侧对外暴露的 7 条 /omkb/* 路由，路径只在这里声明一次。其余模块（server/ 下的
// 各 handler、以及需要断言路径的自检）一律 import 这里，绝不各自写死字符串 ——
// 否则「改一条路径要改 N 处」，改漏了就变成「浏览器打新地址、宿主还挂在旧地址上」的
// 静默断连。
//
// ⚠ 客户端（src/client/*）那一侧目前仍是各自写死的字符串（8 处），与这里**不同源**。
// 本轮（2026-09-27）只统一 core 侧；若要根治，得再抽一份无 Node 依赖的共享常量模块让
// client 也 import，属于独立的一轮，见项目备忘。

export const PATHS = Object.freeze({
  /** 状态快照（GET）：设备状态 + 灯态 + 诊断面。 */
  state: '/omkb/state',
  /** 配置写回（POST）：亮度 / 自动调暗。 */
  config: '/omkb/config',
  /** 手动重连（任意）：关句柄再 open。 */
  reconnect: '/omkb/reconnect',
  /** 灯态上报（POST）：Agent 键 LED 配置 + 当前会话 + 结果态。 */
  agents: '/omkb/agents',
  /** 归档当前会话（POST）：宿主 workspaceRegistry.archiveSession。 */
  archive: '/omkb/archive',
  /** 输入监控授权状态（GET/POST，仅 macOS）：读系统权限。 */
  monitor: '/omkb/monitor',
  /** 打开系统设置的隐私面板（POST）：浏览器不能 spawn，宿主代劳。 */
  openPrivacy: '/omkb/open-privacy'
})
