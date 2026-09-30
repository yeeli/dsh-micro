// dsh-micro · client/src/client/keypad.js
// **按键功能**（keypad）：键码 → 动作名 → 谁来执行。这一件事的收口文件。
//
// 2026-09-26 从 keypad/ 目录收成一个文件（原来三份并排：index.js 分派器 / keycaps.js 键帽表 /
// 布局模型，后者现在搬到 utils/keycaps.js）。现在这条线上只有两处，判据是「问的是什么」：
//   本文件            —— 行为侧：这颗键**按下做什么**、界面上**显示什么**（分派器 + 键帽表）
//   ./utils/keycaps.js —— 几何侧：设备键码 ↔ 设置页里**哪一格**、合并/拆分态、出厂功能表翻译
// 布局模型之所以放 utils（2026-09-26 的目录约定「utils 放无状态工具集合」）：它是纯数据 + 纯函数，
// 不碰任何运行时，自检与探针可以直接 import 断言 —— 这正是它能住 utils 的理由。
//
// 动作键（ACT06..ACT12）分派：
//   ACT06 模式    ACT07 归档    ACT08 拒绝    ACT09 批准    ACT10 语音    ACT11 自定义    ACT12 发送
//   （ACT06 出厂是「切换 Agent 模式」，2026-09-28 之前它是「保留/FAST」那格；
//     拆分态下 ACT11 出厂未指派，见 ./utils/keycaps.js 的 MIC_CUSTOM_CODE）
//   另外每颗键都可以改派成**任意**功能（含 FORK 分叉，见 ./actions/registry.js 的总表）。
//
// 由 hid-bridge 在 /micro/state 计数变化、且 state.act 非空时调用 run(actKey)；
// **松开**时（宿主上报的 down 里没它了）调 release(actKey)。
//
// **按下、但没执行成** → 补一句顶部提示（2026-09-28，用户要求「只做 act06-12 按键」）：
// 判据全在下面的 #refuse —— 顺序是先执行、后提示（不预判），原因由门面给（`ops.lastDeny()`），
// 提示本体在 ./notice.js。
//
// 这个文件只做**语义解析**：键码 → 动作名。动作名到底怎么落到 DSH 上（发送 / 批准拒绝 / 归档 /
// 分叉）全部由 ./actions/registry.js（功能总表）经 ./actions/index.js（门面）执行 ——
// actions/ 是 client 目录下唯一直接操作 DSH 的地方，别在这里再摸一次 ctx 服务或输入机。
//
// ---------- 键帽表（原来在 keypad.js）----------
// 键帽表：设置页布局上的零件，**一颗键帽 = 一个功能**。
//
// 为什么和分派器住在一起：「键帽」同时被三处消费 —— 布局里画键与「编辑按键」弹窗列候选
// （components/ 里那两个 JSX 文件）、以及按下时解析「这颗键到底做什么」（本文件的 resolve）。
// 各写一份的后果都是同一类：界面显示 SEND、按下却还在录音。
//
// **表本身不在这里**：功能清单的真源是 `./actions/registry.js` 的 ACTIONS（用户要求「所有
// 功能按键方法放在 actions 目录下同一个文件里」）。这里只做两件事：
//   ① 把总表里**能当键帽**的那些翻译成这里要的形状（id/label/icon/action/desc）；
//   ② 记住历史别名（ACT11 曾经也是一颗 MIC 键，老存档里存着它）。
// 于是「加一颗键帽」= 在总表里加一条带 capId 的功能，不必再动这个文件。
//
// id 沿用设备动作键码（ACT06..ACT12）：历史存档里存的键帽值就是这些键码，
// 换 id 等于把所有人的老设置作废。ACT06 这颗键帽现在是「模式」（切换 Agent 预设）——
// 它在 2026-09-28 之前是「保留」（按下不执行），改动**只换行为、不动存储 id**，
// 所以老存档里的 `ACT06` 一个字都不用改（见 ./actions/registry.js 头部的 capId 分层说明）。
//
// 图标不在这里：`icon` 只是一个名字，具体路径由渲染层（components/common/ui.jsx 的 CAP_ICON）
// 按它取，免得纯 JS 模块被迫产出 JSX。名字在悬停气泡里（components/common/cap-tip.jsx），
// 键面上只有图标 —— 布局与「编辑按键」弹窗都是这样。
//
// 上面的表只是**出厂默认**：设置页里改了键帽，按下要执行的就是改后的那个功能。
// 键帽列表本身就是功能列表（模式/归档/拒绝/批准/分叉/语音/发送…），用户把麦克风键改成发送，
// 期望的就是「按下发送」——只改显示不改行为，用户看到的就是「设置不反应」。
// 所以 resolve() 先按键帽表（本文件，与设置页弹窗共用同一份）查，查不到才用出厂默认。
//
// 按住 vs 点按：**语音是按住型**（按下开始转写、松开停止），所以那个动作在 release() 里收尾
// （判据是功能总表里那条 `hold: true`）；其余动作都是按下即完成，release() 对它们什么都不做。
// 语音不是 DSH 的能力（是浏览器的 Web Speech），所以它不走 DshOps，直接用注进来的 voice 控制器。
import { keycapActions, pressAction, releaseAction, actionById } from './actions/registry.js'
import { actionSourceOf, factoryFuncOf, MIC_CUSTOM_CODE, ACTION_KEY_CODES } from './utils/keycaps.js'
// 顶部提示的「原因 id」（提示本体在 ./notice.js，由 entry.js 建成实例后注入到这里）。
// 这里只需要那个**兜底 id**：说不出理由时也要提示一句（见 #refuse）。
import { NOTICE_FALLBACK } from './notice.js'

// ==================== 键帽表 ====================

/** 未指派（拆分态那颗自定义键的初始状态）在界面上显示的字。 */
export const CUSTOM_LABEL = '自定义'

/** 「自定义」用的图标名（虚线框 + 加号，= 还没选功能）。 */
export const CUSTOM_ICON = 'custom'

/**
 * 键帽表（数组顺序 = 「编辑按键」弹窗里的显示顺序）＝ 功能总表里能当键帽的那些。
 *   action   —— 执行时的动作名（总表的 id，由本文件的 run/release 交给 actions/registry.js 执行）；
 *               `'none'` 是**明确的「什么都不做」**，与「不认识」不是一回事
 *               （2026-09-28 起 `none` 摘掉了 capId，所以它已经不当键帽了，只留在旋钮下拉里）。
 *   label    —— 键帽短名（**中文**，如「批准」「终端」）：悬停气泡的第一行，
 *               也是设置页里键帽那一格的显示名。
 *   labelKey —— 词典键（总表的 `label`，如 'act.approve'）：气泡的**第二行**（比短名长的功能名）。
 *               为什么在这里存词典键而不是现拼字符串：registry 的 `label` 本来就是词典键，
 *               放一份到这里，气泡就不必去猜「动作名 → 词典键」的换算规则（那规则不存在）。
 *   desc     —— 气泡第三行 / 弹窗里的说明。
 */
export const KEYCAPS = keycapActions().map((a) => ({
  id: a.capId,
  label: a.name,
  labelKey: a.label,
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

// ==================== 分派器 ====================

export class KeypadController {
  /**
   * 出厂「键码 → 动作」表（保留为公开字段：诊断与控制台拿它对照）。
   * 由键帽表派生 —— 两份手写的表迟早对不上，而这里的每一行都直接决定按下的行为。
   * `'none'`（明确的「什么都不做」，现只存在于旋钮下拉）不进表：
   * 写进去反而像「有个动作叫 none」。
   */
  ACTION_KEYS = Object.fromEntries(
    ACTION_KEY_CODES
      .map((id) => [id, keycapAction(id)])
      .filter(([, action]) => action && action !== 'none')
  )
  voice = null
  /** DSH 功能门面（./actions/index.js）：发送、批准/拒绝、归档、分叉都从它走。 */
  ops = null
  /** 日志（可选；功能总表执行失败时用它记一行，没给就用控制台）。 */
  log = null
  /**
   * 顶部提示（可选）：`(reasonId) => void`，由 entry.js 注入 ./notice.js 那个实例的 showKey。
   * **只对动作键（ACT06..ACT12）** 用 —— 见 #refuse，那是用户 2026-09-28 定的口径。
   */
  notice = null
  /** 设置里的键帽（键码 → 键帽 id，也就是「这颗键要当什么用」）；由 entry.js 随偏好灌入。 */
  keyMap = {}
  /** 独立麦克风键：打开时 Mic 的两颗开关各读各的，关闭时共用一颗宽键（取值链见 ./utils/keycaps.js）。 */
  micSplit = false
  /**
   * 诊断：最近几次真实按键「上报的键码 → 解析出的动作」（最多 8 条，最新的在后）。
   * 设备按键类问题排查入口：`__dshMicro.services.keypad.lastRuns`。
   * 为什么需要它：「按下没反应」有两种完全不同的原因——(a) 这个键码根本没送到浏览器
   * （那 hid.diagnose() 的 unhandled 里会有它），(b) 送到了但被解析成 null（明确设成
   * 保留 / 键码不在表里）。只看现象分不清，看这两条记录一眼就知道。
   * 每条带 edge：'press' = 按下、'release' = 松开（按住型动作靠它收尾）。
   */
  lastRuns = []

  constructor({ voice, ops, log, notice } = {}) {
    this.voice = voice || null
    this.ops = ops || null
    this.log = typeof log === 'function' ? log : null
    this.notice = typeof notice === 'function' ? notice : null
  }

  /** 偏好变化时由 entry.js 调用：键帽 + 「独立麦克风键」开关状态。 */
  setKeyMap = (actLabels, micSplit) => {
    this.keyMap = actLabels && typeof actLabels === 'object' ? actLabels : {}
    this.micSplit = !!micSplit
  }

  /**
   * 键帽 id → 动作；不认识的 id 返回 undefined（`'none'` 现在不再出现在键帽表里，
   * 那颗「保留」键帽已换成「模式」）。
   * 判据就是本文件的键帽表 —— 设置页弹窗列的候选也是同一张表，两边不可能漂移。
   */
  #capAction = (capId) => keycapAction(capId)

  /**
   * 出厂默认动作（键帽没设过、或存的值不认识时用它兜底）。
   * 判据在 ./utils/keycaps.js 的 factoryFuncOf()：出厂功能名写在 config/default.js 的
   * FACTORY_KEY_FUNCS 里，到这里已经是「动作名」了（翻译是布局那一层的事，本文件不重复认一遍键帽表）。
   * 唯一的特例：**拆分态的 ACT11 出厂是未指派的自定义键** —— 按规则它什么都不做，
   * 而不是「随便找个功能顶上」（那样用户会看到一颗他没指派过的键自己动起来）。
   * 合并态不走这条分支（两颗开关是同一颗宽键，出厂就是麦克风）。
   */
  #factoryAction = (code, split) => {
    const c = String(code || '').trim().toUpperCase()
    if (split && c === MIC_CUSTOM_CODE) return null
    return factoryFuncOf(c)
  }

  /**
   * 某键按下后要执行的动作名（只解析、不执行；自检与控制台用它查当前映射）。
   * @param {string} act 设备上报的动作键码。
   * @returns {string|null} 动作名（`'none'` = 明确保留：按下什么都不做）；
   *   **null = 认不出这个键码 / 这颗键没指派**（同样什么都不做，但原因不同 —— 见 lastRuns 诊断）。
   */
  resolve = (act) => {
    const k = String(act || '').trim().toUpperCase()
    const split = this.micSplit
    for (const src of actionSourceOf(k, split)) {
      const picked = this.keyMap ? this.keyMap[src] : null
      if (!picked) continue
      const mapped = this.#capAction(picked)
      if (mapped !== undefined) return mapped
      // 存了不认识的值：不猜，退回出厂默认（总比「按了没反应又查不出原因」强）
      break
    }
    return this.#factoryAction(k, split)
  }

  /** 记一条诊断（最多 8 条）。 */
  #note = (act, fn, edge) => {
    this.lastRuns.push({ at: Date.now(), act: String(act || '').trim().toUpperCase(), fn, edge })
    if (this.lastRuns.length > 8) this.lastRuns.shift()
  }

  /**
   * 动作分派入口（被 hid-bridge 在**按下**时调用）。
   *
   * 只做一件事：把键码解析成动作名，交给**功能总表**执行（./actions/registry.js）。
   * 那张表是「所有功能按键方法」的唯一去处 —— 这里是键码→功能名的翻译，不是功能实现：
   * 加/删一个功能只改 registry.js，这个文件一个字都不用动。
   *
   * **先执行、再提示**：功能真的跑过了、返回 false（= 没派出去）才由 #refuse 补一句顶部提示。
   * 绝不在这里做「预先判断这个键能不能用」—— 那等于拿一份猜的判据替门面做决定；
   * 能不能执行只有门面自己知道（它读的是 DSH 的服务面与当前会话）。
   */
  run = (act) => {
    const fn = this.resolve(act)
    this.#note(act, fn, 'press')
    const ops = this.ops
    // 调门面之前先记下「上一次失败」是谁 —— 调用后若换了一个对象，说明**这次**新记了一条原因。
    const before = ops && typeof ops.lastDeny === 'function' ? ops.lastDeny() : null
    const ok = pressAction(fn, { ops: this.ops, voice: this.voice, log: this.log })
    if (!ok) this.#refuse(act, fn, before)
  }

  /**
   * 「这颗键在当前页面执行不了」→ 顶部提示（用户 2026-09-28 要求：**只做动作键 ACT06..ACT12**）。
   *
   * 提示什么由门面决定：门面在拦下这次操作时会记一条原因（`ops.lastDeny()`，比如
   * 「没有当前会话」「终端插件没装」「这次弹窗要选选项」），这里读出来照原样报 ——
   * `before !== now` 就是「这一趟新记的」；没记（比如门面里某条抛错路径）就用兜底那句
   * 「当前页面不能执行这个操作」，绝不拿上次的旧原因冒充。
   *
   * 三类**不算失败**、不能提示的（否则就是拿噪音骚扰用户）：
   *   · 不在动作键里的键码 —— 用户的口径只到 ACT06..ACT12（ACTION_KEY_CODES）；
   *   · 认不出的键码 / 没指派功能（entry 为 null）——「这颗键本来就没东西」不是失败
   *     （拆分态那颗未指派的 ACT11 走的就是这条）；
   *   · 按住型（语音）—— 按住期间设备会重复上报同一次按下，重复 start 返回 false 是**正常的**。
   *   （`'none'`（明确保留）不必单独挡：它当不了键帽、也不在出厂功能表里，`resolve` 根本到不了它。）
   */
  #refuse = (act, fn, before) => {
    if (!this.notice) return
    const code = String(act || '').trim().toUpperCase()
    if (!ACTION_KEY_CODES.includes(code)) return
    const entry = actionById(fn)
    if (!entry || entry.hold) return
    const ops = this.ops
    const now = ops && typeof ops.lastDeny === 'function' ? ops.lastDeny() : null
    const reason = (now && now !== before && now.reason) ? now.reason : NOTICE_FALLBACK
    try { this.notice(reason) } catch (e) {}
  }

  /**
   * 松开分派入口（被 hid-bridge 在**松开**时调用）。
   *
   * 为什么需要它：语音是**按住说话**——按下开始转写、松开就该停。以前松开什么都不做，
   * 于是「按下开始录音、抬起不停」，只能再按一次去 toggle（用户报的 bug）。
   * 现在只有按住型的动作在这里有活干（判据是功能总表里那条 `hold: true`）；
   * 其余动作按下就完成了，松开返回 false。
   *
   * @param {string} act 松开的那个键码。
   * @returns {boolean} 是否真的收尾了某个动作。
   */
  release = (act) => {
    const fn = this.resolve(act)
    this.#note(act, fn, 'release')
    return releaseAction(fn, { ops: this.ops, voice: this.voice, log: this.log })
  }
}
