// dsh-omkb · client/src/utils/keycaps.js
// 布局模型：设备键码 ↔ 设置页「键盘布局」里的视觉键。
//
// 2026-09-26 从 client/keypad/layout.js 迁到这里（目录约定：布局模型是纯数据 + 纯函数，
// 属于 utils），并按用户要求**改名为 keycaps.js**。
//
// ⚠ 名字与内容是有意错位的，别被名字骗了：
//     本文件            —— 键帽**画在哪一格**（几何/映射：键码 ↔ 视觉键、合并/拆分态、出厂功能翻译）
//     client/keypad.js  —— 键帽**按下做什么**（行为：键帽表 + 分派器）
//   两个文件都「关于键帽」，所以两个名字都合理；分工的判据写在 keypad.js 头部。
//
// 为什么纯 JS：布局既要被 React 渲染（components/settings/keyboard-layout.jsx），
// 又要有能被自检 / 探针直接验的判据（JSX 那侧 Node 自检 import 不了）。
// 模型只写在这里一份，三处（渲染 / 自检 / 探针）都从这里取，别再各写一份。
//
// 住 utils 的理由（「utils 只放不涉及功能执行的工具」）：本文件全是纯数据与纯函数，
// 不碰 ctx、不碰运行时、没有副作用 —— 它算的是「哪一格」，不是「按下干什么」。
//
// 设备事实（Codex Micro 官方文档）：底部那颗 **两倍宽的 Mic 键下面有两个开关**，
// 它们分别上报 ACT10 / ACT11。Codex 里的「使用独立麦克风键」说的就是这件事：
// 「可以对宽大的 Mic 键下方的两个开关进行独立映射」。于是本插件把这个开关的两种状态
// 如实画出来（见下），而不是把它当成一个空占位：
//   * 关（默认，micKey=false）：两个开关当**一颗宽键**用 —— 画一颗 span 2 的宽键，
//     ACT10 与 ACT11 都亮它（旧固件/旧客户端只报其中一个码时同样成立）。
//   * 开（micKey=true）：两个开关各自独立 —— **拆成两颗 1 格宽的键**（左右顺序＝读序）。
//     左开关（ACT10）出厂是 MIC 键；右开关（ACT11）出厂是**自定义键**（未指派 → 按下不执行，
//     点它选键帽），见 MIC_CUSTOM_CODE 的注释。

// 出厂**按键功能**表住在默认配置里（`../config/default.js` 的 FACTORY_KEY_FUNCS），值是功能名；
// 这里负责把它翻成键帽 id（界面/DOM 要的是键帽 id，见下）。所以是 import + 本文件再算出映射，
// 不是 `export … from`。
import { keycapActions } from '../actions/registry.js'
import { FACTORY_KEY_FUNCS } from '../config/default.js'

/** Mic 宽键下面的两个开关，数组顺序＝布局里从左到右。 */
export const MIC_SWITCHES = ['ACT10', 'ACT11']

/** 合并态下，两颗 Mic 开关共用的那颗宽键的视觉键 id（键帽取 ACT11 的）。 */
export const MIC_MERGED_ID = 'act11'

/**
 * 拆分态**左开关**（ACT10）：出厂就是 MIC 键（键帽 'ACT10' = 语音）。
 * 拆分态**右开关**（ACT11）：出厂是**自定义键** —— 没指派功能前按下什么都不做，
 * 用户在布局里点它（或点「编辑按键」）选一颗键帽才算数。
 * 为什么这样定：宽 Mic 键下面本来就有两个开关，官方说「可以对两个开关独立映射」；
 * 拆开之后两颗都印着 MIC 是没有意义的（它们按下去本来就一样），
 * 留一颗给用户自己指派才有意义 —— 所以左边保持 MIC，右边默认空着。
 */
export const MIC_CUSTOM_CODE = 'ACT11'

/**
 * 功能名 → 键帽 id。
 *
 * 键帽表（`../keypad.js`）与功能总表（`../actions/registry.js`）的关系是「一颗键帽 = 一个功能」：
 * 总表每条功能带着自己的 `capId`，那就是它在键帽表里的存储 id。所以这张映射不需要手写，
 * 从总表派生即可 —— 加/删功能时它自动跟着变（想加一把新键帽，改总表那一条就行）。
 * 注意新功能的 capId 未必是设备键码（FORK 的 capId 就是 'FORK'），所以**不能让默认表写键帽 id**：
 * 那样每加一颗新键帽都要回来改默认配置。默认表写功能名，这一层负责翻译。
 */
const CAP_OF_FUNC = new Map(keycapActions().map((a) => [a.id, a.capId]))

/** 设备键码（大小写不敏感）→ 它在 `FACTORY_KEY_FUNCS` 里登记的出厂功能名。 */
const factoryFuncName = (code) => FACTORY_KEY_FUNCS[String(code || '').trim().toUpperCase()]

/**
 * 某颗键**出厂**按下执行什么功能（动作名，即总表的 id）。
 * @returns {string|null} 动作名；**null = 这颗键没有出厂功能**（键码不在默认表里，比如 6 颗智能体键，
 *   或默认表里写了个不能当键帽的功能名 —— 后者会被自检 verify_keycaps 判红）。null = 按下什么都不做。
 */
export const factoryFuncOf = (code) => {
  const f = factoryFuncName(code)
  return CAP_OF_FUNC.has(f) ? f : null
}

/**
 * 某颗键**出厂**是哪个键帽（＝界面上画什么图标）。判据只有一处：默认配置里的功能名 + 总表的 capId。
 *
 * 为什么返回值必须走 capId 而不是功能名：DOM 上 `data-omkb-cap` 与图标表（components/common/ui.jsx
 * 的 CAP_ICON）认的都是**键帽 id**。直接返回功能名会让探针量到 `voice` 这种值、图标也取不到。
 * 顺带解决历史别名：MIC 那颗键帽的 id 是 'ACT10'，所以 ACT11 出厂也会翻成 'ACT10'，而不是
 * ../keypad.js 里那个只该用于**读老存档**的历史别名。
 *
 * @returns {string|null} 键帽 id；null = 没有出厂键帽（拆分态那颗自定义键的初始状态，见 capFor）。
 */
export const factoryCapOf = (code) => CAP_OF_FUNC.get(factoryFuncName(code)) || null

/**
 * 一颗物理键**现在**是哪颗键帽 —— 也就是「按下它执行什么」（渲染与动作解析共用这一份判据）。
 * @param code - 设备键码（AG00..AG05 / ACT06..ACT12，大小写不敏感）。
 * @param prefs - 设置页偏好（只看 actLabels 与 micKey）。
 * @returns {string|null} 键帽 id；**null = 未指派**（拆分态那颗自定义键的初始状态，
 *   渲染层显示「自定义」，动作层按下什么都不做）。
 */
export const capFor = (code, prefs = {}) => {
  const c = String(code || '').trim().toUpperCase()
  const labels = (prefs && prefs.actLabels) || {}
  if (MIC_SWITCHES.includes(c)) {
    if (prefs && prefs.micKey) {
      // 拆分态：两颗开关各读各的；左键没设过 → MIC，右键没设过 → 未指派（自定义键）
      if (c === MIC_CUSTOM_CODE) return labels[c] || null
      return labels[c] || factoryCapOf(c)
    }
    // 合并态：两颗开关共用同一颗宽键，键帽与功能走同一条链（ACT11 优先，历史写入口就是它）
    return labels.ACT11 || labels.ACT10 || factoryCapOf('ACT11')
  }
  return labels[c] || factoryCapOf(c)
}

/**
 * 设备键码 → 视觉键 id（**合并态**）。
 * AG00..AG05 是 6 个智能键，按「先从左到右、再从上到下」对上 Row1 的两个普通键 + Row2 的四个；
 * ACT10 与 ACT11 是同一颗宽键下的两个开关，合并态都落在 MIC 宽键上。
 * 旋钮不参与：本次明确不做旋钮特效。
 */
export const KEY_LAYOUT = {
  AG00: 'r1-2', AG01: 'r1-3',
  AG02: 'r2-1', AG03: 'r2-2', AG04: 'r2-3', AG05: 'r2-4',
  ACT06: 'act06', ACT07: 'act07', ACT08: 'act08', ACT09: 'act09',
  ACT10: MIC_MERGED_ID, ACT11: MIC_MERGED_ID, ACT12: 'act12'
}

/**
 * 设备键码 → 视觉键 id，随「独立麦克风键」状态变化的那两条走这里。
 * @param {string} name 设备上报的键名（大小写不敏感）。
 * @param {boolean} split 是否处于「独立麦克风键」拆分态。
 * @returns {string|null} 视觉键 id；不属于布局里的任何键时返回 null（什么都不亮）。
 */
export const keyVisual = (name, split) => {
  const code = String(name || '').toUpperCase()
  if (split && MIC_SWITCHES.includes(code)) return code.toLowerCase() // ACT10 → 'act10'
  return KEY_LAYOUT[code] || null
}

/**
 * 底部一行里 Mic 那部分的键（渲染用）。
 * @param {object} prefs 设置页偏好；只看 micKey 与 actLabels。
 * @returns {Array<{code: string, visualId: string, wide: boolean, capId: string|null, custom: boolean}>}
 *   code —— 键帽弹窗写回的目标键码（＝actLabels 的键）；
 *   visualId —— `data-omkb-key`，也是按压特效的键；
 *   wide —— 是否占两格（合并态那颗宽键）；
 *   capId / custom —— 这颗键当前的键帽（null = 未指派）。
 *
 * 键帽（也就是「显示什么」+「按下做什么」）**只有 {@link capFor} 这一个判据**，
 * 渲染与动作解析都读它。这里以前另有一个只取文案的 micKeyLabel（配 labelFrom 取值链）——
 * 两条链并行就出过「键帽显示 SEND、按下还是录音」那类不一致，已经删掉了。
 */
export const micRowKeys = (prefs = {}) => {
  const rows = (prefs && prefs.micKey)
    ? MIC_SWITCHES.map((code) => ({ code, visualId: code.toLowerCase(), wide: false }))
    : [{ code: MIC_MERGED_ID.toUpperCase(), visualId: MIC_MERGED_ID, wide: true }]
  return rows.map((k) => {
    const capId = capFor(k.code, prefs)
    return { ...k, capId, custom: !capId }
  })
}

/**
 * 一颗键「按下后执行什么」，去 actLabels 的哪个键上取（取值链，先写的优先）。
 *
 * 为什么复用键帽那一格：设置里那一格就是「这颗键是什么」——键帽列表本身就是功能列表
 * （FAST/ARCH/REJ/APPR/MIC/SEND），用户改键帽时想的是「把这颗键改成发送」，
 * 只改显示不改行为会被当成「设置不反应」（见 ../keypad.js 的 resolve）。
 * Mic 两颗开关在合并态共用同一颗宽键，取值链与键帽完全一致（ACT11 优先、ACT10 兜底）。
 * @param {string} code 设备键码（ACT06..ACT12，大小写不敏感）。
 * @param {boolean} split 是否拆分态（micKey 打开时两颗开关各自独立）。
 * @returns {string[]} 取值链；都没设过时调用方退回出厂默认。
 */
export const actionSourceOf = (code, split) => {
  const c = String(code || '').trim().toUpperCase()
  if (MIC_SWITCHES.includes(c)) return split ? [c] : [...MIC_SWITCHES].reverse()
  return [c]
}
