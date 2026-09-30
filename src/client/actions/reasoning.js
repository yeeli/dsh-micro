// dsh-micro · client/src/actions/reasoning.js
// 【仅推理】：把旋钮的旋转/按下翻译成「模型推理等级菜单」上的操作。
//
// 实机结构（`npm run probe -- test/probes/reasoning-levels.mjs` 量到的）：
//   trigger  `button[aria-haspopup="menu"]`，aria-label =「选择模型，当前 <模型>，推理等级 High」
//            —— 模型与推理等级**共用一个按钮**，没有独立的「推理等级」按钮；
//            label 里那句「推理等级 X」正好是当前档的机器可读来源。
//   → 点开第一层 `[role="menu"]`：两行 `[role="menuitem"]`（「模型…」/「推理等级…」）
//   → 点「推理等级」行 → 菜单换成等级列表：`[role="menuitemradio"]`（Off / Low / High / Max），
//     当前档 `aria-checked="true"`。
//
// 交互契约（用户定的，别再改回去）：
//   旋转 —— 菜单**关着**时，这一转只负责把等级菜单**打开**，并把蓝环落在**当前档**上（不动档）；
//           菜单**开着**时，蓝环上/下移一档。**转动本身不提交**，用户先看清自己在选哪一档。
//   按下 —— 环停在别的档上 → 提交那一档；环就在当前档上（或认不出来）→ 只是把菜单收起。
//   长按 —— 无。
//
// 为什么不是「转一档 = 点一下立刻生效」：实测 DSH 点一档会把整个菜单收起，只能靠「点完重开」
// 维持可见 → 菜单一闪一闪；而且用户给的截图就是「环在 Low、勾仍在 Max」这个**待确认**状态
// （见 probe -- test/probes/reasoning-ring.mjs 量的键盘态）。
//
// 为什么不用 DSH 自己的键盘焦点当光标：
//   ① 它的焦点样式是**灰底**（`._7KE1Ra_option:focus-visible{background:…bg-hover}`），
//      不是用户要的蓝环；蓝环就是 ./dom.js 的 highlight()（inset 2px + outline 1px #304FFE）。
//   ② 它的内部光标位置会跨次开合残留 —— 同一段探针脚本两次跑，箭头的落点分别是 High / Max，
//      起点不可预测。改成「自己画环 + 按下才 click」，位置就完全由我们定死。
// 全程只认真实 DOM 语义（role / aria），不猜 DSH 的哈希类名——菜单换皮也不会失效。
import { nodeVisible, ariaOf, highlight, clearHighlight } from './dom.js'

const LEVEL_ROW_SEL = '[role="menuitemradio"]'
const MENU_ROW_SEL = '[role="menuitem"]'
const MENU_SEL = '[role="menu"]'
const TRIGGER_SEL = 'button[aria-haspopup="menu"]'
const REASONING_KW = /(推理等级|推理强度|推理|reasoning)/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 等到 fn 返回真值（React 提交是异步的，点完要等渲染）。 */
const until = async (fn, budgetMs = 800, stepMs = 20) => {
  const end = Date.now() + budgetMs
  for (;;) {
    let v = null
    try { v = fn() } catch (e) {}
    if (v) return v
    if (Date.now() >= end) return null
    await sleep(stepMs)
  }
}

/** 等级列表的每一档（可见的 menuitemradio）。 */
export const levelRows = () => {
  if (typeof document === 'undefined') return []
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll(LEVEL_ROW_SEL)) } catch (e) { return [] }
  return nodes.filter(nodeVisible)
}

/**
 * 从 trigger 的 aria-label 里解析当前等级名。
 * 实机：「选择模型，当前 DeepSeek-V4-Flash，推理等级 High」→ 'High'。
 * 用途：万一级菜单没标 aria-checked，还能靠它认出当前档（旋转才知道往哪边切）。
 */
export const parseLevelFromLabel = (label) => {
  const m = /(?:推理等级|推理强度|推理|reasoning(?:\s*effort|\s*level)?)\s*[：:]?\s*([A-Za-z][A-Za-z0-9_-]*)/i.exec(String(label || ''))
  return m ? m[1] : null
}

/** 「模型 / 推理等级」触发按钮：先认 label 里带「推理」的，再退到带「模型」的。 */
export const findReasoningTrigger = () => {
  if (typeof document === 'undefined') return null
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll(TRIGGER_SEL)) } catch (e) { return null }
  const vis = nodes.filter(nodeVisible)
  return vis.find((el) => /推理|reasoning/i.test(ariaOf(el)))
    || vis.find((el) => /选择模型|模型|model/i.test(ariaOf(el)))
    || null
}

const menuOpen = () => {
  try { return Array.from(document.querySelectorAll(MENU_SEL)).some(nodeVisible) } catch (e) { return false }
}

/** 第一层菜单里「推理等级」那一行。 */
const findLevelEntryRow = () => {
  let nodes = []
  try { nodes = Array.from(document.querySelectorAll(MENU_ROW_SEL)) } catch (e) { return null }
  return nodes.filter(nodeVisible).find((el) => REASONING_KW.test(String(el.textContent || ''))) || null
}

/**
 * 直接打开等级列表：点 trigger → 点「推理等级」行。
 * @returns {Promise<boolean>} 等级列表是否已打开。
 */
export const openReasoningLevels = async () => {
  if (levelRows().length) return true
  const trig = findReasoningTrigger()
  if (!trig) return false
  if (!menuOpen()) {
    try { trig.click() } catch (e) { return false }
    const shown = await until(() => menuOpen() && (levelRows().length > 0 || findLevelEntryRow()), 700)
    if (!shown) return false
  }
  if (levelRows().length) return true
  const row = findLevelEntryRow()
  if (!row) return false
  try { row.click() } catch (e) { return false }
  return (await until(() => levelRows().length > 0, 800)) !== null
}

/** 收起菜单：再点一次 trigger（实机是 toggle，能关掉整层菜单）。 */
export const closeReasoningLevels = () => {
  const trig = findReasoningTrigger()
  if (!trig) return false
  try { trig.click(); return true } catch (e) { return false }
}

/**
 * 当前档的下标：优先 `aria-checked="true"`；没有就靠 trigger 的 aria-label 里的等级名比对文本。
 * @returns {number} 下标，认不出来时 -1。
 */
export const currentLevelIndex = (rows) => {
  const list = rows || levelRows()
  if (!list.length) return -1
  const at = list.findIndex((el) => {
    try { return el.getAttribute('aria-checked') === 'true' } catch (e) { return false }
  })
  if (at !== -1) return at
  const name = parseLevelFromLabel(ariaOf(findReasoningTrigger()))
  if (!name) return -1
  return list.findIndex((el) => String(el.textContent || '').trim().toLowerCase() === name.toLowerCase())
}

// ---- 环（高亮光标）：就是 ./dom.js 的 highlight()，所以与 navigate 模式的视觉完全一致 ----
let ringRow = null   // 环当前画的元素（列表被 React 重建后会失效，靠下面的下标兜底）
let ringAt = -1      // 环当前的下标

/** 清掉环并忘掉位置。 */
const ringClear = () => { ringRow = null; ringAt = -1; clearHighlight() }

/**
 * 只忘掉位置、不动 DOM —— 菜单一关，环的「第几档」就作废了：
 * 下次重新打开必须从**当前生效档**重新起环，而不是接着上次的下标
 * （否则关掉菜单再打开，环会停在上次的档上，起点就不确定了）。
 */
const ringForget = () => { ringRow = null; ringAt = -1 }

/**
 * 环当前该在哪一档：认元素 → 认记下的下标 → 退到「当前生效档」。
 * 「认元素/认下标」这两步只在**同一次菜单打开期间**有意义（菜单关了会 ringForget）。
 * @returns {number} 下标；列表为空时 -1。
 */
const ringIndex = (list) => {
  if (!list || !list.length) return -1
  if (ringRow) {
    const at = list.indexOf(ringRow)
    if (at !== -1) return at
  }
  if (ringAt >= 0 && ringAt < list.length) return ringAt
  const cur = currentLevelIndex(list)
  return cur === -1 ? 0 : cur
}

/** 把环画到第 at 档上（越界自动夹到两端；列表为空就清环）。 */
export const ringTo = (list, at) => {
  const rows = list && list.length ? list : levelRows()
  if (!rows.length) { ringClear(); return false }
  const i = Math.max(0, Math.min(rows.length - 1, at))
  ringRow = rows[i]
  ringAt = i
  highlight(ringRow) // 顺带 scrollIntoView，档多时也看得见
  return true
}

/** 提交某一档：点它（DSH 会落盘设置并把菜单收起）。 */
export const commitLevel = (row) => {
  if (!row) return false
  try { row.click(); return true } catch (e) { return false }
}

/**
 * 打开等级菜单（同一时刻只进行一次）：连转与「按下」可能同时要求打开，
 * 重复点 trigger 会把它刚打开的菜单又关掉 —— 这里共用同一个 promise。
 */
let opening = null
const openLevels = () => {
  if (!opening) opening = openReasoningLevels().finally(() => { opening = null })
  return opening
}

// 旋转步进队列：设备连转时会连着来好几步，而「开菜单」要等 React 渲染（几百 ms）。
// 串行化之后，连转 3 格就是「开菜单（环落当前档）→ 移一档 → 移一档」，不会互相抢。
let stepQueue = []
let stepDraining = false

const drainSteps = async () => {
  if (stepDraining) return
  stepDraining = true
  try {
    while (stepQueue.length) {
      const dir = stepQueue.shift()
      let list = levelRows()
      if (!list.length) {
        ringForget()                        // 菜单是关的 → 环的位置作废，重新从当前档起
        const ok = await openLevels()
        if (!ok) { stepQueue.length = 0; break } // 打不开就别空转，别把队列耗在重试上
        list = levelRows()
        ringTo(list, ringIndex(list))       // 这一转只开菜单：环先落在当前档上
        continue
      }
      ringTo(list, ringIndex(list) + dir)   // 后续每一转移一档（不提交）
    }
  } finally { stepDraining = false }
}

/** 旋转：菜单关着 → 只打开并把环落在当前档；菜单开着 → 环移一档（不提交）。 */
export const reasoningStepDir = (dir) => {
  stepQueue.push(dir >= 0 ? 1 : -1)
  drainSteps()
}

/**
 * 按下：环在别的档上 → 提交那一档；否则只把菜单收起（等价于「不改，关掉」）。
 * 按一下是明确的用户意图，先把待处理的旋转丢掉，免得刚提交完又被队列里的转动改掉。
 */
export const reasoningPressOnce = () => {
  stepQueue.length = 0
  const list = levelRows()
  if (!list.length) {                       // 菜单关着 → 打开并把环落在当前档
    ringForget()
    openLevels().then((ok) => { if (ok) ringTo(levelRows(), ringIndex(levelRows())) })
    return
  }
  const at = ringIndex(list)
  const cur = currentLevelIndex(list)
  if (at >= 0 && at !== cur) {              // 环停在别处 → 这就是「确认选择」
    commitLevel(list[at])
    ringClear()
    return
  }
  ringClear()                               // 环=当前档（或认不出）→ 只收菜单
  closeReasoningLevels()
}
