// dsh-micro · client/components/sidebar/action.jsx
// 侧边栏最下层：**「设置」按钮同一行的右端**放一个方形键盘按钮，点一下直接打开键盘设置页。
//
// ── 位置：只能靠覆盖定位 ─────────────────────────────────────────────
// 侧边栏底部是**两行竖排**（footArea 纵向 flex：footerActions 行 + settingsArea「设置」行）。
// 横向 flex 里塞占满宽度的行会各占一行 —— 所以「和设置按钮并列」只能 `position:absolute` 贴到
// 设置行右端；它脱离文档流后 footerActions 高度归零，底栏不多出一行。
// 数值一律 `getBoundingClientRect` 现场量（DSH 类名是哈希、行高随展开/收起变）；量不到就**退回
// 文档流**（仍可用，只多占一行），绝不隐藏、绝不抛错。收起成 56px 导轨时不覆盖 ——
// 留在流里就是 36×36 居中方块，正好落在齿轮正上方。
//
// ── 两条硬约束（都是实机踩出来的，改坏它立刻看得见）─────────────────
// ① **必须挤「设置」按钮的宽度**：它是整行宽的，hover 灰底会一路盖到图标下，两个图标看着粘成一块。
//    ⚠ **width + max-width 双写**：新版那个按钮是 `flex: 1 1 0%`（basis 0 + grow 1），宽度由剩余空间
//    算出，**inline `width` 根本不参与** —— 只写 width 的结果是「源码收窄成功、自检也绿、实机灰底
//    纹丝不动」。（把 flex-grow 归零也不行：basis 仍是 0，按钮缩成内容宽、字被压扁。）
//    每轮摆放先清掉自己写的宽度再收窄（**幂等**，否则一轮瘦一圈）；窄到会挤坏文案（< MIN_GEAR_WIDTH）
//    就干脆不收，宁可重叠也不压坏界面。
// ② **「那一行」只能有一个定义** = `gearRowOf(gear)` = `layoutParent(gear)`（跳过 `display:contents`）。
//    曾因另一处用 `gear.parentElement`（= launcher 出口）导致指示器既不被藏也弹不出气泡、就地压住方块。
//    藏邻居（`data-micro-conn-hide`）与标记行（`data-micro-gear-row`）必须共用这一个函数。
//
// ── 邻居的处理：先问「占不占位」────────────────────────────────────
// ① **认得出的连接指示器**（断开/重连时的橙条、刚恢复的绿条，正好落在我们要贴的位置）→
//    **藏起来**，改用贴在自己方块上方的深色气泡展示同一句话，**点气泡 = 点被藏的指示器**（能力原样交还
//    DSH）；文案照抄 DSH 自己的词典，别让人以为界面上有两样东西在说同一件事。
// ② **认不出的邻居 → 退回文档流**：宁可多占一行也绝不重叠。
// ③ **浮动层（`isOverlay`）不算邻居** —— fixed/absolute 不参与行布局。「设置」自己的 hover 提示就是
//    这种（Tooltip 渲染成锚点后面的兄弟），没有这条判据时鼠标一悬停方块就当场跳走。
// ④ 「设置」的悬停提示由我们挪到**行上方**：它默认 `side:"right"`，按钮收窄后那个位置正好落进方块里。
//
// ── 「直接打开设置里的某一页」怎么实现 ────────────────────────────────
// 设置弹窗没有 `openSettings(sectionId)` 之类的接口，只能：点触发按钮开弹窗 → 点掉导航里文字匹配的
// 那一行。前提都是真实应用里验过的：触发按钮是
// `[data-slot="sidebar.settings"]` 里的 `button[aria-haspopup="dialog"]` 且带 `aria-expanded`
// ——**已经开着时不能再点**（一点就关了）；弹窗挂在 `shell.overlay`、不在槽位出口里，所以导航行要按
// 「在 `nav` 或 `[role="dialog"]` 里的按钮」查，不能只认 `role=dialog`（有的版本弹窗根没有它）。
// 一律只认 data-slot / aria / 结构关系，**不猜哈希 class**；找不到就 `warn` 并返回 false。
//
// 2026-09-28 起有**两个**落地目标，共用 `openSection` 一份实现（只有候选文字不同）：
//   * `openKeyboardSettings` → 本插件分区（候选 = 词典里各语言的 `nav`）；
//   * `openGeneralSettings`  → DSH 的**通用**分区（导航第一项，候选见 GENERAL_SECTION_LABELS）。
// 键帽上对应两颗键：**「键盘设置」**（键盘图标，长按旋钮也是它）与**「设置」**（齿轮图标）。
// 别再复制第二份点击顺序 —— 那种「同一个动作、不同目标」的代码最容易一处改了一处没改。
//
// ── 「键盘已断开」的红点 ────────────────────────────────────────────
// 断开时图标右上角挂小红点（此前连上和断开长得一模一样，「重新连接」却藏在设置页里）。
// ⚠ 判据只有一处（`utils/device.js` 的 `isDeviceOffline`）**且必须带 `known`** ——
//   「还没听到宿主说话」≠「断开」，否则每次刷新都先闪一下红点。
// ⚠ **点击行为不变**（仍打开设置页）：红点是告知，重连由设置页那个按钮发起，所以它是
//   `pointer-events:none` 的纯装饰，不把入口的点击语义劈成两个。画在按钮**内部**
//   （按钮 `overflow:hidden`，画到框外会被裁掉）。
//
// 三轮施工史（让位 vs 代偿 / `gearRowOf` 找错行 / 悬停错位）见技能 §4「覆盖定位」那一节。

import { useEffect, useRef, useState } from 'react'
import { DSVI, KeypadIcon } from '../../core.js'
import { isDeviceOffline } from '../../utils/device.js'
import { MicroGuideHost } from '../modals/guide.jsx'

/** 槽位名（与 core.js 的 SLOT_FOOT_ACTION 同值，导出便于自检引用）。 */
export const FOOT_ACTION_SLOT = DSVI.SLOT_FOOT_ACTION
/** 本插件在这个槽位里的条目 id。 */
export const FOOT_ACTION_ID = 'micro-keyboard'

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
/** 打在指示器上的标记属性：CSS 靠它把指示器藏起来（`[data-micro-conn-hide]{display:none}`）。 */
export const NOTICE_HIDE_ATTR = 'data-micro-conn-hide'
/** 气泡与键盘方块之间的间隔（px）。 */
export const TIP_GAP = 6
/** 小尾巴的宽度（px，也是它三角形的高）。 */
export const TIP_TAIL = 12

/**
 * 给我们贴着的那一行打的标记 —— CSS 靠它把行变成定位祖先（`position:relative`，
 * DSH 现在自己也有一条，但那是它的类名管着，不保险）。
 */
export const GEAR_ROW_ATTR = 'data-micro-gear-row'
/**
 * 给「设置」的悬停提示打的标记。**只打紧跟在设置按钮后面那一个**：
 * 同一行里可能还有别的提示（桌面更新指示器也是 Tooltip，side:top），一起改就把别人的位置也挪了。
 */
export const GEAR_TIP_ATTR = 'data-micro-gear-tip'
/** 提示与那一行之间的间隔（px，CSS 里那条 `bottom: calc(100% + 8px)` 用的就是它）。 */
export const TIP_ABOVE_GAP = 8

/** 弹窗打开后等导航行出现的预算：React 提交是异步的，但也就一两帧的事。 */
export const NAV_WAIT_MS = 1200
const POLL_MS = 16

const warn = (msg) => { try { console.warn('[micro] ' + msg) } catch (e) {} }

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
 * 「通用设置」分区在导航里的候选文案（DSH 自己注册的 `settings.section`，排在导航第一位）。
 *
 * 文案不归我们 —— 只能照抄 DSH 的说法，中英各一。`findSectionRow` 的兜底是**包含匹配**，
 * 所以「通用」既能命中「通用」也能命中「通用设置」；再加别的写法只会带来误击（比如
 * 英语界面里 "General" 命中 "General settings" 是对的，命中了 "General 2" 就点错了）。
 * 真机若换了词（探针 dump 导航行即可看到，见 test/probes/keycaps.mjs），只改这一行。
 */
export const GENERAL_SECTION_LABELS = ['通用', 'General']

/**
 * 打开设置弹窗并落到**指定的那一个分区**（deep-link 的公共实现）。
 *
 * 两个调用方（本插件分区 / 通用分区）的差别**只有候选文字**：触发按钮、查询范围、点击顺序、
 * 「已经在本分区就不点」「弹窗开着就别再点触发按钮」这些判据、以及兜底告警，一字不差。
 * 所以合并成一份实现 —— 复制两份的代价是它们迟早各自漂移（「一处能开一处打不开」这类
 * 分裂症状，本项目已经踩过好几次），而这类「同一个动作、不同目标」正是最容易漂的形态。
 *
 * @param labels - 分区标题候选数组（精确匹配优先，退化为包含匹配）。
 * @param waitMs - 等导航行出现的预算（毫秒）。
 * @param what - 目标的名字（只进告警文案，不参与判据）。
 * @returns {Promise<boolean>} 是否成功把分区行点开（找不到就 false，不抛错）。
 */
const openSection = async (labels, waitMs, what) => {
  if (typeof document === 'undefined') return false
  const outlet = q(document, SETTINGS_OUTLET_SEL)
  const scopes = [outlet, document].filter(Boolean)

  // 已经能点到行：在本分区就不动，否则点过去（不碰触发按钮，免得把弹窗关掉）。
  const found = findSectionRow(labels, scopes)
  if (found) {
    if (isActiveRow(found)) return true
    return clickEl(found, '分区导航行')
  }

  const trigger = triggerEl(document)
  if (!trigger) {
    warn(`找不到侧边栏设置按钮（[data-slot="sidebar.settings"] button[aria-haspopup="dialog"]），无法打开${what}`)
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
  warn(`设置弹窗里没找到分区行（要打开：${what}；候选标题：${labels.join(' / ') || '无'}）`)
  return false
}

const waitOf = (opts) => {
  const ms = opts && opts.waitMs
  return Number.isFinite(ms) ? ms : NAV_WAIT_MS
}

/**
 * 打开设置弹窗并直接落到「DSH小键盘」分区（= 键盘设置页）。
 * @param label - 本插件分区标题（组件里传 t('nav')）；省略时只用词典里的候选。
 * @param opts.waitMs - 等导航行出现的预算（毫秒）；默认 NAV_WAIT_MS，自检用来调短。
 * @returns {Promise<boolean>} 是否成功把分区行点开（找不到就 false，不抛错）。
 */
export const openKeyboardSettings = (label, opts = {}) =>
  openSection(candidateLabels(label), waitOf(opts), '键盘设置页')

/**
 * 打开设置弹窗并直接落到**通用**分区（「设置」键）。
 *
 * 与 openKeyboardSettings 共用同一份实现，所以不需要单独的降级路径：拿不到触发按钮、
 * 等不到导航行，两者都是同一句话（见 openSection 的两条 warn），不会一个出声一个静默。
 * @param opts.waitMs - 等导航行出现的预算（毫秒）；自检用来调短。
 * @returns {Promise<boolean>} 是否成功落到通用分区。
 */
export const openGeneralSettings = (opts = {}) =>
  openSection(GENERAL_SECTION_LABELS, waitOf(opts), '通用设置')

// ── 覆盖定位（把按钮贴到「设置」那一行的右端）────────────────────────────────

/**
 * display:contents 判据：这种元素**不生成盒子**（renderer 给每个槽位出口包的那层就是它），
 * 所以它既不该参与「谁占位」的判断，也不能当包含块（见 layoutParent）。
 * 读 computed style（不是读 inline style）：`display:contents` 是 renderer 写在内联样式上的，
 * 但将来若改成类名，读 computed 仍然认得出来。
 */
const isContents = (el) => {
  const s = styleOf(el)
  return !!s && s.display === 'contents'
}

/**
 * 跳过 renderer 给槽位出口包的 `display:contents` 外层，拿到真正参与布局的容器。
 * （display:contents 的元素不生成盒子，所以「我的按钮的父节点」不是布局意义上的那一行。）
 */
export const layoutParent = (el) => {
  let p = el && el.parentElement
  while (p) {
    if (!isContents(p)) return p
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

/**
 * 「设置」按钮所在的那一行 —— DSH 的 triggerRow。连接状态指示器与桌面更新指示器就并排放在
 * 这一行里（见文件头「设置那一行」一节），所以「这一行里还有没有别人」决定我们能不能贴右端。
 *
 * ⚠ 这里**不能**用 `gear.parentElement`（2026-09-26 用户第三次报「重新连接又改回黄色错位了」的
 * 根因）。真机上从齿轮往上数是这样几层：
 *
 *     settingsArea
 *       └── div[data-slot="sidebar.settings"]        display:contents   ← UI 包的槽位出口
 *            └── div.triggerRow                      display:flex;gap:8px  ← 真正的那一行
 *                 ├── div[data-slot="settings.launcher"] display:contents ← **齿轮的父亲**
 *                 │    ├── button[aria-haspopup="dialog"]                 ← 齿轮
 *                 │    └── span[role="tooltip"]                           ← 悬停提示（锚点的下一个兄弟）
 *                 ├── ConnectionIndicator（橙色的「自动重连中」/ 绿色的「连接成功」）
 *                 └── DesktopUpdateIndicator
 *
 * 依据（从应用产物里读到的 `dsh-client-ui-settings-general` 的 SettingsRoot）：
 *   `jsxs("div", { className: triggerRow, children: [renderSlot("settings.launcher", …, {
 *      fallback: jsx(Tooltip, { …, children: jsx("button", { "aria-haspopup": "dialog" }) }) }),
 *      jsx(ConnectionIndicator, …), jsx(DesktopUpdateIndicator, …)] })`
 * 也就是：**齿轮被槽位出口包着，槽位出口在 triggerRow 里面**。
 *
 * 于是 `gear.parentElement` 拿到的是那个 display:contents 的出口（它没有盒子、也不含指示器）：
 *   * `noticeCandidates(出口)` 永远是空的 → 橙色指示器既不被藏、也弹不出替代气泡；
 *   * `visibleSiblingOf(出口, 齿轮)` 只会撞见悬停提示（浮动层，被 isOverlay 跳过）→ 返回 null；
 *   * 结果：我们照旧把方块贴到那一行右端，而橙色指示器也在那一行右端 —— **就地重叠**
 *     （正是用户截图里「黄色压住键盘方块」）。
 * 同一个坑还让组件里那个 MutationObserver 观察错了节点，指示器出现/消失都不会叫醒我们。
 *
 * 改用 `layoutParent`（跳过 display:contents）：拿到的是 triggerRow，与 `markGearTip` 打行标记
 * 用的**同一个元素** —— 两处判据一致，这类「一半对一半错」的分裂症状才不会再来。
 */
export const gearRowOf = (gear) => (gear ? layoutParent(gear) : null)

/**
 * 浮动层判据：`position` 为 fixed / absolute 的元素**不参与**所在行的布局 ——
 * 它的盒子被拿出文档流，行内其他盒子的排布完全不受它影响，所以它不是「占位的邻居」。
 *
 * 为什么需要它（2026-09-26 用户截图「鼠标移到设置上就错位」）：DSH 的悬停提示
 * （primitives 的 Tooltip）正是这种元素 —— `position:fixed` + 内联 left/top，而且**渲染在
 * 锚点后面**（不是 portal），鼠标一移上去它就成了「那一行里 gear 之外的一个可见孩子」。
 * 没有这条判据，`visibleSiblingOf` 会把它当成认不出的邻居 → 我们当场退回文档流 →
 * 键盘方块跳走、提示落进它腾出来的位置（截图正是这个画面）。
 * 教训与连接指示器那一轮同源：**那一行里的任何动静都先问「它占不占位」** ——
 * 占位的才争地盘，不占位的（提示气泡、悬浮层）理都不该理。
 */
export const isOverlay = (el) => {
  const s = styleOf(el)
  return !!s && (s.position === 'fixed' || s.position === 'absolute')
}

/**
 * 同一行里 `except` 之外的**可见兄弟**（没有则 null）。
 *
 * 判据用**矩形**而不是 class：DSH 的类名是模块哈希（认不得），而这里需要的事实只有一个 ——
 * 「它占不占位」。宽高都 > 1px 才算占位，于是「渲染成空 div」与「压根没渲染」两种实现都覆盖得到；
 * 浮动层（fixed/absolute）不占位，见 `isOverlay`。
 *
 * 还有两类**不算邻居**的孩子，都得显式跳过（否则「邻居」这个词会被结构细节偷换掉）：
 *   * `display:contents` 的元素（`isContents`）—— 槽位出口，没有盒子、不占位。齿轮自己就是
 *     被这样一个出口包着的（见 gearRowOf 的长注释），它当然不是「另一个东西」。
 *   * **包着 `except` 的那条链上的元素** —— 同上，它不是邻居，是齿轮的包装层。
 *     （矩形判据本来也能挡掉其中的 display:contents 那层，但包装层未必只有一层，判清楚更稳。）
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
    if (isContents(el)) continue
    if (el && typeof el.contains === 'function') {
      let wraps = false
      try { wraps = el.contains(except) } catch (e) { wraps = false }
      if (wraps) continue
    }
    if (isOverlay(el)) continue
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
 * `data-micro-conn-hide` 它压根不认识，永远不会碰。
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

// ── 「设置」的悬停提示：改到行上方（2026-09-26，见文件头「鼠标移到设置上」一节）────────
// DSH 的 Tooltip 默认 side:"right"：left = 锚点右缘 + 10px。设置按钮被我们收窄后那个落点
// 在侧边栏里、正好压住键盘方块。用户要的位置是「在设置上面」——提示挪到行上方这件事
// 由 CSS 完成（assets/settings.css 的 [data-micro-gear-tip]），这里只负责**打标记**：
// 给行打 GEAR_ROW_ATTR（它要做提示的定位祖先）、给提示打 GEAR_TIP_ATTR。

/**
 * 找「设置」按钮的悬停提示：primitives 的 Tooltip 把提示渲染成**锚点后面紧挨着的兄弟**。
 * 依据（产物里 primitives 的实现）：
 *   `jsxs(Provider, { children: [cloneElement(锚点, …), portal ? createPortal(气泡, body) : 气泡] })`
 * ——`portal` 没打开时气泡就是**同一个 Fragment 里的下一个兄弟**。设置那颗按钮的 Tooltip
 * 没传 `portal`（见 SettingsRoot 里 `Tooltip({ disabled, label: t("trigger"), children: <button> })`），
 * 所以：**齿轮与提示是同一个槽位出口里的兄弟**（`div[data-slot="settings.launcher"]`，
 * 也就是 `gear.parentElement`，见 gearRowOf 的长注释）。
 *
 * 于是从 `gear.nextElementSibling` 往后找第一个 `[role="tooltip"]` 通常一步就中；
 * 但只认「下一个兄弟」这条链太脆（再多包一层就找不到），所以补一条兜底：在**同一个出口**的
 * 子树里找提示，且排除落在齿轮自己子树里的那些。两条都找不到 = 此刻没悬停（常态，返回 null）。
 * @returns 提示元素，或 null（没悬停时它压根不在 DOM 里 —— 这是常态）。
 */
export const gearTipOf = (gear) => {
  if (!gear) return null
  let el = null
  try { el = gear.nextElementSibling } catch (e) { return null }
  while (el) {
    if (matches(el, '[role="tooltip"]')) return el
    el = el.nextElementSibling
  }
  const outlet = gear.parentElement
  if (!outlet || typeof outlet.querySelectorAll !== 'function') return null
  let found = null
  try {
    found = Array.from(outlet.querySelectorAll('[role="tooltip"]') || [])
      .find((node) => { try { return !gear.contains(node) } catch (e) { return true } }) || null
  } catch (e) { found = null }
  return found
}

/**
 * 给行与提示打标记（每次摆放都调，幂等）：
 *   * 行打 GEAR_ROW_ATTR → CSS 给它 `position:relative`，提示才拿它当包含块。
 *     行取 `gearRowOf(gear)` —— 与「找邻居」用的是**同一个函数**（这里曾经一个用
 *     layoutParent、另一个用 parentElement，于是提示对齐了、邻居却看不见，症状分裂成两半）。
 *     注意别用 `gear.parentElement`：那是 display:contents 的槽位出口，当不了包含块（没有盒子）。
 *   * 行上写 `--micro-gear-tip-left` = 齿轮左端 − 行左端：提示的左缘对齐齿轮。
 *     行若有内边距，`left:0` 会对不齐 —— 量着写，别猜（本项目的一贯做法）。
 *   * 提示此刻在 DOM 里就打 GEAR_TIP_ATTR；不在就只等着 —— 它出现时是 childList 变更，
 *     MutationObserver 会叫醒 place() 再进来打一次。
 * @returns {boolean} 行标记是否写成功。
 */
export const markGearTip = (gear) => {
  const row = gearRowOf(gear)
  if (!row || typeof row.setAttribute !== 'function') return false
  try { row.setAttribute(GEAR_ROW_ATTR, '1') } catch (e) { return false }
  try {
    const rr = row.getBoundingClientRect()
    const gr = gear.getBoundingClientRect()
    const left = rr && gr ? Math.max(0, Math.round(gr.left - rr.left)) : 0
    if (typeof row.style.setProperty === 'function') row.style.setProperty('--micro-gear-tip-left', left + 'px')
    else row.style['--micro-gear-tip-left'] = left + 'px'
  } catch (e) {}
  const tip = gearTipOf(gear)
  if (tip) { try { tip.setAttribute(GEAR_TIP_ATTR, '1') } catch (e) {} }
  return true
}

/**
 * 摘掉行上的标记（退回文档流 / 收起成导轨时）。提示节点是 React 的：
 * 悬停一结束整个被摘掉，GEAR_TIP_ATTR 随节点消失，不用专门清。
 */
export const unmarkGearTip = (gear) => {
  const row = gearRowOf(gear)
  if (!row) return
  try { row.removeAttribute(GEAR_ROW_ATTR) } catch (e) {}
  try {
    if (typeof row.style.removeProperty === 'function') row.style.removeProperty('--micro-gear-tip-left')
    else delete row.style['--micro-gear-tip-left']
  } catch (e) {}
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
        + 'hover 背景可能仍会盖住键盘图标 —— DSH 大概又换了该按钮的布局方式（见 sidebar/action.jsx 头部）')
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
  button.__microGear = hosts.gear

  // 先脱离文档流再量：脱离后 footerActions 会塌成 0 高、设置行上移，量到的才是最终位置。
  button.style.position = 'absolute'
  setClass(button, 'micro-foot-action--pinned', true)
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
  // 「设置」的悬停提示挪到行上方（打标记，CSS 见 assets/settings.css 的 [data-micro-gear-tip]）。
  // 提示是悬停才出现的：此刻不在 DOM 也照样打行标记，等它出现时 MutationObserver 叫醒
  // place() 再补打。收窄没生效/没做都不影响这一步 —— 两件事独立。
  markGearTip(hosts.gear)
  // notice 带出去：组件据此决定气泡显不显示、显示哪一句（null = 没有提示）。
  return { ...pos, notice }
}

/** 退回文档流（收起成导轨时用，也是摆放失败时的兜底），并把设置按钮的宽度还回去。 */
export const unpinFootAction = (button) => {
  if (!button || !button.style) return
  // 退回文档流之后那一行又归 DSH 安排了，不再有重叠风险：把可能被我们藏起来的连接指示器放回去。
  const hosts0 = findFootHosts(button)
  for (const el of noticeCandidates(hosts0 ? gearRowOf(hosts0.gear) : null)) setNoticeHidden(el, false)
  // 行标记也摘掉：提示回 DSH 默认的位置（side:right）——我们不再管那一行，就别再改它的东西。
  unmarkGearTip(button.__microGear || (hosts0 && hosts0.gear))
  setClass(button, 'micro-foot-action--pinned', false)
  for (const k of ['position', 'top', 'right', 'left']) {
    try { button.style[k] = '' } catch (e) {}
  }
  // 宽度也要还回去（我们可能收窄过它，width 与 max-width 两个都写进去过）。优先用摆放时记下的
  // 引用，这样结构已经变了也能恢复；引用留在元素上不清理：它与按钮同生命周期，不会攒住别的东西。
  narrowGear(button.__microGear || (findFootHosts(button) || {}).gear, null)
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
  setClass(tipEl, 'micro-conn-tip', true)
  setClass(tipTextEl, 'micro-conn-tip__text', true)
  setClass(tipTailEl, 'micro-conn-tip__tail', true)
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
  setClass(tip, 'micro-conn-tip--below', below)
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
  if (!button || !notice) { if (tip) setClass(tip, 'micro-conn-tip--on', false); return false }
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
  setClass(tip, 'micro-conn-tip--on', true)
  placeConnTip(tip, button, opts)
  return true
}

/** 收起气泡（卸载 / 收起成导轨 / 找不到提示时）。节点留着复用，只是摘下来。 */
export const disposeConnTip = () => {
  if (!tipEl) return
  setClass(tipEl, 'micro-conn-tip--on', false)
  try {
    const p = tipEl.parentElement
    if (p && typeof p.removeChild === 'function') p.removeChild(tipEl)
  } catch (e) {}
}

/**
 * 把设置弹窗从本分区切到**别的**分区。
 *
 * 用途：「移除键盘」（见 client/device.js）会把设置页里我们那一行藏起来（sidebar.js 的
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

// 浏览器控制台 / 自检的观测点：__dshMicro.openKeyboardSettings() 可直接验证这条链路
// （不用真的去点侧边栏那个图标）；footAction.* 是这条链路的内部零件，给自检与控制台调用。
DSVI.openKeyboardSettings = openKeyboardSettings
DSVI.openGeneralSettings = openGeneralSettings
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
  // `__dshMicro.footAction.tipNode()` 看那颗气泡节点长什么样）。
  notice: connNoticeOf,
  noticePhase: noticePhaseOf,
  hideNotice: setNoticeHidden,
  tipNode: connTipNode,
  placeTip: placeConnTip,
  syncTip: syncConnTip,
  disposeTip: disposeConnTip,
  // 「设置」的悬停提示：找它 / 打标记（挪到行上方的那条线），以及浮动层判据。
  gearTip: gearTipOf,
  markTip: markGearTip,
  unmarkTip: unmarkGearTip,
  isOverlay,
  // 「不生成盒子」的判据（槽位出口就是这种）：邻居判断与 layoutParent 共用它。
  isContents,
  candidateLabels
}

/**
 * 侧边栏底部动作：方形键盘按钮（只有图标，没有文案）。
 * @param props.wide - 侧边栏是否展开（owner props，见 sidebar.footer.action 槽位契约）。
 * @param props.t - 本插件命名空间的翻译函数（注册时声明 locale 由框架注入）。
 */
export function MicroSidebarAction({ wide, t }) {
  const ref = useRef(null)
  const tr = typeof t === 'function' ? t : null
  // locale 那一段没装配成功时 t 可能是空的：退到词典里的中文文案（只做 aria-label / title，
  // 不显示在界面上——这个入口只有图标）。
  const dict = (DSVI && DSVI.locales && DSVI.locales.zh) || {}
  const label = (tr && tr('sidebar.action')) || dict['sidebar.action'] || 'DSH Keypad'

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
          // 我们自己的 data-micro-conn-hide 不在列表里 → 藏/放不会把回调叫醒（不自激）。
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
      if (!ok) warn('没能直接打开键盘设置页，可手动从设置里进入「' + (dict.nav || 'DSH小键盘') + '」')
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
        data-micro-foot="1"
        className={'micro-foot-action' + (wide ? '' : ' micro-foot-action--rail')}
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
            <span className="micro-foot-action__dot" />
          </>
        ) : KeypadIcon(ICON_SIZE)}
      </button>
      {/* 首次连接引导。挂在这里只因为这个槽位在应用外壳里一直在（不像设置页要打开才有），
          而弹窗自己是 `position:fixed` 的整屏遮罩，挂在哪个槽位都盖满视口。
          它只在「设备刚连上 + 还没看过」时渲染出东西，平时是 null，不影响上面那颗按钮的定位。 */}
      <MicroGuideHost t={tr} onOpenSettings={() => { onClick() }} />
    </>
  )
}
