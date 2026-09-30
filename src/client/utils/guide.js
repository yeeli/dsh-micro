// dsh-micro · client/src/utils/guide.js
// 首次连接引导的**纯逻辑**：三屏步骤表、「什么时候该弹」的判据、以及智能体键的图例配色。
//
// 为什么单独放 utils/：引导弹窗本身是 JSX（Node 进不去），但上面那几条判据必须能被自检
// 直接 import ——「看过就不再弹」「没连上设备不弹」属于最容易悄悄回归的一类规则，而它们的
// 失效表现是**用户每次打开页面都被弹一次**，只有真机上待久了才发现。放这里就能在
// npm run verify 里钉住。
//
// 放这里的门槛与 utils/ 其它文件一致：无 DOM、无 DSVI、无控制器状态。
// （下面 import 的 agents.js / utils/keycaps.js 只取**模块级常量**，不碰任何实例。）
import { AGENT_COLOR_RGB, AGENT_STATUS } from '../agents.js'
import { KEY_LAYOUT } from './keycaps.js'

/**
 * 引导的三屏。
 * 'welcome' 是封面（介绍 + 状态 + 两个入口按钮），后面两屏才是参考产品说的「两步导览」。
 */
export const GUIDE_STEPS = ['welcome', 'agents', 'commands']

/** 「两步导览」的两步 = 除封面以外的屏数。按钮文案「开始两步导览」按它算。 */
export const GUIDE_TOUR_STEPS = GUIDE_STEPS.length - 1

/** 步骤 → 下标；认不出的步骤一律当封面（宁可从头讲，也别卡在空白屏）。 */
export const stepIndex = (step) => {
  const i = GUIDE_STEPS.indexOf(step)
  return i < 0 ? 0 : i
}

/** 下标 → 步骤（越界自动夹到两端）。 */
export const stepAt = (i) => {
  const n = Number.isFinite(i) ? Math.round(i) : 0
  return GUIDE_STEPS[Math.max(0, Math.min(GUIDE_STEPS.length - 1, n))]
}

/** 是不是最后一屏（决定按钮是「最后一步」还是「开始构建！」）。 */
export const isLastStep = (step) => stepIndex(step) === GUIDE_STEPS.length - 1

/** 是不是封面（封面只有「跳过 / 开始两步导览」，没有「上一步」）。 */
export const isFirstStep = (step) => stepIndex(step) === 0

export const nextStep = (step) => stepAt(stepIndex(step) + 1)
export const prevStep = (step) => stepAt(stepIndex(step) - 1)

/**
 * 该不该弹引导。两条硬规则，缺一不可：
 *
 *   1) `open === true` —— **必须真的连上设备**。引导讲的是「你这台键盘」，没连上时弹出来
 *      只会被当成误报（而且此时用户最关心的也不是引导，是为什么连不上）。
 *      用严格比较：老宿主可能根本没有 `open` 字段，`undefined` 一律当作没连上。
 *   2) `seen !== true` —— 用户看过或跳过过就不再弹。**用 `!== true` 而不是 `!seen`**：
 *      字段缺失（老存档 / 还没写过）必须落到「该弹」这一侧，写成 `!seen` 会同样正确，
 *      但写成 `seen === false` 就会把「字段不存在」错判成「已看过」——这台键盘的
 *      首次引导就永远不会出现了，而且没有任何报错。
 *
 * @param {{open?: boolean, seen?: boolean}} state - 设备的连接状态与「已看过」标记。
 * @returns {boolean} 现在该不该把引导弹出来。
 */
export const shouldShowGuide = ({ open, seen } = {}) => seen !== true && open === true

/** 设备键码 → 6 颗智能体键的视觉 id（顺序 = AG00..AG05 = 先左到右、再上到下）。 */
export const AGENT_CODES = ['AG00', 'AG01', 'AG02', 'AG03', 'AG04', 'AG05']

/** @returns {string[]} 6 颗智能体键在布局里的视觉 id（读 KEY_LAYOUT，不另写一份）。 */
export const agentVisualIds = () => AGENT_CODES.map((code) => KEY_LAYOUT[code]).filter(Boolean)

/** packed RGB 整数 → `#rrggbb`（设备灯的颜色与图例上的颜色必须是同一个数）。 */
export const rgbHex = (n) => {
  const v = Number.isFinite(n) ? Math.max(0, Math.min(0xffffff, Math.round(n))) : 0
  return '#' + v.toString(16).padStart(6, '0')
}

/**
 * 智能体键图例 —— **只列这台设备当下真的会显示的状态**。
 * 参考产品的图例有六色（含「已完成 / 需要输入」），但本项目目前没有这两个状态的来源
 * （见 agents.js 顶部词表：浏览器只产出 running/idle/empty，error 由宿主点亮并保持），
 * 照着抄会出现「图例上有、键盘上永远亮不起来」的假承诺，所以这里只画真有的四种。
 * 颜色取 agents.js 的 AGENT_COLOR_RGB —— 图例与设备灯同一份数值。
 */
export const GUIDE_LEGEND = [
  { key: AGENT_STATUS.RUNNING, color: AGENT_COLOR_RGB.working, labelKey: 'guide.legend.running' },
  { key: AGENT_STATUS.IDLE, color: AGENT_COLOR_RGB.idle, labelKey: 'guide.legend.idle' },
  { key: AGENT_STATUS.ERROR, color: AGENT_COLOR_RGB.error, labelKey: 'guide.legend.error' },
  { key: AGENT_STATUS.EMPTY, color: AGENT_COLOR_RGB.off, labelKey: 'guide.legend.empty' }
]

/**
 * 引导里那 6 颗智能体键的**示意配色**（不是真实状态，只是把四种颜色都摆出来给用户看）。
 * 顺序对应 AG00..AG05 —— 刻意让相邻两颗不同色，一眼看出「这几颗键是靠颜色说话的」。
 */
export const GUIDE_AGENT_SWATCH = [
  AGENT_COLOR_RGB.working, AGENT_COLOR_RGB.idle, AGENT_COLOR_RGB.working,
  AGENT_COLOR_RGB.off, AGENT_COLOR_RGB.error, AGENT_COLOR_RGB.idle
]

/**
 * 视觉键 id → 示意配色的表，直接喂给布局的预览模式（见 settings/keyboard-layout.jsx 的 preview）。
 * @returns {Object<string, string>} 例：{ 'r1-2': '#304ffe', ... }
 */
export const agentSwatchByVisualId = () => {
  const ids = agentVisualIds()
  const out = {}
  ids.forEach((id, i) => { if (i < GUIDE_AGENT_SWATCH.length) out[id] = rgbHex(GUIDE_AGENT_SWATCH[i]) })
  return out
}
