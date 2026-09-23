// dsh-omkb · client/src/actions/registry.js
// ★ 功能按键总表 ★ —— **所有**「按一下就干一件事」的功能都登记在这里，一个功能一条。
//
// 为什么要有这张表（用户原话：「将所有功能按键方法都放在 actions 目录下同一个文件内方便调用，
// 随后可以增加新功能和删除旧功能」）：
//   同一个功能会从**四个地方**被选到 / 被执行 ——
//     ① 键帽候选（components/keycap-modal.jsx）→ 写进 actLabels；
//     ② 按键分派（keypad/index.js）→ 按下时执行；
//     ③ 旋钮自定义分配（settings-panel.jsx 的下拉 → knob.js 执行）；
//     ④ 控制台 / 自检（`__dshOmkb.actions`）。
//   四处各写一份清单，迟早漂移（本项目踩过一次：键帽显示改了、按下还是录音）。
//   现在只有这一份：**加功能 = 在 ACTIONS 里加一条；删功能 = 删掉那一条** ——
//   四个消费面自动跟着变，不必再去别处找「还有哪张表要同步」。
//
// 一条记录里的字段：
//   id     稳定标识，**会存进设置**（knobCustom 存的就是它）。改名要留 ALIASES。
//   name   键帽上的短名（FAST/ARCH/…）：只有能当键帽的功能才有。
//   icon   图标名 —— 具体路径由渲染层按它取（components/ui.jsx 的 CAP_ICON），
//          纯 JS 模块不产出 JSX。
//   capId  这颗功能在**键帽表**里的存储 id（actLabels 存的就是它），见下面的「沿用规则」。
//   label  设置页下拉用的词典键（config/locales.js）。
//   desc   一句话说清「按下会发生什么」（键帽弹窗的说明、自检的判据）。
//   knob   是否出现在「旋钮自定义分配」的选项里。
//   hold   按住型：这条功能在**两种界面上语义不同**，所以三个实现都要写 ——
//            press/release = 按住说话（键帽/按键，按下开始、松开停止）；
//            run          = 一次性形态 = 开关（旋钮自定义手势没有「按住」这回事）。
//          见 voice 那一条；缺 run 的按住型功能在旋钮里会「配了没反应」。
//   run / press / release —— 实现。形参是 `{ ops, voice, log }`（控制器把手上的东西交进来），
//          这里**不自己去摸 DSH**：真正的 DSH 调用全在 ./index.js 的 DshOps 上 ——
//          本目录是「唯一直接操作 DSH 的地方」，而门面是这条规则的唯一出口。
//
// id 沿用规则（**老存档不许作废**）：2026-09-24 之前的键帽 id 就是**设备键码**（ACT06..ACT12），
// 用户设置里存着它们；所以老功能的 capId 一律沿用键码，新功能才用动作名大写（如 FORK）。
// 同理 `agree` 是历史动作名（knobCustom 里可能存着），由 ALIASES 指回现在的 `approve`。

/** 动作执行失败的兜底日志（控制器没给 log 时用；与控制台其它日志同一前缀）。 */
const defaultLog = (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }

/**
 * 调门面上的一个方法：没有这个方法 / 返回 false 都算「没执行成功」。
 * **抛错不在这里吞掉** —— 交给 invoke 统一 catch 并记一行日志，
 * 否则门面方法一坏（比如 DSH 改了接口）就是「按下去没反应且查不出原因」。
 */
const call = (ops, method, ...args) => {
  if (!ops || typeof ops[method] !== 'function') return false
  const r = ops[method](...args)
  return r === undefined ? true : !!r
}

// ---- 语音的三个动作（浏览器能力，不走门面；控制器直接持有 voice）----

/**
 * 按下开始转写。**幂等**：按住期间设备会重复上报同一次按下（宿主去抖后的重发、或两颗开关都亮），
 * 重复 start() 会把刚转写出来的内容清掉重来。
 */
const startVoice = (voice) => {
  if (!voice) return false
  if (voice.listening) return false
  if (typeof voice.start !== 'function') return false
  try { voice.start(); return true } catch (e) { return false }
}

/**
 * 松开停止转写。**幂等**：合并态两颗开关是同一颗宽键，松开时会有两条上报；
 * 重复 stop() 会多走一遍收尾（把已经落进输入框的文本再推一次）。
 */
const stopVoice = (voice) => {
  if (!voice || typeof voice.stop !== 'function') return false
  if (!voice.listening) return false
  try { voice.stop(); return true } catch (e) { return false }
}

/** 开关语音（给**没有按住语义**的界面：旋钮手势）。 */
const toggleVoice = (voice) => {
  if (!voice || typeof voice.toggle !== 'function') return false
  try { voice.toggle(); return true } catch (e) { return false }
}

// ---------------------------------------------------------------------------
// 总表。顺序 ＝「编辑按键」弹窗里的候选顺序，也是旋钮下拉的顺序（前段是键帽功能，
// 后段是旋钮专属的手势动作）。要加新功能，在这里加一条就行。
// ---------------------------------------------------------------------------
export const ACTIONS = [
  {
    id: 'none',
    name: 'FAST', icon: 'fast', capId: 'ACT06',
    label: 'act.none',
    desc: '保留：按下不执行任何操作',
    knob: true,
    run: () => false
  },
  {
    id: 'archive',
    name: 'ARCH', icon: 'arch', capId: 'ACT07',
    label: 'act.archive',
    desc: '归档当前会话：立刻从会话列表收起，可在「已归档」里找回',
    knob: true,
    run: (c) => call(c.ops, 'archive')
  },
  {
    id: 'reject',
    name: 'REJ', icon: 'rej', capId: 'ACT08',
    label: 'act.reject',
    desc: '拒绝当前待确认的交互（审批 → 拒绝；计划确认 → 拒绝执行）',
    knob: true,
    run: (c) => call(c.ops, 'respond', 'reject')
  },
  {
    id: 'approve',
    name: 'APPR', icon: 'appr', capId: 'ACT09',
    label: 'act.approve',
    desc: '批准当前待确认的交互（审批 → 允许一次；计划确认 → 确认执行）',
    knob: true,
    // 历史动作名：knobCustom 里老值存的是 'agree'（见 ALIASES）。
    run: (c) => call(c.ops, 'respond', 'approve')
  },
  {
    id: 'fork',
    name: 'FORK', icon: 'fork', capId: 'FORK',
    label: 'act.fork',
    desc: '分叉当前会话：从当前这条复制出一条新的分支会话，原会话保留',
    knob: true,
    run: (c) => call(c.ops, 'fork')
  },
  {
    id: 'voice',
    name: 'MIC', icon: 'mic', capId: 'ACT10',
    label: 'act.voice',
    desc: '语音输入：按住开始转写，松开停止',
    knob: true,
    // 同一条功能、两种界面语义，**都是用户要的**，所以分开写：
    //   键帽/按键 = 按住说话（按下 start、松开 stop，见 keypad/index.js 的 release）；
    //   旋钮手势 = 没有「按住」这回事，一转/一按就是开关（原 knob.js 里就是 toggle）。
    hold: true,
    press: (c) => startVoice(c.voice),
    release: (c) => stopVoice(c.voice),
    run: (c) => toggleVoice(c.voice)
  },
  {
    id: 'send',
    name: 'SEND', icon: 'send', capId: 'ACT12',
    label: 'act.send',
    desc: '发送当前输入',
    knob: true,
    run: (c) => call(c.ops, 'send')
  },

  // ---- 以下是「旋钮自定义分配」专属（没有 capId：它们是手势语义，不是一颗键的功能）----
  {
    id: 'nav_fwd', label: 'act.navFwd',
    desc: '焦点后移到下一个可聚焦控件（不含输入框）',
    knob: true,
    run: (c) => call(c.ops, 'navStep', 1)
  },
  {
    id: 'nav_back', label: 'act.navBack',
    desc: '焦点前移到上一个可聚焦控件',
    knob: true,
    run: (c) => call(c.ops, 'navStep', -1)
  },
  {
    id: 'scroll_up', label: 'act.scrollUp',
    desc: '当前对话向上滚一屏',
    knob: true,
    run: (c) => call(c.ops, 'scrollStep', -1)
  },
  {
    id: 'scroll_down', label: 'act.scrollDown',
    desc: '当前对话向下滚一屏',
    knob: true,
    run: (c) => call(c.ops, 'scrollStep', 1)
  },
  {
    id: 'scroll_bottom', label: 'act.scrollBottom',
    desc: '滚到当前对话底部',
    knob: true,
    run: (c) => call(c.ops, 'scrollToBottom')
  },
  {
    id: 'reasoning', label: 'act.reasoning',
    desc: '仅推理：打开等级菜单（环在当前档）/ 确认环停的那一档',
    knob: true,
    run: (c) => call(c.ops, 'reasoningPress')
  },
  {
    id: 'reasoning_up', label: 'act.reasoningUp',
    desc: '仅推理：把蓝环向上移一档（转动不提交）',
    knob: true,
    run: (c) => call(c.ops, 'reasoningStep', 1)
  },
  {
    id: 'reasoning_down', label: 'act.reasoningDown',
    desc: '仅推理：把蓝环向下移一档（转动不提交）',
    knob: true,
    run: (c) => call(c.ops, 'reasoningStep', -1)
  }
]

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

/** 历史动作名 → 现在的 id。**必须继续认**：设置里存的是动作名，不认 = 升级后手势失灵。 */
export const ALIASES = { agree: 'approve' }

/** 动作名（含历史别名、忽略大小写与空格）→ 表里的那一条；不认识返回 null。 */
export const actionById = (id) => {
  const key = String(id == null ? '' : id).trim()
  if (!key) return null
  if (BY_ID.has(key)) return BY_ID.get(key)
  const lower = key.toLowerCase()
  // 先按 id 找（'Fork' / 'FORK' 都该认），再走历史别名（'agree'）。
  if (BY_ID.has(lower)) return BY_ID.get(lower)
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (alias === lower) return BY_ID.get(target) || null
  }
  return null
}

/** 能当键帽的功能（顺序即弹窗候选顺序）—— keypad/keycaps.js 的 KEYCAPS 就是它派生的。 */
export const keycapActions = () => ACTIONS.filter((a) => !!a.capId)

/** 能出现在「旋钮自定义分配」下拉里的功能 —— settings-panel.jsx 的选项就是它派生的。 */
export const knobActions = () => ACTIONS.filter((a) => a.knob === true)

/** 执行上下文：控制器把手上的东西交进来，缺哪个就按缺的降级（拿不到就说拿不到）。 */
const normalizeCtx = (o) => ({
  ops: (o && o.ops) || null,
  voice: (o && o.voice) || null,
  log: (o && typeof o.log === 'function') ? o.log : defaultLog
})

const invoke = (entry, fn, ctx, phase) => {
  if (typeof fn !== 'function') return false
  const c = normalizeCtx(ctx)
  try {
    const r = fn(c)
    return r === undefined ? true : !!r
  } catch (e) {
    // 单个动作抛错不许把按键链路带崩（hid-bridge 那条路是「什么都不做」也必须活着）。
    try { c.log(`功能「${entry.id}」执行失败（${phase}）：${(e && e.message) || e}`) } catch (_) {}
    return false
  }
}

/**
 * 点一下执行（旋钮自定义手势、控制台 `__dshOmkb.actions.run(id)`）。
 *
 * **按住型动作在这里走 run，不走 press** —— 这一条踩过：`voice` 那条同时有两种界面语义，
 * 键帽/按键 = 按住说话（press/release），旋钮手势 = 没有「按住」这回事，一转/一按就是开关。
 * 若这里走 press，把「语音」分配给旋钮后第一次转动会 start，之后每次都被 `listening` 挡掉 →
 * **再也停不下来**（用户看到的就是「配了语音结果关不掉」）。所以：run = 一次性形态（= toggle）。
 * @param {string} id 动作名（含历史别名）。
 * @param {{ops?: object, voice?: object, log?: Function}} ctx 执行上下文。
 * @returns {boolean} 是否真的派发出去（不认识的动作 / 拿不到门面 → false）。
 */
export const runAction = (id, ctx) => {
  const entry = actionById(id)
  if (!entry) return false
  return invoke(entry, entry.run, ctx, 'run')
}

/** 按住型动作的「按下」；非按住型与 runAction 同义（按键/键帽分派走这条）。 */
export const pressAction = (id, ctx) => {
  const entry = actionById(id)
  if (!entry) return false
  return invoke(entry, entry.hold ? entry.press : entry.run, ctx, 'press')
}

/**
 * 按住型动作的「松开」（其余动作什么都不做）。
 * 判据与按住语义绑在一起：只有 hold 那条能收尾，别的动作按下就完成了（见 keypad/index.js）。
 * @returns {boolean} 是否真的收尾了某个动作。
 */
export const releaseAction = (id, ctx) => {
  const entry = actionById(id)
  if (!entry || typeof entry.release !== 'function') return false
  return invoke(entry, entry.release, ctx, 'release')
}
