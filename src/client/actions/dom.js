// dsh-micro · client/src/actions/dom.js
// 【DSH 界面结构的唯一一份理解】—— 判据、定位、高亮、滚动、键盘兜底，全在这里。
//
// 为什么单独一个文件：DSH 的界面结构（哪个节点算「输入区」、谁能聚焦、消息列表在哪个滚动容器里）
// 是一批**互相依赖的启发式**，改动时几乎总是连着改（比如「输入区导航」与「对话滚动」共用同一套
// 「聊天区在哪」的判断）。散在门面类里会和「动作怎么编排」混在一起，两边都读不顺。
// 这里只有**纯函数**：进 DOM、出元素或布尔值，不认识 sessions / ctx / 我们的门面。
//
// 四件容易被下一个人好心改坏的事，写在这儿：
//   ① **文本输入框永远不在导航候选里**（isTextEntry）：composer 的输入框恰是候选表第一位，
//      不剔掉就是「旋钮第一转把焦点吸进输入框」。
//   ② **语音控件也要剔掉**（isVoiceControl）：旋钮停上去再按下 = 开语音，那是误触。
//   ③ **找不到容器就返回空**，绝不回退到整个页面（`focusCollect`）：否则旋钮会满页跑
//      （侧边栏、顶部工具栏全都进候选表）。
//   ④ **待确认弹窗要靠「文案成对」认出来**（`interactionPanelRoot`）：它常常不是 `role=dialog`
//      也没有 `data-approval-key` —— 只认这些标记的话，弹窗弹出来了旋钮还在聊天区里转、
//      「批准/拒绝」两颗键也找不到按钮（用户 2026-09-28 报的就是这个）。
//      代价是判定放宽了，所以配了两条反例：**不成对不算**（普通弹窗的保存/取消）、
//      **不在同一张卡片里不算**（页面上恰好各有一组时宁可不做）。
//
// 这些纯函数同时喂：门面（./index.js 的导航/滚动）、仅推理（./reasoning.js 的画环）、
// 以及 entry.js 挂到 `__dshMicro.knobTools` 给控制台与真机探针用 —— 一份判据，四处共用。

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
// 旋钮的候选控件。⚠ `[role="radio"|"checkbox"|"option"|"menuitem"|"tab"|"switch"]` 是
// 2026-09-28 补的：弹窗里的**选项**常常不是原生 button 而是这几个 role，
// 少了它们旋钮就落不到选项上（用户要的「有选项就转旋钮选、按下勾」就做不到）。
const KNOB_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="tab"]',
  '[role="switch"]',
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
//
// 容器优先级（2026-09-28 起）：**待确认面板 → 一般弹窗 → 聊天区**。
// 待确认面板排最前，是因为它常常不是 `role=dialog`（DSH 的审批卡片就是一张普通卡片），
// 排后面就等于「弹窗弹出来了，旋钮还在聊天区里转」——用户要的「有选项就转旋钮选、按下勾」
// 正是被这一条挡住。代价是每次转旋钮多一次全页按钮扫描（几十微秒，120ms 一转，可忽略）。
export const focusCollect = () => {
  if (typeof document === 'undefined') return []
  const root = interactionPanelRoot() || findActivePopup() || findChatRoot()
  if (!root) return []
  let nodes = []
  try { nodes = Array.from(root.querySelectorAll(KNOB_SELECTOR)) } catch (e) { return [] }
  return nodes.filter((el) => nodeVisible(el) && !isVoiceControl(el) && !isTextEntry(el))
}

// ---- 自绘高亮（「环」）：navigate 与 reasoning 两种模式共用，所以两处视觉天然一致 ----

export const clearHighlight = () => {
  try {
    const prev = document.querySelector('[data-micro-knob]')
    if (prev) {
      prev.removeAttribute('data-micro-knob')
      if (prev.__microPrevOutline !== undefined) { prev.style.outline = prev.__microPrevOutline; delete prev.__microPrevOutline }
      if (prev.__microPrevShadow !== undefined) { prev.style.boxShadow = prev.__microPrevShadow; delete prev.__microPrevShadow }
    }
  } catch (e) {}
}

export const highlight = (el) => {
  clearHighlight()
  if (!el) return
  el.setAttribute('data-micro-knob', '1')
  // 主高亮用内描边（inset box-shadow）：永远在元素内部，不会被弹窗滚动容器裁剪或被旁元素遮挡
  el.__microPrevShadow = el.style.boxShadow
  el.style.boxShadow = 'inset 0 0 0 2px #304FFE'
  // outline 仅在能完整显示时辅助（向内，避免被容器边界裁到只剩部分边）
  el.__microPrevOutline = el.style.outline
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

// ---- composer 的原生文件选择框（「上传」键）----
//
// DSH 的输入栏里挂着一个**一直存在**的原生文件选择框（dsh-client-ui-conversation 的 InputBar）：
//   <input ref={fileInputRef} type="file" multiple hidden onChange={onPickFiles} />
// 就在「+」按钮旁边的 `left` 那一行里，与 `conversation.input.left` 槽位并列。
// DSH 自己的「+ → 文件」走的就是 `fileInputRef.current?.click()` —— 这里照抄同一条路。
// **为什么不走服务面**：conversation 的输入机上只有 `addAttachments(ids)`，收的是**已经上传完**的
// 附件 id；「弹出选择框、上传、拿回 id」这一段没有对外服务，只有这颗粒 DOM 能触发。
//
// ⚠ 它带 `hidden`（`display:none`），所以**绝不能用 nodeVisible 过滤** —— 那会把唯一的候选筛掉，
//   表现就是「上传键按下去没反应」。同理 `showPicker()` 也不适用（规范要求元素处于渲染态）。
// ⚠ 认据按**结构**（type=file / multiple / 有没有被禁用）打分，不认 class：官方那几个 class 带
//   构建期 hash（`InputBar_module_css_default.add` 这种），换版本就变。

/** 给候选打分：DSH 那个是 `multiple + hidden + 没禁用`，别的文件框通常不满足。 */
const fileInputScore = (el) => {
  let s = 0
  try {
    if (el.multiple === true) s += 2
    if (el.disabled === true) s -= 4
    if (el.hidden === true || el.getAttribute('hidden') !== null) s += 1
  } catch (e) {}
  return s
}

/**
 * composer 里的原生文件选择框；找不到返回 null。
 * 先在整个输入区（findInputRoot）里找，找不到再放宽到整页（DSH 把输入栏拆进 portal 时仍能找到）。
 * 候选里带 `disabled` 的一律不要 —— 官方在「当前是子代理会话」时就是 `disabled: subagent !== null`。
 */
export const composerFileInput = () => {
  if (typeof document === 'undefined') return null
  const within = (scope) => {
    try { return Array.from(scope.querySelectorAll('input[type="file"]')) } catch (e) { return [] }
  }
  const root = findInputRoot()
  let nodes = root ? within(root) : []
  if (!nodes.length) nodes = within(document)
  let best = null
  for (const el of nodes) {
    try { if (el.disabled === true) continue } catch (e) {}
    if (!best || fileInputScore(el) > fileInputScore(best)) best = el
  }
  return best
}

/**
 * 点一下那个文件选择框（弹出系统的文件选择框，选完由 DSH 自己上传并挂到当前输入）。
 * 与 `clickOfficialVoiceStart` 同一条姿态：真点到了返回 true。
 * ⚠ 这里**无法确认用户有没有真选文件**（原生选择框的取消没有事件给我们），所以 true 只代表
 * 「选择框弹出来了」—— 选了才算数，这不是失败。
 * @returns {boolean} 是否真的点到了那个输入框。
 */
export const clickComposerFileInput = () => {
  const el = composerFileInput()
  if (!el) return false
  try { el.click(); return true } catch (e) { return false }
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

// ---- 待确认交互的面板（审批 / 计划确认 / 多步确认）：服务拿不到时的兜底 ----
//
// 2026-09-28 用户报：「批准和拒绝按键功能没法用」——弹窗明明弹出来了，按下去没反应。
// 根因是这里**只认面板的身份标记**（`data-approval-key` / `data-plan-review-key`）：那两个属性
// 是 DSH 给自己的面板写的 one-shot 重挂载 key，面板换个实现/换个组件库就没了，于是我们
// 「找不到面板 → 静默返回 false」。属性是**实现**、文案是**语义**，语义比实现稳 ——
// 现在先认属性（最快最准），认不到就按**按钮文案**找，两层都落空才如实报账。

/**
 * 面板按钮的语义词表（中英各一组）。批准 = 「往前走」、拒绝 = 「不走了」。
 *
 * ⚠ 刻意**不收**「确定 / 保存 / 取消」：那是普通设置弹窗的按钮，收进来会把「按批准键」
 * 变成「把设置保存了」。DSH 的审批面板打的是「允许一次 / 拒绝」，计划确认打的是
 * 「确认执行 / 拒绝」，多步确认打的是「下一步 / 跳过」—— 都在表里。
 */
export const PANEL_APPROVE_WORDS = [
  '批准', '允许', '同意', '确认', '继续', '下一步', '执行', '是',
  'approve', 'allow', 'accept', 'confirm', 'continue', 'next', 'run', 'yes'
]
export const PANEL_REJECT_WORDS = [
  '跳过', '拒绝', '不允许', '否', '不',
  'skip', 'reject', 'deny', 'decline', 'no'
]
/**
 * 太短、只能**整词相等**的词：`是否` 里既有「是」又有「否」，`不允许` 里也有「不允许」和「允许」，
 * 用包含匹配会到处误命中（于是判成「既有批准又有拒绝」→ 反而认不出来）。
 * 这些词必须是按钮**整条文字**才作数。
 */
const PANEL_EXACT_ONLY = new Set(['是', '否', '不', 'yes', 'no'])
/** 按钮文字长度上限：超过它多半是整块说明文字，不是按钮。 */
const PANEL_TEXT_MAX = 40

/**
 * **纯判据**：一段按钮文字 → 它是什么意思。只吃字符串，不碰 DOM（自检能直接喂词试）。
 * 两边都不命中返回 null —— 那表示「这段文字不表态」，由调用方退到位置兜底。
 *
 * ⚠ **否定优先**：同时沾两边的词按「拒绝」算。这不是随手定的，是词表本身的性质：
 * 「拒绝执行」含「拒绝」也含「执行」、「不允许」含「不允许」也含「允许」——
 * 语义上否定词更具体（说了「不」就是「不」），所以先判拒绝、
 * 命中就不再往批准那边看。反过来判会让「拒绝执行」变成歧义而不表态。
 * @param {string} text - 按钮的可见文字 + aria-label + title 拼起来的那串。
 * @returns {'approve'|'reject'|null}
 */
export const panelAnswerOf = (text) => {
  const t = String(text == null ? '' : text).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!t || t.length > PANEL_TEXT_MAX) return null
  const hit = (words) => words.some((w) => (PANEL_EXACT_ONLY.has(w) ? t === w : t.includes(w)))
  if (hit(PANEL_REJECT_WORDS)) return 'reject'
  if (hit(PANEL_APPROVE_WORDS)) return 'approve'
  return null
}

/** 按钮的全部可读文字（可见文字 + aria-label + title）。读不到就是空串，绝不抛。 */
const buttonTextOf = (el) => {
  let visible = ''
  try { visible = String((el && el.textContent) || '') } catch (e) { visible = '' }
  return `${visible} ${labelOf(el)}`.trim()
}

/** `document.querySelectorAll` 的安全版（自检的假 DOM 可能只有 querySelector）。 */
const allOf = (sel) => {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return []
  try { return Array.from(document.querySelectorAll(sel)) } catch (e) { return [] }
}

/** 可见性判定的安全版：拿不到布局信息时**当作可见**（假 DOM / 量不到 rect 时别把面板判没）。 */
const safeVisible = (el) => {
  try { return nodeVisible(el) } catch (e) { return true }
}

/** 朴素最近公共祖先：把 a 的祖先链放进集合，再从 b 往上找第一个命中的。 */
const commonAncestor = (a, b) => {
  if (!a || !b) return null
  const chain = new Set()
  for (let n = a; n; n = n.parentElement) chain.add(n)
  for (let n = b; n; n = n.parentElement) if (chain.has(n)) return n
  return null
}

/**
 * 当前挂着的**待确认面板**的根节点 —— 也就是「批准 / 跳过」这类按钮所在的那张卡片。
 *
 * 两道判据**缺一不可**：
 *   ① 面板里必须**同时**有批准词按钮和拒绝词按钮 —— 所以普通设置弹窗（保存 / 取消，
 *      一个词都不在表里）永远认不出来，按批准键不会去点别人的「保存」；
 *   ② 这两个按钮得在**同一个容器**里（最近公共祖先不是 body/html）—— 页面上恰好
 *      有两组这类按钮时宁可不认，也不猜。
 * @returns {Element|null}
 */
export const interactionPanelRoot = () => {
  if (typeof document === 'undefined') return null
  for (const sel of ['[data-approval-key]', '[data-plan-review-key]']) {
    const card = (() => { try { return document.querySelector(sel) } catch (e) { return null } })()
    if (card) return card
  }
  const btns = allOf('button, [role="button"]').filter(safeVisible)
  if (!btns.length) return null
  const yes = btns.filter((b) => panelAnswerOf(buttonTextOf(b)) === 'approve')
  const no = btns.filter((b) => panelAnswerOf(buttonTextOf(b)) === 'reject')
  if (!yes.length || !no.length) return null
  // 取界面上最靠后的那一对（新弹窗总在 DOM 末尾），再往上找它们共同的卡片。
  const root = commonAncestor(yes[yes.length - 1], no[no.length - 1])
  if (!root) return null
  try {
    const tag = String(root.tagName || '').toLowerCase()
    if (tag === 'body' || tag === 'html') return null // 不成卡片 → 不认，别乱点
  } catch (e) {}
  return root
}

/**
 * 审批面板 / 计划确认面板上的按钮，**按界面顺序**返回（拒绝 / 跳过在左，允许 / 确认 /
 * 下一步在右 —— 两个面板都是这个顺序，见 dsh-client-ui-approval 的 ApprovalPanel
 * 与 dsh-client-ui-user-questions 的 PlanReviewPanel）。
 *
 * 认面板的方法见 interactionPanelRoot（属性 → 文案成对）。找不到就返回空数组，
 * 调用方如实报「拿不到」。
 * @returns {Element[]} 按钮（可能为空）；顺序即界面顺序。
 */
export const interactionPanelButtons = () => {
  const root = interactionPanelRoot()
  if (!root) return []
  let btns = []
  try { btns = Array.from(root.querySelectorAll('button')) } catch (e) { btns = [] }
  if (!btns.length) {
    // 有的面板把选项做成 [role="button"] 而不是原生 button。
    try { btns = Array.from(root.querySelectorAll('button, [role="button"]')) } catch (e) { btns = [] }
  }
  return btns
}

/**
 * 面板上「批准 / 拒绝」该按哪一个。
 *
 * 先按**文案**挑（这才是这两颗键的语义：「批准为批准或者下一步，拒绝为跳过」）；
 * 文案认不出来（英文界面、图标按钮、文案换了）才退回**位置**：
 * 批准 = 最后一个、拒绝 = 第一个（界面顺序恒为「否定在左、肯定在右」）。
 *
 * 命中多个批准词时取**最左**那个：审批面板可能有「允许一次」和「一直允许」两颗，
 * 最左的那颗权限最小 —— 拿不准就选保守的那个。
 * @param {Element[]} buttons - 界面顺序的按钮。
 * @param {boolean} approve - true = 批准，false = 拒绝。
 * @returns {Element|null}
 */
export const pickPanelButton = (buttons, approve) => {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : []
  if (!list.length) return null
  const want = approve ? 'approve' : 'reject'
  const hit = list.filter((b) => panelAnswerOf(buttonTextOf(b)) === want)
  if (hit.length) return hit[0]
  return approve ? list[list.length - 1] : list[0]
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
