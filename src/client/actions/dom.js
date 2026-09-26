// dsh-omkb · client/src/actions/dom.js
// 【DSH 界面结构的唯一一份理解】—— 判据、定位、高亮、滚动、键盘兜底，全在这里。
//
// 为什么单独一个文件：DSH 的界面结构（哪个节点算「输入区」、谁能聚焦、消息列表在哪个滚动容器里）
// 是一批**互相依赖的启发式**，改动时几乎总是连着改（比如「输入区导航」与「对话滚动」共用同一套
// 「聊天区在哪」的判断）。散在门面类里会和「动作怎么编排」混在一起，两边都读不顺。
// 这里只有**纯函数**：进 DOM、出元素或布尔值，不认识 sessions / ctx / 我们的门面。
//
// 三件容易被下一个人好心改坏的事，写在这儿：
//   ① **文本输入框永远不在导航候选里**（isTextEntry）：composer 的输入框恰是候选表第一位，
//      不剔掉就是「旋钮第一转把焦点吸进输入框」。
//   ② **语音控件也要剔掉**（isVoiceControl）：旋钮停上去再按下 = 开语音，那是误触。
//   ③ **找不到容器就返回空**，绝不回退到整个页面（`focusCollect`）：否则旋钮会满页跑
//      （侧边栏、顶部工具栏全都进候选表）。
//
// 这些纯函数同时喂：门面（./index.js 的导航/滚动）、仅推理（./reasoning.js 的画环）、
// 以及 entry.js 挂到 `__dshOmkb.knobTools` 给控制台与真机探针用 —— 一份判据，四处共用。

/** 元素是否「真的看得见、能点」——所有定位函数的第一步过滤。 */
export const nodeVisible = (el) => {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false
  if (el.disabled === true || el.getAttribute('aria-disabled') === 'true') return false
  const rect = el.getBoundingClientRect()
  if (rect.width < 4 || rect.height < 4) return false
  try {
    const cs = window.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false
  } catch (e) {}
  return true
}

/** `aria-label` + `title` 拼在一起做关键词匹配（别只认一个：两处都可能带文案）。 */
export const labelOf = (el) => {
  try {
    return `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim()
  } catch (e) { return '' }
}

/** 单个可读标签（`aria-label` 优先，退到 `title`）——从里面解析机器可读的值时用它。 */
export const ariaOf = (el) => {
  try { return String(el.getAttribute('aria-label') || el.getAttribute('title') || '') } catch (e) { return '' }
}

// 非文本型的 input（这些不是「输入框」，而是控件，导航要留着）。
const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset', 'image']

/**
 * 是不是「文本输入框」—— 旋钮导航必须跳过。
 * 用户报的 bug：转旋钮会把焦点聚到 composer 输入框。根因就是候选选择器里带着
 * `textarea` / `[contenteditable="true"]` / 文本型 `input`，而输入框恰好是候选表里的
 * 第一个元素 → 第一转就停在它上面（按下还会 el.focus() 把光标塞进去）。
 * 判据只看标签与 contenteditable 属性，不看类名 —— DSH 换皮/换实现都还成立。
 * @returns {boolean} true = 文本输入控件（导航候选里要剔除）
 */
export const isTextEntry = (el) => {
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea') return true
  try { if (el.isContentEditable === true) return true } catch (e) {}
  try { if (el.getAttribute('contenteditable') === 'true') return true } catch (e) {}
  if (tag === 'input') {
    let type = 'text'
    try { type = String(el.getAttribute('type') || 'text').toLowerCase() } catch (e) {}
    return !NON_TEXT_INPUT_TYPES.includes(type)
  }
  return false
}

/** 可聚焦控件的候选选择器（导航与弹窗内控件统计共用）。 */
const KNOB_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
  '[data-action]',
  '[data-testid]',
  '[aria-haspopup]',
  '[aria-label]',
  '[title]'
].join(',')

/** 语音控件：按下会开语音，不该被旋钮误触（导航候选里剔除）。 */
const isVoiceControl = (el) => {
  const cls = typeof el.className === 'string' ? el.className : ''
  if (/\bdsvi-btn\b/.test(cls)) return true
  if (/\bdshv_input\b/.test(cls)) return true
  if (/(voice|mic|record|listen)/i.test(cls)) return true
  let label = ''
  try { label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '') } catch (e) {}
  return /(语音|麦克风|voice|microphone|mic|录制)/i.test(label)
}

// 输入区/编辑器 DOM 启发式：匹配 DSH composer 相关 class。
const composerRootPattern = /(composer|conversation-input|message-input|chat-input|composer-toolbar|input-editor|editor-toolbar|input-toolbar|input-bar)/i
// 一个容器要算作"输入区"，其内部必须含有真实输入字段（编辑器/文本域/麦克风按钮）。
const hasInputField = (el) => {
  try { return el.querySelector('textarea, [contenteditable="true"], .dsvi-btn') !== null } catch (e) { return false }
}

// 定位对话输入/作曲区容器：优先 DSH 数据属性，其次 composer class 启发式（取最内层可见者）。
export const findInputRoot = () => {
  if (typeof document === 'undefined') return null
  for (const sel of ['[data-composer-seat]', '[data-composer-card]']) {
    let el = null
    try { el = document.querySelector(sel) } catch (e) { el = null }
    if (el && nodeVisible(el) && hasInputField(el)) return el
  }
  let best = null
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll('div, main, section, form')) } catch (e) { return best }
  for (const el of nodes) {
    if (el === document.body || el === document.documentElement) continue
    let cls = ''
    try {
      if (typeof el.className === 'string') cls = el.className
      else if (el.classList && el.classList.value) cls = el.classList.value
    } catch (e) { continue }
    if (!composerRootPattern.test(cls)) continue
    if (!nodeVisible(el) || !hasInputField(el)) continue
    if (!best) { best = el; continue }
    if (best.contains(el)) best = el // 取更内层
  }
  return best
}

// 对话/会话主区域 class 与 data 属性：包含消息列表 + 输入区的整块聊天面板。
const chatRootPattern = /(chat|conversation|thread|session|message-list|message_list|chat-view|conversation-main)/i

// 定位"整个聊天区域"：从输入区容器向上扩展到最外层仍属于聊天面板的祖先，
// 使旋钮能选中消息列表与输入区在内的整块对话内容（仍不进入侧栏/顶部）。
export const findChatRoot = () => {
  if (typeof document === 'undefined') return null
  const input = findInputRoot()
  const dataSels = ['[data-chat-root]', '[data-conversation-root]', '[data-thread-root]', '[data-chat-seat]', '[data-conversation-seat]']
  for (const sel of dataSels) {
    let el = null
    try { el = document.querySelector(sel) } catch (e) { el = null }
    if (el && nodeVisible(el)) return el
  }
  // 向上遍历输入区祖先，取最大的仍带聊天标识的容器
  if (input) {
    let cursor = input
    let chat = null
    while (cursor && cursor !== document.body && cursor !== document.documentElement) {
      let cls = ''
      try {
        if (typeof cursor.className === 'string') cls = cursor.className
        else if (cursor.classList && cursor.classList.value) cls = cursor.classList.value
      } catch (e) {}
      if (chatRootPattern.test(cls)) chat = cursor
      cursor = cursor.parentElement
    }
    if (chat) return chat
  }
  // 无聊天标识：退回输入区自身（保留"不进全页"的底线）
  return input
}

// 检测当前是否打开了弹窗/浮层（下拉菜单、命令面板、弹窗等）。
// 有则返回最内层可见的那个，供导航优先聚焦；否则返回 null。
export const findActivePopup = () => {
  if (typeof document === 'undefined') return null
  const POP_ROLE = ['dialog', 'alertdialog', 'menu', 'listbox', 'popover', 'tooltip', 'combobox']
  const POP_SEL = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="popover"]',
    '[role="tooltip"]',
    '[aria-expanded="true"]',
    '[data-popover]',
    '[data-menu]',
    '[data-dropdown]',
    '[data-dialog]',
    '.popover',
    '.dropdown',
    '.tooltip',
    '.modal',
    '.dialog',
    '.ds-modal',
    '.dsh-dialog',
    '[data-root="popper"]'
  ].join(',')
  const isPopupEl = (el) => {
    try {
      const role = el.getAttribute && (el.getAttribute('role') || '')
      if (POP_ROLE.includes(role)) return true
    } catch (e) {}
    let cls = ''
    try {
      if (typeof el.className === 'string') cls = el.className
      else if (el.classList && el.classList.value) cls = el.classList.value
    } catch (e) {}
    return /(popover|dropdown|tooltip|modal|popper|command-palette|context-menu)/i.test(cls)
  }
  // 收集所有可见的弹窗候选，取离输入区/聊天区最近（最内层）的一个
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll(POP_SEL)) } catch (e) { nodes = [] }
  let candidates = nodes.filter((el) => nodeVisible(el) && isPopupEl(el))
  if (!candidates.length) return null
  // 去重：若某弹窗包含另一弹窗，只保留最内层
  candidates = candidates.filter((el) => !candidates.some((o) => o !== el && o.contains(el)))
  // 在多个平级弹窗里，偏好含可聚焦控件较多的
  candidates.sort((a, b) => b.querySelectorAll(KNOB_SELECTOR).length - a.querySelectorAll(KNOB_SELECTOR).length)
  return candidates[0]
}

// 在聊天主区域内收集可聚焦控件；若当前有弹窗/菜单打开则聚焦弹窗内部。
// 找不到容器时返回 []，绝不回退到整个页面。
// 两道过滤：语音控件（按下会开语音，不该被旋钮误触）、文本输入框（会把焦点吸进去）。
// 导出给探针/自检直接量 —— 「输入框有没有被排除」这条判据只许有一份。
export const focusCollect = () => {
  if (typeof document === 'undefined') return []
  const popup = findActivePopup()
  const root = popup || findChatRoot()
  if (!root) return []
  let nodes = []
  try { nodes = Array.from(root.querySelectorAll(KNOB_SELECTOR)) } catch (e) { return [] }
  return nodes.filter((el) => nodeVisible(el) && !isVoiceControl(el) && !isTextEntry(el))
}

// ---- 自绘高亮（「环」）：navigate 与 reasoning 两种模式共用，所以两处视觉天然一致 ----

export const clearHighlight = () => {
  try {
    const prev = document.querySelector('[data-omkb-knob]')
    if (prev) {
      prev.removeAttribute('data-omkb-knob')
      if (prev.__omkbPrevOutline !== undefined) { prev.style.outline = prev.__omkbPrevOutline; delete prev.__omkbPrevOutline }
      if (prev.__omkbPrevShadow !== undefined) { prev.style.boxShadow = prev.__omkbPrevShadow; delete prev.__omkbPrevShadow }
    }
  } catch (e) {}
}

export const highlight = (el) => {
  clearHighlight()
  if (!el) return
  el.setAttribute('data-omkb-knob', '1')
  // 主高亮用内描边（inset box-shadow）：永远在元素内部，不会被弹窗滚动容器裁剪或被旁元素遮挡
  el.__omkbPrevShadow = el.style.boxShadow
  el.style.boxShadow = 'inset 0 0 0 2px #304FFE'
  // outline 仅在能完整显示时辅助（向内，避免被容器边界裁到只剩部分边）
  el.__omkbPrevOutline = el.style.outline
  el.style.outline = '1px solid #304FFE'
  el.style.outlineOffset = '-1px'
  try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch (e) {}
}

// ---- 对话滚动：滚动目标 = 当前会话的消息列表 ----
// 以前只按「全页可滚距离最大」挑容器，会挑错人：侧栏会话列表、别的面板自己的滚动区都可能比
// 消息列表更高。现在先按结构定位会话区（findChatRoot，与「输入区导航」同一套判据），在里面挑
// 可滚距离最大的容器；会话区里没有可滚容器（例如消息还很少）才退回全页。
let scrollCache = null

const pickScrollable = (root) => {
  if (!root || typeof root.querySelectorAll !== 'function') return null
  let nodes = []
  try { nodes = Array.from(root.querySelectorAll('div, main, section, ul, ol, article')) } catch (e) { return null }
  let best = null
  let bestDiff = 0
  for (const el of nodes) {
    const diff = el.scrollHeight - el.clientHeight
    if (diff < 40 || diff <= bestDiff) continue
    let oy = ''
    try { oy = window.getComputedStyle(el).overflowY } catch (e) {}
    if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue
    best = el
    bestDiff = diff
  }
  return best
}

/** 当前会话区的滚动容器（带缓存）。导出给入口/探针复用量同一套判据，别在探针里再写一份。 */
export const findScrollContainer = () => {
  if (typeof document === 'undefined') return null
  if (scrollCache && document.contains(scrollCache)) return scrollCache
  scrollCache = pickScrollable(findChatRoot()) || pickScrollable(document)
  return scrollCache
}

/** 一步的滚动量：按容器高度自适应（大窗口里 140px 显得像没动）。 */
export const scrollStepSize = (clientHeight) => Math.max(90, Math.round((clientHeight || 600) * 0.22))

/** 滚一步（dir < 0 向上）。 */
export const scrollStepDir = (dir) => {
  const el = findScrollContainer() || (typeof document !== 'undefined' ? (document.scrollingElement || document.documentElement) : null)
  if (!el) return false
  const step = scrollStepSize(el.clientHeight)
  try { el.scrollTop = (el.scrollTop || 0) + (dir >= 0 ? step : -step); return true } catch (e) { return false }
}

/** 直接滚到底（旋钮 scroll 模式按下、摇杆「滚动到底部」都用它）。 */
export const scrollToBottomDir = () => {
  const el = findScrollContainer() || (typeof document !== 'undefined' ? (document.scrollingElement || document.documentElement) : null)
  if (!el) return false
  try { el.scrollTop = el.scrollHeight; return true } catch (e) { return false }
}

// ---- 界面开关的定位（只在服务拿不到时的兜底路径使用）----

/** 规划模式 chip：只在规划模式开着时渲染（aria-label 形如「plan mode 已开启，按下关闭」）。 */
const PLAN_CHIP_RE = /plan\s*mode\s*(已开启|on)|plan.*(按下关闭|press to turn off)/i
export const planChipEl = () => {
  if (typeof document === 'undefined') return null
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll('[aria-label],[title]')) } catch (e) { return null }
  for (const el of nodes) {
    if (PLAN_CHIP_RE.test(labelOf(el)) && nodeVisible(el)) return el
  }
  return null
}

/** 侧边栏开关按钮：只认真实控件（button/[role=button]）上的 aria-label/title，避免点到正文。 */
const SIDEBAR_RE = /sidebar|侧边栏|侧栏|展开.*栏|收起.*栏/i
export const sidebarToggleEl = () => {
  if (typeof document === 'undefined') return null
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll('button,[role="button"]')) } catch (e) { return null }
  for (const el of nodes) {
    if (SIDEBAR_RE.test(labelOf(el)) && nodeVisible(el)) return el
  }
  return null
}

/** composer 输入框：优先当前聚焦的那个，其次取最后一个可见 textarea。 */
export const composerTextarea = () => {
  if (typeof document === 'undefined') return null
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll('textarea')) } catch (e) { return null }
  const visible = nodes.filter(nodeVisible)
  const active = typeof document.activeElement !== 'undefined' ? document.activeElement : null
  if (active && visible.includes(active)) return active
  return visible.length ? visible[visible.length - 1] : null
}

// ---- 官方语音输入（@deepseek-ai/dsh-experimental-voice-input-bundle）----
//
// DSH 官方那个**可选** Bundle 启用后，会把麦克风注册到 `conversation.input.activity` 槽位，
// 而 renderer 给每个槽位出口打 `data-slot` 锚点（与 `[data-slot="sidebar.settings"]` 同一契约）。
// 本插件不重造识别链路，而是**桥接**它：按下我们的语音键 = 点一下官方那颗麦克风。
// 这里的判据全部读自官方产物（`npm pack @deepseek-ai/dsh-experimental-client-ui-voice-input`）。
//
// 官方控件的两个形态：
//   * 折叠态 —— 出口里**只有一个** button，就是麦克风（`aria-label` = 本 locale 的 `t("start")`，
//       中文「开始录音」/ 英文「Start recording」）。它的 `disabled = !usable`，而 usable 是官方按
//       `readiness.connected && provider.preparation.phase ∈ {ready,standby,waking}` 算的 ——
//       也就是「本地模型还没下载并准备完」时它就是灰的。
//   * 录音态 —— 折叠态整个换成一个 `<div data-voice-activity={phase}>`，里面有「取消」和
//       「停止并识别」（`aria-label` = `t("stop")`）。**停止按钮只在 phase === 'recording' 时存在**：
//       请求麦克风权限（requesting）与转写（transcribing）阶段都没有它。
//
// 判据优先级（**别猜 CSS module 的哈希 class**：官方产物里是 `ddpbLW_trigger` 这种，hash 随构建变）：
//   ① `data-voice-activity` —— 官方自己声明的阶段，语言无关，最稳；
//   ② `data-slot="conversation.input.activity"` —— 只在这个槽位出口里找，不整页乱找；
//   ③ 文案（中/英）+ 结构（折叠态唯一一颗 / recording 态最后一颗）兜底。
//
// 找不到一律**如实返回 null / false**：Bundle 未启用时这个出口可能根本不存在，
// 由调用方（voice.js）决定降级到浏览器 Web Speech —— 判据不许在这里假装成功。

/** 官方语音输入的槽位出口（Bundle 未启用 / 官方 UI 还没挂上时为 null）。 */
export const OFFICIAL_VOICE_OUTLET_SEL = '[data-slot="conversation.input.activity"]'

/** 槽位出口元素本身；找不到返回 null。 */
export const officialVoiceOutlet = () => {
  if (typeof document === 'undefined') return null
  try { return document.querySelector(OFFICIAL_VOICE_OUTLET_SEL) } catch (e) { return null }
}

/**
 * 官方录音栏当前阶段；**折叠态（未录音）返回 null**（那时那个 div 根本没渲染）。
 * 取值就是官方自己写在 `data-voice-activity` 上的东西：requesting / recording / transcribing / feedback。
 * @returns {string|null}
 */
export const officialVoicePhase = () => {
  const outlet = officialVoiceOutlet()
  if (!outlet) return null
  let row = null
  try { row = outlet.querySelector('[data-voice-activity]') } catch (e) { return null }
  if (!row) return null
  try { return row.getAttribute('data-voice-activity') || null } catch (e) { return null }
}

/** 出口里的按钮（数组；拿不到给空数组）。 */
const officialVoiceButtons = (outlet) => {
  try { return Array.from(outlet.querySelectorAll('button')) } catch (e) { return [] }
}

// 官方 aria-label 的两套文案（DSH 界面语言目前是中/英；其余语言由下面的结构判据兜底）。
const VOICE_START_RE = /^(开始录音|开始听写|start recording)$/i
const VOICE_STOP_RE = /^(停止并识别|停止转写|stop and transcribe)$/i

/**
 * 官方那颗麦克风按钮（折叠态的「开始录音」）。找不到返回 null。
 * 结构优先：折叠态出口里**只有它一颗**；文案与 class 后缀（`_trigger`）只作交叉确认。
 * 录音态 / 转写态下没有这颗按钮，**会如实返回 null**（别拿它当「官方还在不在」的判据）。
 */
export const officialVoiceStartButton = () => {
  const outlet = officialVoiceOutlet()
  if (!outlet) return null
  const btns = officialVoiceButtons(outlet)
  if (!btns.length) return null
  const byLabel = btns.find((b) => VOICE_START_RE.test(ariaOf(b)))
  if (byLabel) return byLabel
  if (btns.length === 1) return btns[0]
  return btns.find((b) => {
    const cls = typeof b.className === 'string' ? b.className : ''
    return /_trigger\b/.test(cls)
  }) || null
}

/**
 * 官方那颗「停止并识别」按钮。**只在 recording 阶段能拿到**（请求权限 / 转写中都没有），
 * 所以返回 null 不代表出错 —— 调用方要么等它出现，要么这次就没有可点的停止。
 */
export const officialVoiceStopButton = () => {
  if (officialVoicePhase() !== 'recording') return null
  const outlet = officialVoiceOutlet()
  if (!outlet) return null
  const btns = officialVoiceButtons(outlet)
  if (!btns.length) return null
  const byLabel = btns.find((b) => VOICE_STOP_RE.test(ariaOf(b)))
  if (byLabel) return byLabel
  // 结构兜底：recording 阶段出口里是 [取消, 波形, 停止]，最后一颗就是停止。
  return btns[btns.length - 1]
}

/**
 * 官方语音此刻**能不能用**：出口在 + 麦克风按钮在 + 没被禁用。
 * 「按钮灰着」在官方那边就等于「模型还没准备好」，对用户而言同样是「没开启」，
 * 所以这里一并算作不可用 —— 让 voice.js 顶上，比让按键按下去没反应强。
 */
export const officialVoiceReady = () => {
  const btn = officialVoiceStartButton()
  if (!btn) return false
  try {
    if (btn.disabled === true) return false
    if (btn.getAttribute('aria-disabled') === 'true') return false
  } catch (e) { return false }
  return true
}

/** 点一下官方麦克风开始录音。真点到了返回 true（权限、录音、转写全归官方管）。 */
export const clickOfficialVoiceStart = () => {
  if (!officialVoiceReady()) return false
  const btn = officialVoiceStartButton()
  if (!btn) return false
  try { btn.click(); return true } catch (e) { return false }
}

/** 点一下官方「停止并识别」。**只在 recording 阶段点得到**；其余阶段返回 false（由调用方等）。 */
export const clickOfficialVoiceStop = () => {
  const btn = officialVoiceStopButton()
  if (!btn) return false
  try { btn.click(); return true } catch (e) { return false }
}

// ---- 待确认交互的面板（审批 / 计划确认）：只在「服务拿不到」时当兜底 ----

/**
 * 审批面板 / 计划确认面板上的按钮，**按界面顺序**返回（拒绝 / 拒绝执行在左，
 * 允许一次 / 确认执行在右 —— 两个面板都是这个顺序，见 dsh-client-ui-approval 的
 * ApprovalPanel 与 dsh-client-ui-user-questions 的 PlanReviewPanel）。
 *
 * 认面板**只认面板自己的身份标记**（`data-approval-key` / `data-plan-review-key`）：
 * 这两个属性是 DSH 给面板写的（用于 one-shot 重挂载），比文案稳 —— 文案会跟着语言变，
 * class 会跟着版本变。找不到就返回空数组，调用方如实报「拿不到」。
 * @returns {Element[]} 按钮（可能为空）；顺序即界面顺序。
 */
export const interactionPanelButtons = () => {
  if (typeof document === 'undefined') return []
  for (const sel of ['[data-approval-key]', '[data-plan-review-key]']) {
    let card = null
    try { card = document.querySelector(sel) } catch (e) { card = null }
    if (!card) continue
    let btns = []
    try { btns = Array.from(card.querySelectorAll('button')) } catch (e) { btns = [] }
    if (btns.length) return btns
  }
  return []
}

// ---- 键盘事件兜底：服务 / 输入机全都拿不到时的最后一条路 ----

/**
 * 向某个元素派发一次 Enter（发送的最后兜底）。
 * 只认「当前聚焦元素」：DSH 的 composer 就是从键盘路径收下这一下的。
 */
export const dispatchEnter = (target) => {
  if (typeof document === 'undefined' || typeof KeyboardEvent === 'undefined') return false
  const el = target || document.activeElement
  if (!el || typeof el.dispatchEvent !== 'function') return false
  const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }
  try { el.dispatchEvent(new KeyboardEvent('keydown', opts)); return true } catch (e) { return false }
}

/** 兜底：在 composer 输入框上派发 ⌘Z / ⌘⇧Z（DSH 的输入机就是从这条键盘路径进来的）。 */
export const dispatchUndoChord = (shift) => {
  if (typeof document === 'undefined' || typeof KeyboardEvent === 'undefined') return false
  const el = composerTextarea()
  if (!el) return false
  const opts = {
    key: shift ? 'Z' : 'z',
    code: 'KeyZ',
    keyCode: 90,
    which: 90,
    metaKey: true,
    shiftKey: !!shift,
    bubbles: true,
    cancelable: true
  }
  try { el.dispatchEvent(new KeyboardEvent('keydown', opts)); return true } catch (e) { return false }
}
