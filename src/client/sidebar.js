// dsh-omkb · src/client/sidebar.js
// 设置页左侧导航里「OMKB 键盘」那一项的图标 —— 换成我们的键盘图标。
//
// ── 为什么只能改 DOM，不能「注册」一个图标 ──────────────────────────────
// DSH 的设置侧边栏（`dsh-tauri-ui/dist/client.cjs`）把图标**按 section id 硬编码查表**：
//
//     const ICONS = { models, 'agent-presets': …, plugins: … }
//     function NavIcon({ id }) { return <Icon as={ICONS[id] ?? IconSettingsOutline16} size={16}/> }
//
// 而插件注册 `settings.section` 时能给的字段只有 name/id/order/label/locale/inject/children
// —— **没有 icon**（官方那几个包也都只给 label）。所以只要我们的 id 不是 models/agent-presets/plugins，
// 就永远显示 fallback 的齿轮图标。想让它是键盘，唯一的路是改 DOM。
//
// ── 打法（真机验过，React 不会顶掉）────────────────────────────────────
// 不删、不改 DSH 自己那个 `<svg>`（React 的 fiber 指着它，动它有卸载期 removeChild 报错的风险），
// 只给它 `display:none`，紧跟着插入我们的 svg。重渲染（搜索过滤、切分区、切回来）都只更新
// 原有节点的 props，不会碰我们插入的兄弟节点。真机 4 种重渲染场景下补丁全部存活、零报错。
//
// 弹窗关闭会整棵卸载（我们的补丁跟着没）→ 用 MutationObserver 守着，重开立刻补上。
// 失败姿态：找不到行/找不到图标就静默返回，**绝不抛**（这段挂在 DSH 的设置面板上）。
// 唯一的例外是「藏行」那条路：那里找不到行会 `console.warn` 一次（用户可见的承诺，不许静默失败），
// 详见下面 「移除键盘」那一节的四条纪律。

import { DSVI, keypadIconHTML } from './core.js'
import { candidateLabels, findSectionRow } from './components/sidebar/action.jsx'

/** 我们插进去的 svg 上的标记（DOM 里就靠它认自己）。 */
export const NAV_MARK = 'data-omkb-navicon'
/** DSH 渲染导航图标的 svg：类名带哈希前缀，只认后缀，认不出就退化为「行内第一个 svg」。 */
export const NAV_ICON_SEL = 'svg.dshp-settings-nav-icon'
/**
 * 设置侧边栏（data 属性比哈希类名稳；只用来做一次廉价短路）。
 * ⚠️ 只给**补图标**那条路用：藏行那条路刻意不短路（短路判据一旦在真机上失效，就会静默变成
 * 「点了移除、菜单里那一项还在」，见下面「移除键盘」一节的纪律①）。
 */
export const NAV_SIDE_SEL = '[data-slot-sidebar="dsh-tauri-ui"]'
/** 导航图标的渲染边长：DSH 的 `settings-nav-icon` 就是 16（我们插的必须一样，否则行高会跳）。 */
export const NAV_ICON_SIZE = 16

const svgOf = (row) => {
  try { return row.querySelector('svg[' + NAV_MARK + ']') } catch (e) { return null }
}

// ---------- 「移除键盘」之后把这一行整行藏起来（2026-09-23）----------
// 为什么还是改 DOM：分区一旦注册就收不回来（`ctx.slots.register` 返回的 dispose 能不能让
// DSH 的设置导航跟着消失，从插件侧没法确认），而**这一行本来就是我们已经在补图标的那一行**，
// 多一个 display 开关是最小改动。
//
// 但这套「改 DOM」有四条必须守住的纪律 —— 2026-09-23 晚真机踩的坑：用户点完「移除」，
// 设置菜单里「OMKB 键盘」那一项**还在**（旁边两处都收起来了，只有它没动）。根因是这一路
// 借用了「补图标」的判据，那条路有两处会静默失效：
//   ① **藏行这条路不许走「廉价短路」**（原来借用 `run()` 里的 `NAV_SIDE_SEL` 短路）。短路是给
//      「补图标」省开销的（弹窗关着占绝大多数时间）；一旦那个判据在真机上失效，藏行就静默变成
//      「什么都不做」。藏行是**用户可见的承诺**，宁可多查一次 DOM。
//   ② **不许靠文案找行**。补过图标之后，那一行里有我们自己的 `svg[data-omkb-navicon]`，
//      「它的最近行祖先」就是要藏的行 —— 比文字匹配硬（不随语言 / 徽标 / 缩写漂移）。
//      只有图标还没补上时才退回文案匹配。
//   ③ **React 顶掉 style / 整行换新节点都要兜住**：藏行后先来两拍重试，再挂一个 1.5s 的守护
//      定时器（只在「已移除」这个稀有状态里活着），保证最终一定藏住 —— 否则一次重渲染就能把它放出来。
//   ④ **找不到行必须出声**（只一次）：这类失效以前是完全静默的，只能靠用户截图才发现。
// 这几条状态是模块级的：它们描述的正是这一行在页面上的样子，与某次 install 无关。
let rowHidden = false
/** 被我们藏起来的那一行（要还回去时得知道是谁；节点被 DSH 卸载后重建时会被换掉）。 */
let hiddenRow = null
/** 当前装着的补丁的重跑函数（藏在 nav-icon 里，setNavRowHidden 借它立刻生效）。 */
let reapply = null
/** 藏行后的两拍重试（纪律③）。 */
let retries = []
/** 藏行期间的守护定时器（纪律③）。 */
let guard = null
/** 「弹窗开着却找不到那一行」只提醒一次（守护每 1.5s 跑一次，不挡的话会刷屏）。 */
let warnedMissing = false

/** 藏行后重试的时刻（毫秒，从 setNavRowHidden(true) 那刻算起）。 */
export const HIDE_RETRY_MS = [150, 600]
/** 藏行期间的守护周期：React 把 style 顶掉 / 整行换新节点后，最多这么久之内一定重新藏好。 */
export const HIDE_GUARD_MS = 1500
/** 导航行的标签选择器（我们那一行 = 设置弹窗导航里的一个按钮 / 链接）。 */
export const ROW_SEL = 'button, [role="button"], a'

const warn = (msg) => { try { console.warn('[omkb] ' + msg) } catch (e) {} }

const restoreRow = () => {
  if (!hiddenRow) return
  try { hiddenRow.style.display = '' } catch (e) {}
  hiddenRow = null
}

/** 设置侧边栏宿主在不在页面上（廉价短路用的判据，只给「补图标」那条路用）。 */
const sideHostPresent = () => {
  try { return !!document.querySelector(NAV_SIDE_SEL) } catch (e) { return false }
}

/**
 * 设置弹窗开着没有（= 页面上有一个带 `<nav>` 的弹窗）。
 * 只用来决定「找不到行要不要出声」—— 弹窗关着时找不到行是正常的，不该告警。
 */
const settingsNavPresent = () => {
  try {
    for (const d of document.querySelectorAll('[role="dialog"]') || []) {
      try { if (d.querySelector('nav')) return true } catch (e) {}
    }
  } catch (e) {}
  return false
}

/**
 * 我们那一行：先认**自己插进去的键盘图标落在哪一行**（纪律②），认不出再退回文案匹配。
 * 两条都试不出来 → null（调用方据此静默返回，别抛 —— 这段挂在 DSH 的设置面板上）。
 */
const findOurRow = (labels) => {
  try {
    const mine = document.querySelector('svg[' + NAV_MARK + ']')
    for (let node = mine; node; node = node.parentElement) {
      try { if (typeof node.matches === 'function' && node.matches(ROW_SEL)) return node } catch (e) {}
    }
  } catch (e) {}
  try { return findSectionRow(labels, [document]) } catch (e) { return null }
}

/** 清掉重试与守护（换状态 / 卸载时都要清，否则会留下一堆自己动自己的定时器）。 */
const clearPending = () => {
  while (retries.length) { const t = retries.pop(); try { clearTimeout(t) } catch (e) {} }
  if (guard) { try { clearInterval(guard) } catch (e) {} guard = null }
}

/** 强制重跑一次补丁（force = 不走短路，见纪律①）。 */
const applyHidden = () => { try { if (reapply) reapply(true) } catch (e) {} }

/** 藏行后的兜底：两拍重试 + 守护定时器（纪律③）。 */
const armHideGuard = () => {
  for (const ms of HIDE_RETRY_MS) {
    try { retries.push(setTimeout(() => { if (rowHidden) applyHidden() }, ms)) } catch (e) {}
  }
  try {
    guard = setInterval(() => { if (rowHidden) applyHidden() }, HIDE_GUARD_MS)
    // Node（跑自检时）里别让这个定时器变成「进程退不掉」的理由；浏览器里它是数字、没有 unref。
    if (guard && typeof guard.unref === 'function') guard.unref()
  } catch (e) { guard = null }
}

/**
 * 藏起 / 放出设置页导航里我们那一行（「移除键盘」用；判据在 client/device.js）。
 * 幂等；找不到行时什么都不做（重试与守护定时器会接着试）。
 * @param on - true = 整行隐藏；false = 恢复显示。
 * @returns {boolean} 当前的隐藏状态。
 */
export const setNavRowHidden = (on) => {
  const next = !!on
  const changed = next !== rowHidden
  rowHidden = next
  clearPending()
  if (!next) {
    restoreRow()
    warnedMissing = false
    return rowHidden
  }
  // 立刻试一次：不能等 MutationObserver —— 隐藏这条路径上 DOM 可能一帧都不变。
  applyHidden()
  if (changed) armHideGuard()
  return rowHidden
}

/** 当前是否把那一行藏起来了（自检/探针观测用）。 */
export const navRowHidden = () => rowHidden

/** 藏行的现状：排查「点了移除、菜单里那一项还在」时，控制台一条就够。 */
export const navRowStatus = () => ({
  hidden: rowHidden,
  row: !!hiddenRow,
  applied: !!(hiddenRow && hiddenRow.style && hiddenRow.style.display === 'none'),
  guard: !!guard,
  retries: retries.length,
  warned: warnedMissing
})

/**
 * 打一次补丁：把本插件导航行的 DSH 默认图标藏起来，换成键盘图标。
 * 幂等：已经打过就返回 false 且不动 DOM。
 * @param labels - 候选分区标题（candidateLabels 的产物）。
 * @param size - 图标渲染边长（DSH 导航项按 16 设计）。
 * @returns {boolean} 这次是否真的插入了图标。
 */
export const patchNavIcon = (labels, size = 16) => {
  if (typeof document === 'undefined') return false
  const row = findOurRow(labels)
  if (!row) {
    // 藏行时找不到那一行 = 用户会看到「点了移除、菜单里那一项还在」。**必须出声**（只一次），
    // 这类失效以前是静默的 —— 只能等用户截图才发现（纪律④）。
    if (rowHidden && !warnedMissing && settingsNavPresent()) {
      warnedMissing = true
      warn('设置弹窗开着，却找不到导航里本分区那一行 —— 「移除」之后那一项会留在菜单里。'
        + '多半是 DSH 又换了导航行的写法，或我们插的图标没打上（见 sidebar.js 头部）。')
    }
    return false
  }
  if (rowHidden) {
    // 整行藏起来：这时补图标没有意义（也绝不该往一个隐藏行里插节点）。
    // 换行元素时（DSH 卸载弹窗后重建）先把旧节点还回去，避免留着一个被藏过的孤儿。
    if (hiddenRow && hiddenRow !== row) restoreRow()
    hiddenRow = row
    try { row.style.display = 'none' } catch (e) {}
    return false
  }
  restoreRow() // 解除隐藏：把 display 还回去（幂等）
  if (svgOf(row)) return false // 已经打过了
  try {
    const original = row.querySelector(NAV_ICON_SEL) || row.querySelector('svg')
    if (original) original.style.display = 'none'
    const html = keypadIconHTML(size, `class="dshp-settings-nav-icon" ${NAV_MARK}="1" aria-hidden="true"`)
    if (original) original.insertAdjacentHTML('afterend', html)
    else row.insertAdjacentHTML('afterbegin', html)
    return true
  } catch (e) { return false }
}

/**
 * 装上补丁：守 DOM 变化，弹窗每次重开都把图标补回去。
 * @param opts.labels - 候选标题；默认取词典里所有语言的 `nav` 文案。
 * @param opts.size - 图标边长，默认 16。
 * @returns 卸载函数（断开观察者）。
 */
export const installNavIconPatch = (opts = {}) => {
  if (typeof document === 'undefined') return () => {}
  const size = Number.isFinite(opts.size) ? opts.size : 16
  const labels = Array.isArray(opts.labels) && opts.labels.length ? opts.labels : candidateLabels()
  let alive = true
  let scheduled = false

  const run = (force) => {
    scheduled = false
    if (!alive) return
    // 廉价短路：设置侧边栏不在页面上时直接跳过（弹窗关着 = 绝大多数时间）。
    // **唯独「藏行」时不许短路**（纪律①）：那条路静默失效的代价是「用户点了移除、菜单里还在」。
    if (!force && !rowHidden) {
      if (!sideHostPresent()) return
    }
    patchNavIcon(labels, size)
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    // 注意用箭头包一层：`setTimeout(run, 0)` 在某些实现里会给回调塞参数，
    // 而 run 的第一个参数是 force —— 会把「短路」误当成「强制」。
    setTimeout(() => run(), 0) // 合并同一帧里的多次变更
  }

  let observer = null
  try {
    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
  } catch (e) { observer = null }

  run() // 弹窗可能已经开着（HMR / 后挂载）
  reapply = run
  DSVI.navIcon = {
    labels, size,
    patch: () => patchNavIcon(labels, size),
    findRow: () => findOurRow(labels),
    hidden: navRowHidden,
    setHidden: setNavRowHidden,
    status: navRowStatus
  }
  return () => {
    alive = false
    if (reapply === run) reapply = null
    // 卸载时把藏起来的行还回去、并清掉守护：插件被禁用/热重载后，界面不该留下一行隐形的导航项，
    // 更不该留下一个还在自己动自己的定时器。
    clearPending()
    rowHidden = false
    restoreRow()
    try { if (observer) observer.disconnect() } catch (e) {}
  }
}

// 调试 / 自检句柄：产物加载后就能从 DSVI 上拿到这几个（自检不必先跑一遍 apply）。
DSVI.patchNavIcon = patchNavIcon
DSVI.installNavIconPatch = installNavIconPatch
DSVI.setNavRowHidden = setNavRowHidden
DSVI.navRowHidden = navRowHidden
DSVI.navRowStatus = navRowStatus
