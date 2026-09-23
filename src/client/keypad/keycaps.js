// dsh-omkb · client/src/keypad/keycaps.js
// 键帽表：设置页布局上的零件，**一颗键帽 = 一个功能**。
//
// 为什么单独一个纯 JS 模块：「键帽」同时被三处消费 —— 布局里画键与「编辑按键」弹窗列候选
// （components/ 里那两个 JSX 文件）、以及按下时解析「这颗键到底做什么」（./index.js 的 resolve）。
// 各写一份的后果都是同一类：界面显示 SEND、按下却还在录音。
//
// **表本身不在这里**：功能清单的真源是 `../actions/registry.js` 的 ACTIONS（用户要求「所有
// 功能按键方法放在 actions 目录下同一个文件里」）。这个文件只做两件事：
//   ① 把总表里**能当键帽**的那些翻译成这里要的形状（id/label/icon/action/desc）；
//   ② 记住历史别名（ACT11 曾经也是一颗 MIC 键，老存档里存着它）。
// 于是「加一颗键帽」= 在总表里加一条带 capId 的功能，不必再动这个文件。
//
// id 沿用设备动作键码（ACT06..ACT12）：历史存档里存的键帽值就是这些键码，
// 换 id 等于把所有人的老设置作废。`ACT06` 用 FAST 这个键帽表示「保留（按下不执行）」。
//
// 图标不在这里：`icon` 只是一个名字，具体路径由渲染层（components/ui.jsx 的 CAP_ICON）按它取，
// 免得纯 JS 模块被迫产出 JSX。

import { keycapActions } from '../actions/registry.js'

/** 未指派（拆分态那颗自定义键的初始状态）在界面上显示的字。 */
export const CUSTOM_LABEL = '自定义'

/** 「自定义」用的图标名（虚线框 + 加号，= 还没选功能）。 */
export const CUSTOM_ICON = 'custom'

/**
 * 键帽表（数组顺序 = 「编辑按键」弹窗里的显示顺序）＝ 功能总表里能当键帽的那些。
 *   action —— 执行时的动作名（总表的 id，由 keypad/index.js 交给 actions/registry.js 执行）；
 *             `'none'` 是**明确的「什么都不做」**（FAST 那颗保留键），与「不认识」不是一回事。
 *   label  —— 键帽上的短名；desc —— 弹窗里对该功能的说明。
 */
export const KEYCAPS = keycapActions().map((a) => ({
  id: a.capId,
  label: a.name,
  icon: a.icon,
  action: a.id,
  desc: a.desc
}))

const BY_ID = new Map(KEYCAPS.map((c) => [c.id, c]))

// 历史值：改名之前，拆分态的**右开关（ACT11）**也当成一颗 MIC 键用过，老存档里存着 'ACT11'。
// 现在右开关出厂是「自定义键」，但老值必须照样解析成 MIC —— 否则用户升级后
// 「设置里明明写着 MIC，按下却没反应」。所以 ACT11 只是**别名**，不进 KEYCAPS（不进弹窗）。
BY_ID.set('ACT11', BY_ID.get('ACT10'))

/** 键帽 id → 键帽（大小写不敏感；ACT11 是历史别名，等价于 ACT10）。 */
export const keycapOf = (id) => BY_ID.get(String(id == null ? '' : id).trim().toUpperCase()) || null

/**
 * 键帽 id → 显示文案。
 * @param fallback - 键帽不认识时用的兜底文案（一般是空串，由调用方决定显示什么）。
 */
export const keycapLabel = (id, fallback = '') => {
  const c = keycapOf(id)
  return c ? c.label : fallback
}

/**
 * 键帽 id → 动作名。
 * 必须区分三种结果，调用方全靠它们决定「这颗键按下做什么」：
 *   string —— 动作名（`'none'` 也是动作名：明确不执行）；**undefined —— 不认识这个值**
 *   （不猜，退回出厂默认）。
 */
export const keycapAction = (id) => {
  const c = keycapOf(id)
  return c ? c.action : undefined
}

/** 键帽 id → 图标名（不认识时给「自定义」的图标）。 */
export const keycapIcon = (id) => {
  const c = keycapOf(id)
  return c ? c.icon : CUSTOM_ICON
}
