// dsh-micro · client/src/components/common/cap-tip.jsx
// ★ 悬停提示气泡（渲染层）★ —— 键盘上「这颗键是干什么的」的唯一展示处。
//
// 为什么有它（用户 2026-09-28 要求，配一张设计稿）：
//   「编辑按键」弹窗以前把键的名字写在**键下面**一行（`.micro-cap-name`）——
//   于是每一格都拖着一行小字，网格看着像标签墙；更糟的是布局里的键**没有**这行字，
//   同一个「键帽」在两处长成两个样子。现在两处一致：**键面只有图标**，
//   鼠标移上去才浮出一个深色气泡，把三行信息（短名 / 功能名 / 说明）一次说完。
//
// 这个文件**只碰 React**（state、鼠标事件、JSX）。三行文案与「气泡放哪儿」全是纯函数，
// 住在 ../utils/cap-tip.js —— 那边 Node 自检能直接 import 逐条断言（见文件头的纪律说明）。
//
// 两条实现上的硬约束（都由 utils/cap-tip.js 的 capTipPlacement 保证）：
//   * **位置用 `position:fixed` + JS 量出来的坐标**，不能靠 CSS 相对定位：
//     弹窗的候选网格是 `overflow:auto` 的滚动容器（见 assets/settings.css 的 .micro-modal-grid），
//     子元素的绝对定位会被裁掉 —— 滚到下半屏的候选，气泡就没了。fixed 永远贴着视口。
//     ⚠ 顺带一条：弹窗遮罩带 `backdrop-filter`，那会让它成为 fixed 后代的**包含块** ——
//     所以调用方把气泡渲染成遮罩的**兄弟**，不要放进去（见 modals/keycap.jsx）。
//   * **越界要翻面、要夹住**：键离视口顶太近就翻到下面，左右按气泡最大宽度夹住。
import { useCallback, useState } from 'react'
import { capTipLines, capTipPlacement } from '../../utils/cap-tip.js'

/**
 * 气泡状态：`show(cap, el)` 记下「哪个键帽 + 它此刻的矩形」，`hide()` 收起来。
 * 用量很小，所以用 useState 而不是 ref —— 位置一变就该重渲染。
 * @returns {{tip: object|null, show: Function, hide: Function}}
 */
export function useCapTip() {
  const [tip, setTip] = useState(null)
  const show = useCallback((cap, el) => {
    if (!el || typeof el.getBoundingClientRect !== 'function') { setTip(null); return }
    // 只留后面要用的四个数：整份 DOMRect 存进 state 没必要（也会让快照比对变复杂）。
    const r = el.getBoundingClientRect()
    setTip({ cap: cap || null, left: r.left, top: r.top, bottom: r.bottom, width: r.width })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  return { tip, show, hide }
}

/**
 * 挂到一个元素上的鼠标/焦点事件（直接 spread 进 JSX）。
 * @param show / hide - 来自 useCapTip。
 * @param cap - 这个元素代表哪颗键帽（null = 未指派）。
 */
export const capTipHandlers = (show, hide, cap) => ({
  onMouseEnter: (e) => show(cap, e.currentTarget),
  onMouseLeave: () => hide(),
  onFocus: (e) => show(cap, e.currentTarget),
  onBlur: () => hide()
})

/**
 * 气泡本体。`tip` 为空时渲染 `null`（不占 DOM）。
 * 位置（left/top）由 capTipPlacement 算好后一次性写在 style 上，CSS 只管长相
 * （见 assets/settings.css 的 .micro-captip：深底圆角 + 三行层级 + 小箭头）。
 */
export function CapTip({ tip, t }) {
  if (!tip) return null
  const lines = capTipLines(tip.cap, t)
  const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1024
  const at = capTipPlacement(tip, { width: vw })
  return (
    <div
      className={'micro-captip' + (at.below ? ' micro-captip--below' : '')}
      style={{ left: at.x, top: at.y }}
      role="tooltip"
    >
      <div className="micro-captip-name">{lines.name}</div>
      {lines.func ? <div className="micro-captip-func">{lines.func}</div> : null}
      {lines.desc ? <div className="micro-captip-desc">{lines.desc}</div> : null}
    </div>
  )
}
