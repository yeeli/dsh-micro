// dsh-omkb · client/components/sidebar-action.jsx
// 侧边栏最下层：**「设置」按钮同一行的右端**放一个方形键盘按钮，点一下直接打开键盘设置页。
//
// ── 位置是怎么来的（先说清楚，免得以后以为是随手摆的 DOM）───────────────────────
// DSH 的侧边栏底部（`sidebar.footer.action` 槽位所在的 foot 区）是**两行竖排**：
//     footArea（纵向 flex）
//       ├── footerActions  ← 本插件注册的 sidebar.footer.action 槽位落在这一行（横向 flex）
//       └── settingsArea   ← 「设置」按钮那一行（DSH 自己的 sidebar.settings 槽位）
// 横向 flex 里塞一个占满宽度的行，两行就会各占一行——所以「和设置按钮并列」只能靠**覆盖定位**：
// 把按钮 position:absolute 贴到设置行的右端（那一行文字靠左，右侧是空的），同时它脱离文档流，
// footerActions 高度归零，底栏就只剩「设置」那一行，不再为这个入口多占一行。
//
// ── 为什么要**收窄设置按钮**：hover 背景会盖过来 ────────────────────────────
// 「设置」按钮是**整行宽**的（实机量：border-box 260px、圆角 12px、图标与文字靠左，右侧一大片
// 仍是它的地盘），hover 时那块灰色背景画的就是这个盒子。于是贴到右端的键盘方块整个落在它盒子里，
// 灰块一路盖到图标下面——看起来两个图标粘成一块（用户就是这么反馈的）。
// 光给方块自己加不透明底 / 加遮罩都治不了：那块灰背景仍然铺过去贴着方块。
// 唯一办法是让设置按钮的盒子在方块左侧收住：摆放时把它的**宽度**收到「方块左端 - gap」，
// margin / padding / 圆角 / 字体一概不碰。
// 每轮摆放都先恢复原宽、量天然几何、再收窄（幂等：不会一轮瘦一圈，也不会让方块逐轮右移）。
// 窄到会把「设置」两个字挤变形（< MIN_GEAR_WIDTH）时干脆不收窄，宁可重叠也不压坏界面。
//
// ⚠ 收窄**不能只写 `width`**（DSH 0.1.5-rc.3 起踩过，实机实测）：
// 新版那个按钮在 `[data-slot="sidebar.settings"]` 里的父行是 `display:flex; gap:8px`，按钮自己
// 带 `flex: 1 1 0%` —— **flex-basis 为 0 + flex-grow 1**，于是它的宽度由「剩余空间」算出来，
// inline `width` 根本不参与计算（实测写了 206px，computed width 仍是 260px 满行）。
// 结果就是：源码里收窄「成功」了、自检也绿，可实机灰底一点没变，用户看到的还是盖住图标。
// 能压住它的是 **`max-width`**（clamp 在 grow 之后生效）。所以这里**两个一起写**：
// width 管「非 flex / 旧版」布局，max-width 管「flex-grow 满行」布局，两种 DSH 版本都收得住。
// 反例：把 flex-grow 归零也不行 —— flex-basis 还是 0，按钮会缩成内容宽（实测 18px，「设置」被压扁）。
//
// 定位数值现场量（getBoundingClientRect）：DSH 的类名是模块哈希（hHd-Xa_footerActions 这类），
// 不能认；行高还会随「展开 / 收起成 56px 导轨」变化，量着放才稳。量不到就**退回文档流**
// （仍可用，只是多占一行），绝不把按钮藏起来。收起成导轨时干脆不覆盖：留在流里就是个
// 36×36 的居中方块，正好落在齿轮正上方（和 DSH 自己的导轨按钮同规格）。
//
// ── 与后台断开时那一行会多出一个邻居（2026-09-25，改了两轮）─────────────────
// DSH 的 triggerRow 里除了「设置」按钮，还并排放着一个连接状态指示器（ConnectionIndicator）：
// 正常时它渲染成 null（不占位）；web 与后台断开时它是那条橙色的「自动重连中」，
// 刚恢复的那几秒是绿色的「连接成功」。那一行是 `flex-start` 布局、设置按钮是 `flex:1`
// （吃满剩余宽度），指示器紧贴按钮右边 —— 也就是**正好落在我们贴右端的地方**。
//
// 第一轮（错）：认出邻居就「退回文档流」。结果底栏多出一行、键盘图标孤零零浮在「设置」上方
// （用户 03:22 截图：「这个错误更加严重了」）。问题不在坐标 —— 是「那一行里多了个邻居」这件事
// 本身就让那一行归 DSH 安排了，我们不该往里挤，也不该为它改自己的位置。
//
// 第二轮（现行）：**把 DSH 的指示器藏起来，改用贴在自己方块上方的深色气泡**展示同一句话
// （样式见 assets/settings.css 的 .omkb-conn-tip，行为见 syncConnTip）。于是那一行恢复成
// 「只有一个设置按钮」，覆盖定位照常；提示一点没丢 —— **点气泡 = 点那颗被藏起来的指示器**
// （断开时它是「立即重连」，重连中时它是「重启」），行为与 DSH 原样一致。
// 气泡里那三句话直接抄 DSH 自己的词典（connection.connecting / .error / .connected），
// 用户不会觉得界面上冒出第二套说法。
//
// 认得出它的判据（都不依赖哈希 class）：断开/重连中 = `button[data-phase]`（data-phase 就是
// 状态字符串），刚恢复 = `[role="status"]`。**认不出的邻居仍旧退回文档流**：宁可多一行也绝不重叠。
// 另外用 MutationObserver 守那一行（邻居出现/消失只改行内节点，foot 尺寸不变，ResizeObserver 看不见）。
//
// ── 「直接打开键盘设置页」怎么实现 ──────────────────────────────────────────
// 设置弹窗把「是否展开 + 当前分区」放在组件内部 state 里，**没有** openSettings(sectionId)
// 之类的接口，所以只能：点设置触发按钮把弹窗打开 → 点掉导航里文字等于本插件分区标题
// （t('nav')）的那一行。两个前提都在真实应用里验过：
//   * 触发按钮在 `[data-slot="sidebar.settings"]` 里、是 `button[aria-haspopup="dialog"]`，
//     并且带 aria-expanded——弹窗已经开着时**不能**再点（点一下就关掉了）；
//   * 弹窗**不在设置槽位出口里面**（挂在 shell.overlay，全屏 fixed），导航是 `nav`：
//     所以查导航行要按「在 `nav` 或 `[role="dialog"]` 里的按钮」查，不能只认 role=dialog
//     （有的版本弹窗根没有 role）。
// 一律只认 data-slot / aria / 结构关系，不猜哈希 class。
//
// 失败姿态：找不到按钮/行就 console.warn 并返回 false，绝不抛错（这段挂在侧边栏渲染上）。
//
// ── 「键盘已断开」的红点（2026-09-24）────────────────────────────────────────
// 设备断开时这个入口以前完全没反应（连上和断开长得一模一样），而「重新连接」藏在设置页里，
// 用户得先猜到要进去看。现在断开时图标右上角挂一个小红点，悬停/可访问名换成
// 「键盘已断开 · 点击打开设置重新连接」。
//
// 三条纪律：
//   * 判据只有一处（`utils/device.js` 的 `isDeviceOffline`），且必须带 `known` ——
//     「还没听到宿主说话」不等于「断开」，否则每次刷新都会先闪一下红点。
//   * **点击行为不变**（仍是打开键盘设置页）：红点只是告知，重连仍由设置页那个按钮发起
//     （用户 2026-09-24 选的口径）。所以红点是 `pointer-events:none` 的纯装饰，
//     不会把入口的点击语义劈成两个。
//   * 红点画在按钮**内部**：按钮是 `overflow:hidden`，画到框外会被裁掉；而按钮 36px、
//     图标 20px 居中，所以「按钮内圈右上」看起来正落在图标右上角。

import { useEffect, useRef, useState } from 'react'
import { DSVI, KeypadIcon } from '../core.js'
import { isDeviceOffline } from '../utils/device.js'
import { OmkbGuideHost } from './guide-modal.jsx'

/** 槽位名（与 core.js 的 SLOT_FOOT_ACTION 同值，导出便于自检引用）。 */
export const FOOT_ACTION_SLOT = DSVI.SLOT_FOOT_ACTION
/** 本插件在这个槽位里的条目 id。 */
export const FOOT_ACTION_ID = 'omkb-keyboard'

/** 设置 UI 所在的槽位出口（renderer 给每个槽位加 data-slot 锚点）。 */
export const SETTINGS_OUTLET_SEL = '[data-slot="sidebar.settings"]'
/** 设置触发按钮：槽位出口里的 aria-haspopup="dialog"。 */
export const SETTINGS_TRIGGER_SEL = 'button[aria-haspopup="dialog"]'
/** 设置弹窗里的导航容器：nav 或 role=dialog（不同版本弹窗根不同，只要求行在其中一个里）。 */
export const NAV_SCOPE_SEL = 'nav, [role="dialog"]'

/** 方形按钮边长：与收起态齿轮（36）同规格。 */
export const BUTTON_SIZE = 36
/** 图标尺寸：比齿轮的 16 大一号。 */
export const ICON_SIZE = 20
/** 贴右边时留白（约等于齿轮行自己的右内边距 10px）。 */
export const GEAR_INSET = 10
/**
 * 键盘方块与「设置」按钮之间留的间隔。
 * 设置按钮是**整行宽**的（实测 border-box 260px，图标靠左、右侧空着），所以键盘方块一旦落进
 * 它盒子里，hover 时那块灰色背景就会盖到图标下面（看起来两个图标粘成一个）。留间隔的唯一
 * 办法是**把设置按钮的盒子收窄**：让 hover 背景在方块左侧就收住。
 */
export const GEAR_GAP = 8
/**
 * 收窄后设置按钮的最小宽度：低于这个值宁可**不收窄**（保持原样重叠），
 * 也不能把「设置」这两个字挤变形（窄侧边栏下）。
 */
export const MIN_GEAR_WIDTH = 96

/**
 * 认「那是 DSH 的连接状态指示器」的稳定标记（**不用**哈希 class）：
 *   断开 / 重连中 = `button[data-phase]`（data-phase 就是状态字符串）
 *   刚恢复的那几秒 = `[role="status"]`（那一个渲染成 div，不可点）
 * 认不出就不认：调用方会退回文档流（绝不重叠）。
 */
export const CONN_NOTICE_SEL = 'button[data-phase],[role="status"]'
/** 打在指示器上的标记属性：CSS 靠它把指示器藏起来（`[data-omkb-conn-hide]{display:none}`）。 */
export const NOTICE_HIDE_ATTR = 'data-omkb-conn-hide'
/** 气泡与键盘方块之间的间隔（px）。 */
export const TIP_GAP = 6
/** 小尾巴的宽度（px，也是它三角形的高）。 */
export const TIP_TAIL = 12

/** 弹窗打开后等导航行出现的预算：React 提交是异步的，但也就一两帧的事。 */
export const NAV_WAIT_MS = 1200
const POLL_MS = 16

const warn = (msg) => { try { console.warn('[omkb] ' + msg) } catch (e) {} }

const winOf = () => (typeof window !== 'undefined' ? window : null)

const q = (root, sel) => {
  if (!root || typeof root.querySelector !== 'function') return null
  try { return root.querySelector(sel) } catch (e) { return null }
}

const qa = (root, sel) => {
  if (!root || typeof root.querySelectorAll !== 'function') return null
  try { return Array.from(root.querySelectorAll(sel)) } catch (e) { return [] }
}

const matches = (el, sel) => {
  if (!el || typeof el.matches !== 'function') return false
  try { return el.matches(sel) } catch (e) { return false }
}

const textOf = (el) => {
  try { return String((el && el.textContent) || '') } catch (e) { return '' }
}

const styleOf = (el) => {
  try {
    const w = winOf()
    if (w && typeof w.getComputedStyle === 'function') return w.getComputedStyle(el)
    if (typeof getComputedStyle === 'function') return getComputedStyle(el)
  } catch (e) {}
  return null
}

/** 设置触发按钮：优先限定在设置槽位出口内，避免点到别处同名的 aria-haspopup="dialog"。 */
export const triggerEl = (root) => {
  const outlet = q(root, SETTINGS_OUTLET_SEL)
  return q(outlet, SETTINGS_TRIGGER_SEL) || q(root, SETTINGS_TRIGGER_SEL)
}

const isExpanded = (trigger) => {
  try { return trigger && trigger.getAttribute('aria-expanded') === 'true' } catch (e) { return false }
}

/**
 * 候选分区标题：调用方给的（设置页里 `label: () => t('nav')` 的同一个 t）+ 词典里所有语言的
 * `nav` 文案。多给几个候选是为了「语言切换 / label 再注册」都不会让它点空。
 */
export const candidateLabels = (extra) => {
  const out = []
  const push = (v) => {
    if (typeof v !== 'string') return
    const s = v.trim()
    if (s && out.indexOf(s) === -1) out.push(s)
  }
  push(extra)
  const dicts = (DSVI && DSVI.locales) || {}
  for (const key of Object.keys(dicts)) push(dicts[key] && dicts[key].nav)
  return out
}

/** 给定根节点下所有导航容器（nav / role=dialog，含根本身）。 */
const navScopes = (root) => {
  if (!root) return []
  const out = []
  if (matches(root, NAV_SCOPE_SEL)) out.push(root)
  for (const el of qa(root, NAV_SCOPE_SEL) || []) out.push(el)
  return out
}

/**
 * 在设置弹窗的导航里找本插件的分区行。
 * 先精确匹配（导航行文字就是 label 本身），再退化为包含匹配（label 被加了后缀也不至于失效）。
 * @param labels - 候选标题数组（candidateLabels 的产物）。
 * @param scopes - 查找容器数组（设置槽位出口、document；弹窗在前者外面时靠后者兜住）。
 * @returns 行元素，或 null。
 */
export const findSectionRow = (labels, scopes) => {
  const wants = (labels || []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  if (!wants.length) return null
  const containers = []
  for (const root of scopes || []) {
    for (const c of navScopes(root)) if (containers.indexOf(c) === -1) containers.push(c)
  }
  if (!containers.length) return null
  const rowsIn = (c) => qa(c, 'button, [role="button"], a') || []
  for (const want of wants) {
    for (const c of containers) {
      const hit = rowsIn(c).find((b) => textOf(b).trim() === want)
      if (hit) return hit
    }
  }
  for (const want of wants) {
    for (const c of containers) {
      const hit = rowsIn(c).find((b) => textOf(b).includes(want))
      if (hit) return hit
    }
  }
  return null
}

const isActiveRow = (row) => {
  try { return row.getAttribute('aria-current') === 'true' } catch (e) { return false }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const clickEl = (el, what) => {
  try { el.click(); return true } catch (e) {
    warn(`点击${what}失败：` + ((e && e.message) || e))
    return false
  }
}

/**
 * 打开设置弹窗并直接落到「OMKB 键盘」分区。
 * @param label - 本插件分区标题（组件里传 t('nav')）；省略时只用词典里的候选。
 * @param opts.waitMs - 等导航行出现的预算（毫秒）；默认 NAV_WAIT_MS，自检用来调短。
 * @returns {Promise<boolean>} 是否成功把分区行点开（找不到就 false，不抛错）。
 */
export const openKeyboardSettings = async (label, opts = {}) => {
  if (typeof document === 'undefined') return false
  const waitMs = opts && Number.isFinite(opts.waitMs) ? opts.waitMs : NAV_WAIT_MS
  const outlet = q(document, SETTINGS_OUTLET_SEL)
  const scopes = [outlet, document].filter(Boolean)
  const labels = candidateLabels(label)

  // 已经能点到行：在本分区就不动，否则点过去（不碰触发按钮，免得把弹窗关掉）。
  const found = findSectionRow(labels, scopes)
  if (found) {
    if (isActiveRow(found)) return true
    return clickEl(found, '分区导航行')
  }

  const trigger = triggerEl(document)
  if (!trigger) {
    warn('找不到侧边栏设置按钮（[data-slot="sidebar.settings"] button[aria-haspopup="dialog"]），无法打开键盘设置页')
    return false
  }
  // 弹窗已开着（只是导航还没渲染 / 行还没出现）时再点一次会把它关掉。
  if (!isExpanded(trigger) && !clickEl(trigger, '设置按钮')) return false

  const deadline = Date.now() + waitMs
  for (;;) {
    const row = findSectionRow(labels, scopes)
    if (row) {
      if (isActiveRow(row)) return true
      return clickEl(row, '分区导航行')
    }
    if (Date.now() >= deadline) break
    await sleep(POLL_MS)
  }
  warn(`设置弹窗里没找到本插件的分区行（候选标题：${labels.join(' / ') || '无'}）`)
  return false
}

// ── 覆盖定位（把按钮贴到「设置」那一行的右端）────────────────────────────────

/**
 * 跳过 renderer 给槽位出口包的 `display:contents` 外层，拿到真正参与布局的容器。
 * （display:contents 的元素不生成盒子，所以「我的按钮的父节点」不是布局意义上的那一行。）
 */
export const layoutParent = (el) => {
  let p = el && el.parentElement
  while (p) {
    const s = styleOf(p)
    if (s && s.display !== 'contents') return p
    p = p.parentElement
  }
  return null
}

/**
 * 找出「设置按钮所在行」和它所在的 foot 区。认的是**结构关系**（父子 / 兄弟），不是 class：
 *   row  = 我按钮所在的那一行（footerActions）
 *   area = row 的下一个兄弟（settingsArea，设置按钮那一行）
 *   foot = row 的父节点（footArea）
 * 并用「area 里确实有设置触发按钮」交叉验证，防止结构变了却把按钮贴到别处。
 * @returns {{row, area, foot, gear}|null}
 */
export const findFootHosts = (button) => {
  const row = layoutParent(button)
  if (!row) return null
  const area = row.nextElementSibling
  if (!area) return null
  const gear = triggerEl(area)
  if (!gear) return null
  const foot = row.parentElement
  if (!foot || typeof foot.contains !== 'function') return null
  if (!foot.contains(area) || !foot.contains(button)) return null
  return { row, area, foot, gear }
}

/** 最近的「定位祖先」（position 不是 static 的那个）——绝对定位的包含块。 */
export const positionedAncestor = (el) => {
  let p = el && el.parentElement
  while (p) {
    const s = styleOf(p)
    if (s && s.position && s.position !== 'static') return p
    p = p.parentElement
  }
  return null
}

/** 「设置」按钮的**直接父元素** = DSH 的 triggerRow（连接指示器就并排放在这一行里）。 */
export const gearRowOf = (gear) => (gear && gear.parentElement) || null

/**
 * 同一行里 `except` 之外的**可见兄弟**（没有则 null）。
 *
 * 判据用**矩形**而不是 class：DSH 的类名是模块哈希（认不得），而这里需要的事实只有一个 ——
 * 「它占不占位」。宽高都 > 1px 才算占位，于是「渲染成空 div」与「压根没渲染」两种实现都覆盖得到。
 *
 * 为什么需要它：DSH 的 triggerRow（实测 `display:flex; gap:8px`，**没写 justify-content**
 * 即默认 flex-start）里除了「设置」按钮，还并排放着一个连接状态指示器
 * （`dsh-client-ui-settings-general` 的 ConnectionIndicator）—— web 与宿主断开时，
 * 它就是那条橙色的「自动重连中」。而「设置」按钮带 `flex:1`（吃满剩余宽度），指示器紧贴它右边。
 * 我们为了给键盘方块腾位置而**收窄设置按钮**时，指示器会跟着往左跑，正好落到方块下面。
 */
export const visibleSiblingOf = (row, except) => {
  let kids = null
  try { kids = Array.from((row && row.children) || []) } catch (e) { return null }
  for (const el of kids) {
    if (el === except) continue
    let r = null
    try { r = el.getBoundingClientRect() } catch (e) { continue }
    if (r && r.width > 1 && r.height > 1) return el
  }
  return null
}

/** 指示器的相位 → 词典键（三句话照抄 DSH 自己的措辞，见文件头）。 */
export const NOTICE_PHASE_KEY = {
  connecting: 'sidebar.connecting',
  disconnected: 'sidebar.disconnected',
  reconnected: 'sidebar.reconnected'
}

/**
 * 认那个邻居的相位（DSH 的 ConnectionIndicator 有三种）：
 *   connecting   —— `data-phase="connecting"`：橙色「自动重连中」
 *   disconnected —— 带 data-phase 但不是 connecting：橙色「连接异常」（可点，点了立即重连）
 *   reconnected  —— `[role="status"]` 那个 div：刚恢复时绿一下「连接成功」（不可点）
 * 认不出返回 null（调用方据此判定「这不是连接指示器」，会退回文档流）。
 */
export const noticePhaseOf = (el) => {
  if (!el) return null
  let phase = null
  try { phase = el.getAttribute('data-phase') } catch (e) { phase = null }
  if (phase === 'connecting') return 'connecting'
  if (phase !== null && phase !== undefined && phase !== '') return 'disconnected'
  return matches(el, '[role="status"]') ? 'reconnected' : null
}

/** 那一行里认得出的连接指示器（**不管它现在可不可见** —— 可能正被我们自己藏着）。 */
export const connNoticeOf = (gear) => {
  const row = gearRowOf(gear)
  return row ? q(row, CONN_NOTICE_SEL) : null
}

/** 那一行里所有候选（含被我们藏起来的：判据不能是「可见」，否则藏了以后就找不回来了）。 */
const noticeCandidates = (row) => (row ? (qa(row, CONN_NOTICE_SEL) || []) : [])

/**
 * 藏 / 放连接指示器 —— 用**自定义属性**，不用 class 也不用 inline style：
 * 后两者都在 React 的管辖里，它重渲染时会按自己的 props 覆盖回去（本项目踩过）。而
 * `data-omkb-conn-hide` 它压根不认识，永远不会碰。
 * @returns {boolean} 是否写成功；元素不在 DOM / 老浏览器没有这两个方法 → false，不抛错。
 */
export const setNoticeHidden = (el, on) => {
  if (!el || typeof el.setAttribute !== 'function') return false
  try {
    if (on) { el.setAttribute(NOTICE_HIDE_ATTR, '1'); return true }
    if (typeof el.removeAttribute === 'function') { el.removeAttribute(NOTICE_HIDE_ATTR); return true }
  } catch (e) {}
  return false
}

/**
 * 纯计算：把 size×size 的方块放到 gear 那一行的右端、竖直居中对齐。
 * @param containerRect - 包含块（定位祖先）的矩形。
 * @param gearRect - 设置按钮的矩形。**必须是没收窄过的天然矩形**：这个公式拿它的右端当「行右端」，
 *   而收窄正是要改它的宽度，用它收窄后的右端当基准会让方块一次比一次往右挪。
 * @returns {{top:number, right:number}} 绝对定位用的 top / right（px）。
 */
export const computePlacement = (containerRect, gearRect, size = BUTTON_SIZE, inset = GEAR_INSET) => ({
  top: Math.round(gearRect.top - containerRect.top + (gearRect.height - size) / 2),
  right: Math.round(containerRect.right - gearRect.right + inset)
})

const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt)

/**
 * 写 / 清设置按钮的宽度。**同时写 width 与 max-width**，理由见文件头「不能只写 width」那一段：
 * DSH 新版这个按钮是 `flex: 1 1 0%`（basis 0 + grow 1），宽度由剩余空间算出，`width` 不参与计算，
 * 只有 `max-width` 能把它 clamp 住；而旧版/非 flex 布局下 `width` 才是生效的那一个。
 * 只动宽度相关的两个属性，其余盒模型（margin / padding / 圆角 / 字体）一概不碰。
 * 传 null 表示恢复成 DSH 自己的宽度（清掉 inline 值，CSS 原值自然生效）——这一步必须能重复执行，
 * 因为每次摆放都会先恢复再重新量。
 */
export const narrowGear = (gear, width) => {
  if (!gear || !gear.style) return
  const v = width === null || width === undefined ? '' : Math.round(width) + 'px'
  try { gear.style.width = v } catch (e) {}
  try { gear.style.maxWidth = v } catch (e) {}
}

const setClass = (el, name, on) => {
  const cl = el && el.classList
  if (!cl) return
  try { if (on) cl.add(name); else cl.remove(name) } catch (e) {}
}

// 「写进去了却没变小」只告警一次：这类失效的症状是**静默**的（源码看起来收窄了、自检也绿，
// 只有真实浏览器里 hover 灰底还盖着图标），所以宁可吵一声也别让它无声无息地复发。
// 2026-09-23 就是这么踩的：DSH 0.1.5-rc.3 把该按钮改成 flex-basis 0 + grow 1，inline width 被无视。
let narrowWarned = false
const warnIfNotNarrowed = (gear, want) => {
  if (narrowWarned) return
  try {
    const got = gear.getBoundingClientRect().width
    if (got > want + 1) {
      narrowWarned = true
      warn(`设置按钮收窄没生效（想要 ${Math.round(want)}px，实际 ${Math.round(got)}px）：`
        + 'hover 背景可能仍会盖住键盘图标 —— DSH 大概又换了该按钮的布局方式（见 sidebar-action.jsx 头部）')
    }
  } catch (e) {}
}

/**
 * 把按钮贴到设置行右端（覆盖定位），并把设置按钮收窄留出间隔。量化不到就退回文档流。
 * @param opts.size / opts.inset / opts.gap - 覆盖设计常量（自检用）。
 * @returns {{top,right}|null} 摆放结果；null 表示已退回文档流。
 */
export const placeFootAction = (button, opts = {}) => {
  if (!button || !button.style) return null
  const hosts = findFootHosts(button)
  if (!hosts) { unpinFootAction(button); return null }

  // 「设置」那一行里除了按钮还有别的可见东西时，那一行就不归我们安排了。
  // 其中**连接指示器是认得出的例外**：把它藏起来（我们改用气泡展示，见 syncConnTip），
  // 那一行就恢复成「只有一个设置按钮」，覆盖定位照常。认不出的邻居则退回文档流：绝不重叠。
  //
  // 先「放出来」再量天然几何 —— 上一轮很可能正是我们把它藏起来的，而藏起来的元素宽高为 0，
  // 直接量就会把「我们自己造成的不可见」当成「本来就没有邻居」，然后一直贴着（气泡没了、
  // 指示器也被永久藏了）。同 narrowGear 的「先恢复再量」一个道理。
  const row = gearRowOf(hosts.gear)
  for (const el of noticeCandidates(row)) setNoticeHidden(el, false)
  const sibling = visibleSiblingOf(row, hosts.gear)
  const notice = sibling && noticePhaseOf(sibling) ? sibling : null
  if (sibling && !notice) {
    unpinFootAction(button)
    return null
  }
  if (notice) setNoticeHidden(notice, true)

  const container = positionedAncestor(button)
  if (!container || typeof container.getBoundingClientRect !== 'function') { unpinFootAction(button); return null }

  const size = num(opts.size, BUTTON_SIZE)
  const inset = num(opts.inset, GEAR_INSET)
  const gap = num(opts.gap, GEAR_GAP)

  // 先把设置按钮恢复成 DSH 自己的宽度，理由有两条：
  //   ① 键盘方块的位置以「天然几何」为基准（见 computePlacement 的说明）；
  //   ② 免得拿已经被收窄过的宽度再收窄一次（收一次瘦一圈）。
  narrowGear(hosts.gear, null)
  // 记下齿轮引用：结构万一变了（unpin 时 findFootHosts 返回 null）也还找得回它来恢复宽度。
  button.__omkbGear = hosts.gear

  // 先脱离文档流再量：脱离后 footerActions 会塌成 0 高、设置行上移，量到的才是最终位置。
  button.style.position = 'absolute'
  setClass(button, 'omkb-foot-action--pinned', true)
  const box = container.getBoundingClientRect()
  const gearRect = hosts.gear.getBoundingClientRect()
  const pos = computePlacement(box, gearRect, size, inset)
  button.style.top = pos.top + 'px'
  button.style.right = pos.right + 'px'
  button.style.left = 'auto'

  // 收窄设置按钮：让它的盒子（= hover 时那块灰色背景）在方块左侧 gap 处收住。
  // 方块右端 - 方块宽 - gap → 齿轮的目标右端；再减齿轮左端 = 目标宽度（border-box，实测如此）。
  // narrowGear 会同时写 width 与 max-width（新版 DSH 齿轮是 flex-basis 0 + grow 1，只写 width 无效）。
  const keyRight = box.right - pos.right
  const want = keyRight - size - gap - gearRect.left
  // 只收窄、不放宽；窄到会挤坏「设置」两个字时干脆不动（保持原样，宁可重叠也不压坏界面）。
  if (want >= MIN_GEAR_WIDTH && want < gearRect.width) {
    narrowGear(hosts.gear, want)
    // 回量一次：写进去了却还是满行 = 这个 DSH 版本用别的方式决定宽度（本次踩的就是这种），
    // 继续静默下去用户只会看到「灰底还盖着图标」。告警不阻断摆放。
    warnIfNotNarrowed(hosts.gear, want)
  }
  // notice 带出去：组件据此决定气泡显不显示、显示哪一句（null = 没有提示）。
  return { ...pos, notice }
}

/** 退回文档流（收起成导轨时用，也是摆放失败时的兜底），并把设置按钮的宽度还回去。 */
export const unpinFootAction = (button) => {
  if (!button || !button.style) return
  // 退回文档流之后那一行又归 DSH 安排了，不再有重叠风险：把可能被我们藏起来的连接指示器放回去。
  const hosts0 = findFootHosts(button)
  for (const el of noticeCandidates(hosts0 ? gearRowOf(hosts0.gear) : null)) setNoticeHidden(el, false)
  setClass(button, 'omkb-foot-action--pinned', false)
  for (const k of ['position', 'top', 'right', 'left']) {
    try { button.style[k] = '' } catch (e) {}
  }
  // 宽度也要还回去（我们可能收窄过它，width 与 max-width 两个都写进去过）。优先用摆放时记下的
  // 引用，这样结构已经变了也能恢复；引用留在元素上不清理：它与按钮同生命周期，不会攒住别的东西。
  narrowGear(button.__omkbGear || (findFootHosts(button) || {}).gear, null)
}

// ── 「与后台断开」气泡（替代 DSH 那一行里的连接指示器）─────────────────────────
// 节点是**模块级单例**（这个槽位只会有一个条目），**自己 create、挂在 document.body 上**，
// 不走 React：① React 管不着它，重渲染顶不掉；② 挂在 body + position:fixed，不会被 footer
// 那一行的 overflow 裁掉。文字与小尾巴是两个子元素 —— 写文字时不会把尾巴顶掉。
let tipEl = null
let tipTextEl = null
let tipTailEl = null

/** 视口宽度（判断「上方放不下、该翻到下方」要用）。取不到返回 0。 */
const viewportWidth = () => {
  const w = winOf()
  const n = w && Number(w.innerWidth)
  if (Number.isFinite(n) && n > 0) return n
  try {
    const de = (typeof document !== 'undefined') && document.documentElement
    const m = de && Number(de.clientWidth)
    if (Number.isFinite(m) && m > 0) return m
  } catch (e) {}
  return 0
}

/** 取（必要时创建）气泡节点。取不到 document 时返回 null，调用方据此跳过。 */
export const connTipNode = () => {
  if (tipEl) return tipEl
  let doc = null
  try { doc = (typeof document !== 'undefined') ? document : null } catch (e) { doc = null }
  if (!doc || typeof doc.createElement !== 'function') return null
  try {
    tipEl = doc.createElement('div')
    tipTextEl = doc.createElement('span')
    tipTailEl = doc.createElement('span')
  } catch (e) { tipEl = null; tipTextEl = null; tipTailEl = null; return null }
  setClass(tipEl, 'omkb-conn-tip', true)
  setClass(tipTextEl, 'omkb-conn-tip__text', true)
  setClass(tipTailEl, 'omkb-conn-tip__tail', true)
  // role=status：正常状态下它就是一条「状态播报」，读屏会念出来（原来那句提示也是这个语义）。
  try { tipEl.setAttribute('role', 'status') } catch (e) {}
  try { tipEl.appendChild(tipTextEl); tipEl.appendChild(tipTailEl) } catch (e) {}
  return tipEl
}

/**
 * 把气泡摆到方块正上方、尾巴对准方块中心；上方放不下就翻到下方（尾巴朝上）。
 * 用 position:fixed + 视口坐标（节点在 body 上，包含块就是视口），
 * 所以这里只量方块自己的矩形，不去碰包含块。
 * @param tip - 气泡节点（connTipNode() 的产物）。
 * @param button - 键盘方块。
 * @param opts.size / opts.gap / opts.tail / opts.viewportWidth - 覆盖设计常量（自检用）。
 * @returns {{top,right,below}|null}
 */
export const placeConnTip = (tip, button, opts = {}) => {
  if (!tip || !tip.style || !button) return null
  const size = num(opts.size, BUTTON_SIZE)
  const gap = num(opts.gap, TIP_GAP)
  const tail = num(opts.tail, TIP_TAIL)
  const b = button.getBoundingClientRect()
  const r = tip.getBoundingClientRect()
  const h = num(r.height, num(opts.tipHeight, 30))
  const w = num(r.width, 0)
  let top = b.top - gap - h
  const below = top < 0
  if (below) top = b.bottom + gap
  const vw = num(opts.viewportWidth, viewportWidth())
  // 右边缘与方块右边缘齐平（方块贴在最右端，气泡往左展开）
  let right = vw ? vw - b.right : 0
  // 但不许越过视口左缘（窄侧边栏 + 长文案时）
  if (vw && w && vw - right - w < GEAR_INSET) right = vw - GEAR_INSET - w
  tip.style.top = Math.round(top) + 'px'
  tip.style.right = Math.round(Math.max(0, right)) + 'px'
  tip.style.left = 'auto'
  if (tipTailEl && tipTailEl.style) tipTailEl.style.right = Math.round(size / 2 - tail / 2) + 'px'
  setClass(tip, 'omkb-conn-tip--below', below)
  return { top, right, below }
}

/**
 * 同步气泡：有连接指示器就显示（文字由调用方按相位给），没有就收起。
 * @param button - 键盘方块（气泡锚在它上方）。
 * @param notice - 被我们藏起来的指示器元素；null / 空 → 收起气泡。
 * @param opts.text / opts.ariaLabel / opts.onClick / opts.size / opts.gap - 文案与行为。
 * @returns {boolean} 气泡此刻是否可见。
 */
export const syncConnTip = (button, notice, opts = {}) => {
  const tip = connTipNode()
  // 没有提示（或没有方块）→ 收起气泡。这是最常见的一条，先走掉。
  if (!button || !notice) { if (tip) setClass(tip, 'omkb-conn-tip--on', false); return false }
  // 挂到 body 上。每次都查一次父节点：真机上是首次挂载，自检里每个场景换一份 document。
  let body = null
  try { body = (typeof document !== 'undefined' && (document.body || document.documentElement)) || null } catch (e) { body = null }
  // 气泡建不出来 / 挂不上 → **把指示器放回去**：宁可让那条提示留在 DSH 原来的位置（顶多是我们
  // 贴右端时挨着它），也不能「藏了提示又没有任何替代」。这条只在环境异常时才会走到。
  if (!tip || !body || typeof body.appendChild !== 'function') { setNoticeHidden(notice, false); return false }
  if (tip.parentElement !== body) {
    try { body.appendChild(tip) } catch (e) { setNoticeHidden(notice, false); return false }
  }
  const text = String(opts.text == null ? '' : opts.text)
  if (tipTextEl) tipTextEl.textContent = text
  // 只给可访问名、不给 title：气泡自己就把话说完了，再来一层原生 tooltip 是重复。
  try { tip.setAttribute('aria-label', String(opts.ariaLabel || text)) } catch (e) {}
  if (typeof opts.onClick === 'function') tip.onclick = opts.onClick
  setClass(tip, 'omkb-conn-tip--on', true)
  placeConnTip(tip, button, opts)
  return true
}

/** 收起气泡（卸载 / 收起成导轨 / 找不到提示时）。节点留着复用，只是摘下来。 */
export const disposeConnTip = () => {
  if (!tipEl) return
  setClass(tipEl, 'omkb-conn-tip--on', false)
  try {
    const p = tipEl.parentElement
    if (p && typeof p.removeChild === 'function') p.removeChild(tipEl)
  } catch (e) {}
}

/**
 * 把设置弹窗从本分区切到**别的**分区。
 *
 * 用途：「移除键盘」（见 client/device.js）会把设置页里我们那一行藏起来（nav-icon.js 的
 * setNavRowHidden）。若用户此刻正停在本分区，弹窗里会只剩一块空白内容区 —— 看着像坏了。
 * 找一个别的分区行点掉，用户就落在正常页面上。
 *
 * 三个「找不到就不动」，绝不猜：找不到本分区行 / 找不到别的行 / 除了我们没有任何行。
 * @param label - 本分区标题（`t('nav')`，与注册时同源）。
 * @param roots - 查找范围，默认 document。
 * @returns {boolean} 是否真的点掉了别的分区行。
 */
export const leaveOurSection = (label, roots) => {
  if (typeof document === 'undefined') return false
  const where = Array.isArray(roots) && roots.length ? roots : [document]
  const mine = findSectionRow(candidateLabels(label), where)
  if (!mine) return false
  for (const c of navScopes(document)) {
    for (const row of qa(c, 'button, [role="button"], a') || []) {
      if (row === mine) continue
      if (!textOf(row).trim()) continue // 空行（分隔符之类）
      if (row.getAttribute('aria-current') === 'true') continue // 已经在这一项上
      try { row.click(); return true } catch (e) {}
    }
  }
  return false
}

// 浏览器控制台 / 自检的观测点：__dshOmkb.openKeyboardSettings() 可直接验证这条链路
// （不用真的去点侧边栏那个图标）；footAction.* 是这条链路的内部零件，给自检与控制台调用。
DSVI.openKeyboardSettings = openKeyboardSettings
DSVI.leaveOurSection = leaveOurSection
DSVI.footAction = {
  open: openKeyboardSettings,
  place: placeFootAction,
  unpin: unpinFootAction,
  narrow: narrowGear,
  hosts: findFootHosts,
  // 摆放计算用的「包含块」= 最近的定位祖先。暴露出来给控制台/自检排查「到底贴在谁身上」。
  // ⚠ 别拿它验「内缩」：包含块是横跨视口的 frame，`包含块.right - 按钮.right` 是上千 px，不是判据
  //   （判据是「天然齿轮右端 − 按钮右端 = GEAR_INSET」，见 probes/foot.mjs）。
  ancestor: positionedAncestor,
  placement: computePlacement,
  layoutParent,
  // 「设置」那一行里已就位的邻居（连接指示器）——控制台/自检用它回答「现在方块为什么不在右端」。
  gearRow: gearRowOf,
  sibling: visibleSiblingOf,
  // 连接指示器那条线：认相位、藏/放、以及替代它的气泡（控制台可
  // `__dshOmkb.footAction.tipNode()` 看那颗气泡节点长什么样）。
  notice: connNoticeOf,
  noticePhase: noticePhaseOf,
  hideNotice: setNoticeHidden,
  tipNode: connTipNode,
  placeTip: placeConnTip,
  syncTip: syncConnTip,
  disposeTip: disposeConnTip,
  candidateLabels
}

/**
 * 侧边栏底部动作：方形键盘按钮（只有图标，没有文案）。
 * @param props.wide - 侧边栏是否展开（owner props，见 sidebar.footer.action 槽位契约）。
 * @param props.t - 本插件命名空间的翻译函数（注册时声明 locale 由框架注入）。
 */
export function OmkbSidebarAction({ wide, t }) {
  const ref = useRef(null)
  const tr = typeof t === 'function' ? t : null
  // locale 那一段没装配成功时 t 可能是空的：退到词典里的中文文案（只做 aria-label / title，
  // 不显示在界面上——这个入口只有图标）。
  const dict = (DSVI && DSVI.locales && DSVI.locales.zh) || {}
  const label = (tr && tr('sidebar.action')) || dict['sidebar.action'] || 'OMKB'

  // 「这台键盘被移除了 + 现在没连上」→ 整个入口连引导浮层一起返回 null（用户点过移除，
  // 界面就该干净地消失；设备重新连上时控制器会把标记清掉，这里随之回来）。
  // 判据在 client/device.js（内部走 utils/device.js 的 isDeviceHidden），不在组件里另判一次。
  //
  // 另外还要「断开」这一档（2026-09-24）：图标右上挂个红点 + 悬停说明键盘没连上、点进去能重连。
  // 判据同样只有一处（utils/device.js 的 isDeviceOffline），而且要带 `known` —— 页面刚加载、
  // 还没听到宿主说话时既不算连上也不算断开，一律按正常画（不然每次刷新都先闪一下红点）。
  const device = DSVI.services ? DSVI.services.device : null
  const snapOf = (d) => ({
    hidden: !!(d && d.hidden),
    offline: !!(d && isDeviceOffline({ known: d.known, open: d.open }))
  })
  const [dev, setDev] = useState(() => snapOf(device))
  useEffect(() => {
    if (!device || typeof device.subscribe !== 'function') return undefined
    const sync = () => setDev(snapOf(device))
    sync()
    return device.subscribe(sync)
  }, [device])
  const hidden = dev.hidden
  const offline = dev.offline

  // 「与后台断开」气泡的两段文案：正文按指示器的相位选（三句都照抄 DSH 自己的措辞），
  // 可访问名说清「点一下会做什么」。词典取不到就退回中文兜底（和上面 tip 一个写法）。
  const pick = (key, fallback) => (tr && tr(key)) || dict[key] || fallback
  const noticeText = (notice) => {
    const key = NOTICE_PHASE_KEY[noticePhaseOf(notice)] || NOTICE_PHASE_KEY.disconnected
    return pick(key, '连接异常')
  }
  const noticeAria = (notice) => {
    const body = noticeText(notice)
    const action = pick('sidebar.reconnectNow', '点击立即重连')
    return body ? body + ' · ' + action : action
  }
  // 点气泡 = 点那颗被我们藏起来的指示器（DSH 自己的行为：断开 → 立即重连；重连中 → 重启）。
  // 指示器已经不在了（刚好恢复）→ 什么都不做：重连不归这个入口发起（见文件头「点击行为不变」）。
  const onNoticeClick = () => {
    const btn = ref.current
    const hosts = btn ? findFootHosts(btn) : null
    const el = hosts ? connNoticeOf(hosts.gear) : null
    if (!el) return
    try { el.click() } catch (e) { warn('点连接指示器失败：' + ((e && e.message) || e)) }
  }

  // 展开态：贴到设置行右端（覆盖定位）。布局会动（折叠动画、窗口缩放、别家动作行增减），
  // 所以除了挂载时，还跟着 rAF / 一拍之后 / resize / foot 区尺寸变化各重量一次。
  // `hidden` 也在依赖里：从隐藏回到显示时按钮是**新挂载**的，不重跑就没人摆放它。
  useEffect(() => {
    const btn = ref.current
    const w = winOf()
    if (!btn || !w) return undefined
    if (!wide) { unpinFootAction(btn); disposeConnTip(); return undefined }
    const place = () => {
      try {
        const r = placeFootAction(btn)
        const notice = r ? r.notice : null
        // 气泡：有连接指示器（被我们藏起来的那颗）就显示，文字按它的相位选。
        // 点气泡 = 点那颗指示器（断开时它就是「立即重连」），行为与 DSH 原样一致。
        syncConnTip(btn, notice, {
          text: noticeText(notice),
          ariaLabel: noticeAria(notice),
          onClick: onNoticeClick
        })
      } catch (e) { warn('摆放键盘入口失败：' + ((e && e.message) || e)) }
    }
    place()
    const raf = typeof w.requestAnimationFrame === 'function' ? w.requestAnimationFrame(place) : 0
    const timer = setTimeout(place, 260) // 折叠动画跑完再量一次
    let ro = null
    try {
      if (typeof ResizeObserver === 'function') {
        const hosts = findFootHosts(btn)
        if (hosts) { ro = new ResizeObserver(place); ro.observe(hosts.foot) }
      }
    } catch (e) { ro = null }
    // 「设置」那一行的守卫（2026-09-25）。
    // 连接指示器出现/消失只改那一行**内部**的节点与样式，foot 的整体尺寸一点不变 ——
    // ResizeObserver 看不到它，而它正是「与宿主断开时方块错位」的触发源。所以单独守那一行。
    // 回调里过滤掉「只有设置按钮自己的 style 变了」：那是我们收窄时写的，理会它就会自激。
    // 每次都重新取一次 gear（React 可能整行换新节点），不拿闭包里的旧引用比。
    let mo = null
    try {
      if (typeof MutationObserver === 'function') {
        const hosts = findFootHosts(btn)
        const gRow = hosts && gearRowOf(hosts.gear)
        if (gRow) {
          mo = new MutationObserver((records) => {
            const gearNow = (findFootHosts(btn) || {}).gear
            if (records.some((r) => !(r.type === 'attributes' && r.target === gearNow))) place()
          })
          // data-phase 也在观察列表里：指示器从「重连中」变「连接异常」时**只有它变**
          // （class 是同一套、我们自己的标记属性它不管），不盯它气泡上的字就会停在旧的那句。
          // 我们自己的 data-omkb-conn-hide 不在列表里 → 藏/放不会把回调叫醒（不自激）。
          mo.observe(gRow, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'style', 'data-phase']
          })
        }
      }
    } catch (e) { mo = null }
    w.addEventListener('resize', place)
    return () => {
      try { if (raf) w.cancelAnimationFrame(raf) } catch (e) {}
      try { clearTimeout(timer) } catch (e) {}
      try { if (ro) ro.disconnect() } catch (e) {}
      try { if (mo) mo.disconnect() } catch (e) {}
      try { w.removeEventListener('resize', place) } catch (e) {}
      unpinFootAction(btn)
      disposeConnTip()
    }
  }, [wide, hidden])

  const onClick = () => {
    // 分区标题取设置页注册时用的同一个 t('nav')——两边同源，导航行文字才对得上。
    openKeyboardSettings(tr ? tr('nav') : undefined).then((ok) => {
      if (!ok) warn('没能直接打开键盘设置页，可手动从设置里进入「' + (dict.nav || 'OMKB') + '」')
    })
  }

  // 被移除（且没连上）：入口整个收起来 —— 连引导浮层一起（它平时也是 null，不影响定位）。
  if (hidden) return null

  // 悬停/可访问名：断开时换口径说清楚「键盘没连上、点进去能重连」。
  // **点击行为不变**（仍是打开设置页）：重连要在设置页那个「重新连接」按钮上做，
  // 这里只负责让人知道现在需要重连 —— 用户 2026-09-24 明确选的口径。
  const tip = offline ? ((tr && tr('sidebar.offline')) || dict['sidebar.offline'] || '键盘已断开') : label

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-omkb-foot="1"
        className={'omkb-foot-action' + (wide ? '' : ' omkb-foot-action--rail')}
        aria-label={tip}
        title={tip}
        onClick={onClick}
      >
        {/* 红点挂在图标右上角（按钮 36 / 图标 20，所以贴着按钮内圈右上就是图标右上）。
            只在这一个状态下出现，且**不是**可点区域（pointer-events:none）：这个入口的点击
            语义只有一个 —— 打开键盘设置页。

            写成「整块二选一」而不是「图标 + 一个可能为 null 的点」：后者在真 React 里没问题
            （null 孩子会被忽略），但会让这个按钮的孩子**永远是数组**，自检里那一串
            「唯一的孩子是 svg」的断言就得跟着变形。形状按真 React 的语义写，桩才骗不了人。 */}
        {offline ? (
          <>
            {KeypadIcon(ICON_SIZE)}
            <span className="omkb-foot-action__dot" />
          </>
        ) : KeypadIcon(ICON_SIZE)}
      </button>
      {/* 首次连接引导。挂在这里只因为这个槽位在应用外壳里一直在（不像设置页要打开才有），
          而弹窗自己是 `position:fixed` 的整屏遮罩，挂在哪个槽位都盖满视口。
          它只在「设备刚连上 + 还没看过」时渲染出东西，平时是 null，不影响上面那颗按钮的定位。 */}
      <OmkbGuideHost t={tr} onOpenSettings={() => { onClick() }} />
    </>
  )
}
