// dsh-micro · client/src/utils/session-list.js
// **sessions.list 快照上的纯判据**：哪一条是眼前这条会话、侧边栏看得见哪几条。
//
// 为什么单拎一个文件（2026-09-26）：这两条判断要给**三个**地方用 ——
//   * 键盘灯与设置页的会话下拉：core.js 的 visibleSessions（"亮几个灯 = 侧边栏看得见几个"）
//   * DSH 操作门面：actions/session.js 的 currentSessionIdOf → ARCH / FORK / APPR / REJ /
//     切换规划模式 / 发送 / 撤销…（这些动作都要先回答「现在动的是哪条会话」）
// 而 core.js 顶层 `import React from 'react'`（peerDependency，运行时由宿主提供，本地没有）。
// 门面那一侧的全部价值就是「自检塞一个假的 sessions 快照进来就能断言，不必起浏览器」——
// 被 UI 运行时拖进去就做不到了（真踩过：actions/session.js 一 import core.js，
// verify:knob 等几套自检当场 ERR_MODULE_NOT_FOUND: react）。
//
// 所以判据住在这个**叶子**文件里（谁都能 import，谁都不必为它装桩），core.js 再把它整份
// 转发出去（`export * from`），于是「从 core.js 拿」的老写法（agents.js / settings/panel.jsx）
// 一个字都不用改，而两处的答案永远是**同一个函数**、不会漂。
//
// ⚠ 与 config/default.js 同一条纪律：**不许 import 任何东西**。纯参数进、结果出，
//   node 里直接 import 就能逐条断言（含各种残缺/变形的快照）。
//
// 另：这里只「读快照算结论」，不碰任何服务、不产生副作用 —— 拿不到就给 null/空数组，
// 让调用方各自决定降级方式（本项目的一贯姿态：不知道就说不知道）。

// ---------- ① 哪一条是眼前这条会话 ----------
//
// 这个判断以前写在 actions/session.js 的 currentSessionIdOf 里，读的是快照的 `current` 字段：
//
//     const s = sessions.list.getSnapshot()
//     if (s && s.current) return s.current
//
// **0.1.7-rc.2 的快照里根本没有 `current`** —— SessionController 初始化 store 为
// `{ ids: [], byId: {}, phase: "pending", projectionsBySession: {} }`，projectList() 只往里写
// `ids` 与 `byId`。于是这个函数恒返回 null，所有「先要一个会话 id」的功能（归档 ARCH、分叉 FORK、
// 批准 APPR、拒绝 REJ、切换规划模式、发送、撤销/重做…）统统在第一行就静默返回 false ——
// 用户看到的是「按了没反应」，日志里只有一句「当前没有会话，无法归档」。
//
// DSH 自己怎么认「当前会话」（从应用产物里读到的写法）：
//   `Object.values(ctx.sessions.list.getSnapshot().byId)
//      .find((row) => (row.retainedBy.mainView ?? 0) > 0)?.id`
// 也就是**谁被主视图持有（retainedBy.mainView > 0），谁就是眼前这条**。`retainedBy` 就在快照行的
// 首层（dsh-client-ui-workspace 里另有 `state.byId[current]?.title` 这种用法）。
//
// 所以这里按 DSH 的判据认；`current` 仍然先认（老形态快照、以及自检/旧版宿主），认不到再走持有标记。
export const currentSessionIdIn = (snapshot) => {
  if (!snapshot) return null
  if (snapshot.current) return snapshot.current
  const byId = snapshot.byId || {}
  const ids = Array.isArray(snapshot.ids) && snapshot.ids.length ? snapshot.ids : Object.keys(byId)
  for (const id of ids) {
    const row = byId[id]
    if (!row) continue
    const retained = row.retainedBy || null
    if (retained && ((retained.mainView ?? 0) > 0)) return row.id || id
  }
  return null
}

// ---------- ② 侧边栏看得见哪几条 ----------
//
// 侧边栏（dsh-client-ui-workspace 的 sessionVisible）只显示同时满足三条的会话：
//   1. 不是子代理子会话      —— origin !== 'subagent'
//   2. 没有被归档            —— 不在 workspaces 快照的 archivedSessionIds 里
//   3. 不是「空白新会话」    —— 除非它就是当前会话（那条是新会话占位行）
//
// 键盘灯和设置页的会话下拉都必须用这同一套判据：**亮几个灯 = 侧边栏看得见几个**。
// 少判一条就会多亮灯——曾经只判了「非子代理 + 标题非空」，于是 2 个可见会话点亮了
// 5 个键（3 个已归档/空白会话混了进来）。
//
// 两个必须知道的坑：
//   - 归档集合**不在**会话摘要里，只存在于 workspaces 服务的快照上；
//   - 会话摘要的 displayTitle **永不为空**——DSH 会依次退化成 cwd 目录名、会话 id
//     （见 dsh-client-runtime 的 displayTitleOf）。所以「靠标题判空会话」是死代码，
//     空会话唯一的判据是 blank 标志。
export const archivedIdsOf = (workspaces) => {
  try {
    const snap = workspaces && workspaces.list ? workspaces.list.getSnapshot() : null
    return new Set((snap && snap.archivedSessionIds) || [])
  } catch (e) { return new Set() }
}

export const sessionVisible = (s, current, archived) =>
  !!s && s.origin !== 'subagent' && !archived.has(s.id) && (!s.blank || s.id === current)

/** 从 sessions.list 快照取「侧边栏可见」的会话，保持快照顺序。 */
export const visibleSessions = (snapshot, archived) => {
  if (!snapshot) return []
  const byId = snapshot.byId || {}
  const ids = Array.isArray(snapshot.ids) ? snapshot.ids : Object.keys(byId)
  const current = currentSessionIdIn(snapshot)
  return ids.map((id) => byId[id]).filter((s) => sessionVisible(s, current, archived))
}
