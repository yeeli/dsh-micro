// dsh-omkb · client/src/keypad/layout.js
// 布局模型：设备键码 ↔ 设置页「键盘布局」里的视觉键。
//
// 为什么单独拎一个**纯 JS** 模块：布局既要被 React 渲染（components/keyboard-layout.jsx），
// 又要有能被自检 / 探针直接验的判据（JSX 那侧 Node 自检 import 不了）。
// 模型只写在这里一份，三处（渲染 / 自检 / 探针）都从这里取，别再各写一份。
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
 * 出厂键帽：某颗键**没被改过**时，它自己就是自己的键帽（键帽 id 沿用设备键码）。
 * ACT11 是唯一有讲究的一条 —— 合并态下它和 ACT10 是**同一颗宽键**的两个开关，
 * 出厂键帽取 'ACT10'（MIC）＝「这颗宽键就是麦克风键」。
 * 为什么不写 'ACT11'（它在 keycaps.js 里是指向 ACT10 的历史别名）：别名只该用在
 * **读老存档**那一侧，不该漏进 DOM 与界面 —— 探针量到的 data-omkb-cap 应当是正经键帽 id。
 * 拆分态不走这张表，见 {@link capFor}。
 */
export const FACTORY_CAP = {
  ACT06: 'ACT06', ACT07: 'ACT07', ACT08: 'ACT08', ACT09: 'ACT09',
  ACT10: 'ACT10', ACT11: 'ACT10', ACT12: 'ACT12'
}

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
      return labels[c] || FACTORY_CAP[c] || null
    }
    // 合并态：两颗开关共用同一颗宽键，键帽与功能走同一条链（ACT11 优先，历史写入口就是它）
    return labels.ACT11 || labels.ACT10 || FACTORY_CAP.ACT11
  }
  return labels[c] || FACTORY_CAP[c] || null
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
 * 只改显示不改行为会被当成「设置不反应」（见 ./index.js 的 resolve）。
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
