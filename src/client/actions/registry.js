// dsh-micro · client/src/actions/registry.js
// ★ 功能按键总表 ★ —— **所有**「按一下就干一件事」的功能都登记在这里，一个功能一条。
//
// 为什么要有这张表（用户原话：「将所有功能按键方法都放在 actions 目录下同一个文件内方便调用，
// 随后可以增加新功能和删除旧功能」）：
//   同一个功能会从**四个地方**被选到 / 被执行 ——
//     ① 键帽候选（components/modals/keycap.jsx）→ 写进 actLabels；
//     ② 按键分派（keypad.js）→ 按下时执行；
//     ③ 旋钮自定义分配（settings/panel.jsx 的下拉 → knob.js 执行）；
//     ④ 控制台 / 自检（`__dshMicro.actions`）。
//   四处各写一份清单，迟早漂移（本项目踩过一次：键帽显示改了、按下还是录音）。
//   现在只有这一份：**加功能 = 在 ACTIONS 里加一条；删功能 = 删掉那一条** ——
//   四个消费面自动跟着变，不必再去别处找「还有哪张表要同步」。
//
// 一条记录里的字段：
//   id     稳定标识，**会存进设置**（knobCustom 存的就是它）。改名要留 ALIASES。
//   name   键帽上的**中文短名**（模式/归档/批准/…）：只有能当键帽的功能才有。
//          2026-09-28 之前这里是英文缩写（FAST/ARCH/REJ/APPR），按用户要求全部改成中文
//          —— 它同时是「悬停提示气泡」的第一行（见 components/common/cap-tip.jsx），
//          英文缩写摆在中文界面里没人认得出。
//   icon   图标名 —— 具体路径由渲染层按它取（components/common/ui.jsx 的 CAP_ICON），
//          纯 JS 模块不产出 JSX。
//   capId  这颗功能在**键帽表**里的存储 id（actLabels 存的就是它），见下面的「沿用规则」。
//   label  设置页下拉用的词典键（config/locales.js）。**比 name 长**：气泡第二行就是它。
//   desc   一句话说清「按下会发生什么」（键帽弹窗的说明、自检的判据、气泡第三行）。
//   knob   是否出现在「旋钮自定义分配」的选项里。
//   hold   按住型：这条功能在**两种界面上语义不同**，所以三个实现都要写 ——
//            press/release = 按住说话（键帽/按键，按下开始、松开停止）；
//            run          = 一次性形态 = 开关（旋钮自定义手势没有「按住」这回事）。
//          见 voice 那一条；缺 run 的按住型功能在旋钮里会「配了没反应」。
//   run / press / release —— 实现。形参是 `{ ops, voice, log }`（控制器把手上的东西交进来），
//          这里**不自己去摸 DSH**：真正的 DSH 调用全在 ./index.js 的 DshOps 上 ——
//          本目录是「唯一直接操作 DSH 的地方」，而门面是这条规则的唯一出口。
//
// 第三方插件依赖**不在这张表里**：有些功能要靠 DSH 生态里需单独安装的其他插件才能生效，
// 但那份清单是**配置**而不是行为，已搬到 `../config/default.js` 的 PLUGIN_DEPS
// （用户 2026-09-26 要求「把默认设置参数配置都写在这个文件中…不用去检测系统了」）。
// 设置页底部那张「第三方插件」卡直接读它，**常驻显示、不做任何运行时检测**；
// 于是「某个功能要加一个第三方插件」= 改 config/default.js，不必动本文件。
//
// 同理，**每颗键出厂执行哪个功能**也是配置（`../config/default.js` 的 FACTORY_KEY_FUNCS）：
// 那张表写的就是本表里各条记录的 `id`，所以**改这里的 id = 改默认配置里要写的字**（改名要留 ALIASES）；
// 只有带 `capId` 的功能能当键帽、也才能当某颗键的出厂功能（keycapActions()）。
//
// id 沿用规则（**老存档不许作废**）：2026-09-24 之前的键帽 id 就是**设备键码**（ACT06..ACT12），
// 用户设置里存着它们；所以老功能的 capId 一律沿用键码，新功能才用动作名大写（如 FORK）。
// 同理 `agree` 是历史动作名（knobCustom 里可能存着），由 ALIASES 指回现在的 `approve`。
//
// ⚠ **capId 是存储层、id 是行为层，两者可以拆开**（2026-09-28）：ACT06 那颗键帽原来指向 `none`
// （FAST「保留」），现在指向 `mode`（模式）—— 老存档里存的是 capId `'ACT06'`，一个字都不用改，
// 行为却按用户要求换成了「切换 Agent 模式」。`none` 这条留在表尾、只摘掉 capId：
// 它仍然是旋钮下拉里的「无」，但当不了键帽（keycapActions() 按 capId 过滤）。

/** 动作执行失败的兜底日志（控制器没给 log 时用；与控制台其它日志同一前缀）。 */
const defaultLog = (msg) => { try { console.log('[micro] ' + msg) } catch (e) {} }

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
//
// 2026-09-28（用户要求）几处结构变化，读代码前先知道：
//   ① **短名全部改成中文**，并按用户给的顺序补了 11 颗新按键（键盘设置/终端/删除/新建/上传/
//      压缩/轨迹/推理±/文件夹/插件）—— 它们的出口都在门面（./index.js），拿不到入口时
//      **出声**（记一行日志 + 返回 false），不许静默。
//   ② 原来第一颗 `none`（键帽 FAST「保留」）**让位给 `mode`**：ACT06 这颗键帽从「按下什么都
//      不做」改成「切换 Agent 模式」。`none` 这条**还在**（旋钮自定义分配里的「无」要用它），
//      但**摘掉了 capId** —— 没有 capId 就当不了键帽、也就不会再出现在「编辑按键」候选里
//      （用户选的是「候选里不再有保留」）。存储 id 与功能名分开正是为此：capId 管老存档，
//      id 管行为。
//   ③ 第 12 颗 `general_settings`（「设置」/ 齿轮）是上面那颗「键盘设置」的**配对**：
//      同一份 deep-link（action.jsx 的 openSection）落到**不同的分区**。注意它**不是**
//      把 SETTINGS 那颗改成通用设置 —— 那颗的 capId 与行为都不动（老存档自动只换个图标），
//      通用设置是一条**新记录**。判断「哪颗键配哪个分区」只看 `run` 调的是哪个门面方法。
// ---------------------------------------------------------------------------
export const ACTIONS = [
  {
    id: 'mode',
    name: '模式', icon: 'mode', capId: 'ACT06',
    label: 'act.mode',
    desc: '切换 Agent 模式：在 标准 / PTC / 极简 / 创造 这几个预设之间循环（会话一旦开始跑就换不了）',
    knob: true,
    run: (c) => call(c.ops, 'cycleAgentMode')
  },
  {
    id: 'archive',
    name: '归档', icon: 'arch', capId: 'ACT07',
    label: 'act.archive',
    desc: '归档当前会话：立刻从会话列表收起，可在「已归档」里找回',
    knob: true,
    run: (c) => call(c.ops, 'archive')
  },
  {
    id: 'reject',
    name: '拒绝', icon: 'rej', capId: 'ACT08',
    label: 'act.reject',
    desc: '对当前待确认的弹窗说「不」：审批 → 拒绝；计划确认 → 拒绝执行；多步确认 → 跳过',
    knob: true,
    run: (c) => call(c.ops, 'respond', 'reject')
  },
  {
    id: 'approve',
    name: '批准', icon: 'appr', capId: 'ACT09',
    label: 'act.approve',
    desc: '对当前待确认的弹窗说「行」：审批 → 允许一次；计划确认 → 确认执行；多步确认 → 下一步',
    knob: true,
    // 历史动作名：knobCustom 里老值存的是 'agree'（见 ALIASES）。
    run: (c) => call(c.ops, 'respond', 'approve')
  },
  {
    id: 'voice',
    name: '语音', icon: 'mic', capId: 'ACT10',
    label: 'act.voice',
    desc: '语音输入：按住开始转写，松开停止',
    knob: true,
    // 同一条功能、两种界面语义，**都是用户要的**，所以分开写：
    //   键帽/按键 = 按住说话（按下 start、松开 stop，见 keypad.js 的 release）；
    //   旋钮手势 = 没有「按住」这回事，一转/一按就是开关（原 knob.js 里就是 toggle）。
    hold: true,
    press: (c) => startVoice(c.voice),
    release: (c) => stopVoice(c.voice),
    run: (c) => toggleVoice(c.voice)
  },
  {
    id: 'send',
    name: '发送', icon: 'send', capId: 'ACT12',
    label: 'act.send',
    desc: '发送当前输入',
    knob: true,
    run: (c) => call(c.ops, 'send')
  },
  {
    id: 'fork',
    name: '分叉', icon: 'fork', capId: 'FORK',
    label: 'act.fork',
    desc: '分叉当前会话：从当前这条复制出一条新的分支会话，原会话保留',
    knob: true,
    run: (c) => call(c.ops, 'fork')
  },

  // ---- 2026-09-28 新增的 12 颗（顺序就是用户列的顺序）----
  // 它们的**出口全在门面**：本文件只声明「有这个功能、图标是什么、显示成什么」，
  // 真正落到 DSH 上的调用（哪个服务、哪条 API）一律写在 ./index.js 的 DshOps 上。
  {
    // ⚠ 这条是**原来那颗「设置」**（capId 一直是 SETTINGS）。2026-09-28 用户改口径：
    //   名字改成「键盘设置」、图标从 gear 换成 keyboard —— 但**行为一字未动**（仍是本插件设置页）。
    //   所以老存档（actLabels 里存着 'SETTINGS'）里那颗键**自动变成键盘图标**，什么都不用迁移。
    //   通用设置是**另一颗新键**（下面那条 GENERAL）：两条路各走各的，别把它们合并。
    //   长按旋钮绑的就是这一条（knob: false 的由来），它指向本插件设置页 —— 语义不变。
    id: 'open_settings',
    name: '键盘设置', icon: 'keyboard', capId: 'SETTINGS',
    label: 'act.openSettings',
    desc: '打开 DSH小键盘设置页（**长按旋钮**也是它 —— 同一份深链，不会一处能开一处打不开）',
    // 仍是固定手势那条：**不进旋钮下拉**（长按旋钮已经绑定它了，再多一个下拉项只会让人以为要配）。
    knob: false,
    run: (c) => call(c.ops, 'openSettings')
  },
  {
    id: 'general_settings',
    name: '设置', icon: 'gear', capId: 'GENERAL',
    label: 'act.generalSettings',
    desc: '打开 DSH 的通用设置页（模型 / 外观那些；键盘相关的在左边那颗「键盘设置」里）',
    knob: true,
    run: (c) => call(c.ops, 'openGeneralSettings')
  },
  {
    id: 'terminal',
    name: '终端', icon: 'terminal', capId: 'TERMINAL',
    label: 'act.terminal',
    desc: '在右侧栏打开一个终端（与 DSH 自己的「新建终端」同一个标签类型）',
    knob: true,
    run: (c) => call(c.ops, 'openTerminal')
  },
  {
    id: 'clear_input',
    name: '删除', icon: 'clear', capId: 'CLEAR',
    label: 'act.clearInput',
    desc: '清空当前输入框的内容（只清草稿，不动已经发出去的消息）',
    knob: true,
    run: (c) => call(c.ops, 'clearInput')
  },
  {
    id: 'new_session',
    name: '新建', icon: 'newchat', capId: 'NEW',
    label: 'act.newSession',
    desc: '新建一个对话（在当前工作区里开一条空会话并切过去）',
    knob: true,
    run: (c) => call(c.ops, 'newSession')
  },
  {
    id: 'upload',
    name: '上传', icon: 'upload', capId: 'UPLOAD',
    label: 'act.upload',
    desc: '上传文件：弹出系统的文件选择框，选中的文件加进当前输入的附件（等同输入框左下角的「+ → 文件」）',
    knob: true,
    run: (c) => call(c.ops, 'pickUpload')
  },
  {
    id: 'compact',
    name: '压缩', icon: 'compact', capId: 'COMPACT',
    label: 'act.compact',
    desc: '压缩当前会话的上下文（走 DSH 自己的 /compact 命令）',
    knob: true,
    run: (c) => call(c.ops, 'compact')
  },
  {
    id: 'trajectory',
    name: '轨迹', icon: 'trajectory', capId: 'TRAJECTORY',
    label: 'act.trajectory',
    desc: '把当前对话切到「轨迹」视图（事件时间线；**要在设置里开启代码工作工具后才有这个视图**）',
    knob: true,
    run: (c) => call(c.ops, 'openTrajectory')
  },
  // ⚠ 2026-09-29 用户改口径：这两颗键**不再打开等级菜单**，而是直接把当前会话的推理强度
  //   升/降一档（「不用打开选项, 直接加减, 没有就提示不可用」）——出口从 reasoningStep 换成
  //   reasoningAdjust（见 ./effort.js 与门面里那一大段注释）。模型没有可调的档、或已经在
  //   最高/最低档时，**动作键上**会给一句顶部提示（分派层显示，见 client/notice.js）。
  //   ⚠ 旋钮「仅推理」模式**不受影响**：它转/按的是「打开菜单 → 移环 → 确认」那条老交互
  //     （knob.js 直接调 reasoningStep / reasoningPress，不经过这张表）。
  {
    id: 'reasoning_up',
    name: '推理+', icon: 'reasonUp', capId: 'REASON_UP',
    label: 'act.reasoningUp',
    desc: '提升推理强度：直接升一档，不打开等级菜单；模型没有可调等级时不动（动作键上会给一句提示）',
    knob: true,
    run: (c) => call(c.ops, 'reasoningAdjust', 1)
  },
  {
    id: 'reasoning_down',
    name: '推理-', icon: 'reasonDown', capId: 'REASON_DOWN',
    label: 'act.reasoningDown',
    desc: '降低推理强度：直接降一档，不打开等级菜单；模型没有可调等级时不动（动作键上会给一句提示）',
    knob: true,
    run: (c) => call(c.ops, 'reasoningAdjust', -1)
  },
  {
    id: 'open_folder',
    name: '文件夹', icon: 'folder', capId: 'FOLDER',
    label: 'act.openFolder',
    desc: '在系统的文件管理器里打开当前会话的项目文件夹（与 DSH 会话标题栏那个「打开位置」同一条路）',
    knob: true,
    run: (c) => call(c.ops, 'openFolder')
  },
  {
    id: 'plugins',
    name: '插件', icon: 'plug', capId: 'PLUGINS',
    label: 'act.plugins',
    desc: '打开 DSH 的插件管理页（中央主面板，与侧边栏里那条入口同一个页面）',
    knob: true,
    run: (c) => call(c.ops, 'openPlugins')
  },

  // ---- 以下是「旋钮自定义分配」专属（没有 capId：它们是手势语义，不是一颗键的功能）----
  {
    id: 'none',
    label: 'act.none',
    desc: '不执行任何操作（旋钮某个手势不想绑东西时选它）',
    knob: true,
    run: () => false
  },
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

/** 能当键帽的功能（顺序即弹窗候选顺序）—— keypad.js 的 KEYCAPS 就是它派生的。 */
export const keycapActions = () => ACTIONS.filter((a) => !!a.capId)

/** 能出现在「旋钮自定义分配」下拉里的功能 —— settings/panel.jsx 的选项就是它派生的。 */
export const knobActions = () => ACTIONS.filter((a) => a.knob === true)

// 这里原本有一个 pluginDependencies()：把各功能 `requires` 里声明的第三方插件摊平去重，
// 供设置页的「第三方插件」卡渲染、并用 ctx.get(service) 现场判「装没装」。
// 2026-09-26 按用户要求删掉 —— 那份清单是配置，已搬到 ../config/default.js 的 PLUGIN_DEPS，
// 由设置页直接读，**不再检测系统**（也就不需要这张表参与）。要恢复检测的话，
// 判据（ctx.get(service) 存不存在）在 git 历史里。

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
 * 点一下执行（旋钮自定义手势、控制台 `__dshMicro.actions.run(id)`）。
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
 * 判据与按住语义绑在一起：只有 hold 那条能收尾，别的动作按下就完成了（见 keypad.js）。
 * @returns {boolean} 是否真的收尾了某个动作。
 */
export const releaseAction = (id, ctx) => {
  const entry = actionById(id)
  if (!entry || typeof entry.release !== 'function') return false
  return invoke(entry, entry.release, ctx, 'release')
}
