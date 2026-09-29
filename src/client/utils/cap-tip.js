// dsh-omkb · client/src/utils/cap-tip.js
// 悬停气泡的**纯判据**：三行文案 + 气泡该放哪儿。
//
// 为什么单拎一个文件（本项目的一条硬纪律）：「纯判据不许住带 `import React` 的模块」——
// 渲染层是 .jsx（Node 自检进不去，`ERR_MODULE_NOT_FOUND: react`），而这两件事都是**纯函数**：
// 参数进、结果出，跟 React 一点关系没有。放这里，`npm run verify:keycaps` 就能直接 import
// 逐条断言（含「键贴着视口顶要翻面」「贴左边缘要夹住」这类几何边界）。
// 渲染层（components/common/cap-tip.jsx）只碰 React：state、鼠标事件、JSX。
//
// ⚠ 与 config/default.js 同一条纪律：本文件**不许 import 任何会拖进 DOM/React 的东西**。
//   唯一的 import 是 ../keypad.js（纯 JS 键帽表，它自己不 import 渲染层）——
//   借它拿「未指派」那颗键的显示名（CUSTOM_LABEL），不重抄一遍字面量。
//
// 气泡的三行（顶层字段来自键帽表）：
//   ① name   短名（`cap.label`）—— 「批准」「终端」这种，一眼认出是哪颗键
//   ② func   功能名（`cap.labelKey` 查词典）—— 比短名长，比如「批准当前交互」
//   ③ desc   说明（`cap.desc`）—— 一句话讲清按下会发生什么
// ②③ 都是**可选**的：词典没绑（`t` 把键名原样吐回来）就不显示②，`desc` 为空就不显示③，
// 于是「只有一个词」时气泡不会留一行空白。

import { CUSTOM_LABEL } from '../keypad.js'

/** 气泡最大宽度（px）—— **必须与 assets/settings.css 的 .omkb-captip 一致**：夹取算的就是它。 */
export const CAP_TIP_MAX_W = 248
/** 气泡与键之间的空隙（px）。 */
export const CAP_TIP_GAP = 10
/** 键的上边距小于它就把气泡翻到键**下面**（气泡最高约三行，留够才不会顶出视口）。 */
export const CAP_TIP_FLIP_Y = 118
/** 气泡与视口左右边缘至少留的余量（px）。 */
export const CAP_TIP_EDGE = 8

/**
 * 气泡要显示的三行。
 * @param cap - 键帽表里的一条（`{label, labelKey, desc}`）；null/undefined = 未指派的自定义键。
 * @param t - 词典取值函数（`ctx.locale.bind(NS)`）。不传 / 绑不到时第二行自动省略。
 * @returns {{name: string, func: string, desc: string}}
 */
export const capTipLines = (cap, t) => {
  if (!cap) {
    return {
      name: CUSTOM_LABEL,
      func: '',
      desc: '这颗键还没指派功能，按下不执行任何操作（点它挑一颗键帽）'
    }
  }
  const tt = typeof t === 'function' ? t : null
  let func = ''
  if (tt && cap.labelKey) {
    let bound = ''
    try { bound = String(tt(cap.labelKey) || '') } catch (e) { bound = '' }
    // 词典没绑这条时 bind 会把键名原样吐回来 —— 那不是文案，别显示成第二行。
    if (bound && bound !== cap.labelKey) func = bound
  }
  return {
    name: String(cap.label || ''),
    func,
    desc: String(cap.desc || '')
  }
}

/**
 * 气泡该放哪儿。
 *
 * 输入是**量出来的**矩形与视口宽度（`el.getBoundingClientRect()` / `window.innerWidth`），
 * 输出直接写进 style —— 两个决定：
 *   * 默认在键**上方**（`y` = 键的上边 − 空隙，再靠 CSS 的 translate(-50%,-100%) 抬起来）；
 *     键离视口顶太近（`top < CAP_TIP_FLIP_Y`）就翻到下面，否则气泡会顶出屏幕。
 *   * 左右**夹住**：居中于键，但两侧各留 CAP_TIP_EDGE + 半个最大宽度，
 *     免得贴着窗口边缘的键把气泡推出去一半。视口比气泡还窄时直接居中（夹取区间会反过来）。
 *
 * @param rect - `{left, top, bottom, width}`（getBoundingClientRect 的子集就够）。
 * @param viewport - `{width}`（window.innerWidth）。取不到时按 1024 算。
 * @returns {{x: number, y: number, below: boolean}}
 */
export const capTipPlacement = (rect, viewport = {}) => {
  const r = rect || {}
  const vw = Number(viewport && viewport.width) > 0 ? Number(viewport.width) : 1024
  const half = CAP_TIP_MAX_W / 2 + CAP_TIP_EDGE
  const lo = half
  const hi = vw - half
  const cx = Number(r.left || 0) + Number(r.width || 0) / 2
  const x = hi <= lo ? vw / 2 : Math.min(Math.max(cx, lo), hi)
  const below = Number(r.top || 0) < CAP_TIP_FLIP_Y
  return {
    x,
    below,
    y: below ? Number(r.bottom || 0) + CAP_TIP_GAP : Number(r.top || 0) - CAP_TIP_GAP
  }
}
