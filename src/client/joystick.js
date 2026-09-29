// dsh-omkb · client/joystick.js
// 摇杆分派：宿主依 v.oai.rad 的角度把摇杆归一化为四方向（见 src/core/joystick.js），
// 经 /omkb/state 的 `joy`（当前方向）+ `joyT`（方向变化计数）上报；
// hid-bridge 检测到 joyT 前进一格后调用本控制器一次。
//
// 方向 → 动作 的映射**来自设置页**（`joystick` 字段，键 up/right/down/left、值为动作名），
// 出厂默认见 JOY_DEFAULTS：
//   左 = 撤销（undo，应用里的编辑撤销）  右 = 重做（redo，重做被撤销的编辑）
//   上 = 切换规划模式                    下 = 切换侧边栏
//
// ⚠ 动作名表 `JOY_ACTION` 与出厂映射 `JOY_DEFAULTS` 都住在 **config/default.js**（默认配置的
// 唯一声明处，用户 2026-09-26 要求把摇杆的出厂功能也收进去）；这里 import 进来之后**原样再导出**
// ——设置弹窗（components/modals/joystick.jsx）与自检过去都从本文件取它们，多一条 import 路径
// 只会多一处「从哪拿」的问题。真正的取值域说明、怎么改默认值，看 config/default.js 的 ④ 一节。
//
// 这个文件只做**映射与分派**：方向 → 动作名 → 调 DshOps 的哪个方法。
// 动作本身怎么落到 DSH 上（输入机 undo/redo、layout 服务、/plan 命令通道、滚动容器）
// 全在 ./actions/index.js —— client 目录下唯一直接操作 DSH 的地方，别在这里再摸一次服务。
// 唯一不走门面的是「语音」：那是浏览器能力（Web Speech），由注进来的 voice 控制器管。

import { JOY_ACTION, JOY_DEFAULTS } from './config/default.js'

export { JOY_ACTION, JOY_DEFAULTS }

/** 四个方向（顺序即设置页弹窗的显示顺序）。 */
export const JOY_DIRS = ['up', 'right', 'down', 'left']

/** 未绑定：写进设置里的字面量（宿主 schema 是 dict<string>，不能存 null）。 */
export const JOY_NONE = 'none'

/**
 * 一次推杆的**结果**（只在 ./. 这里定义一次）：摇杆报给提示卡片的第三行文案就是它，
 * 卡片（./joystick-hud.js）从这里 import —— 两处各写一份词表，迟早有一天对不上。
 *   ok       动作跑了
 *   unbound  这个方向没绑动作（设置页里选了「不绑定」）
 *   unwired  动作名认得，但还没接线（技能类）
 *   failed   接线了也执行了，但没生效（拿不到服务 / 没有可撤销的编辑 …）
 */
export const JOY_RESULT = { OK: 'ok', UNBOUND: 'unbound', UNWIRED: 'unwired', FAILED: 'failed' }

/**
 * 老存档里的动作名（改名前存的就是这两个词）。
 * **必须继续认**：设置里存的是动作名本身，升级后不认老值 = 摇杆左右突然失灵，
 * 而用户看到的是「设置里明明写着返回/前进」。UI 里不再展示它们，只在执行时归一化。
 */
export const JOY_LEGACY = { '返回': JOY_ACTION.BACK, '前进': JOY_ACTION.FORWARD }

/** 老动作名 → 当前动作名（不是老名字就原样返回）。 */
export const normalizeJoyAction = (name) => {
  if (typeof name !== 'string') return name
  const trimmed = name.trim()
  return JOY_LEGACY[trimmed] || trimmed
}

/**
 * 合并「设置里存的映射」与出厂默认，逐方向独立兜底。
 * 值域说明：非字符串 / 空串 / JOY_NONE 都视为「该方向不绑定」（返回 null），
 * 其余照原样使用——动作名是开放集合（含技能名），这里只做分派，不做白名单校验。
 * 老动作名（返回/前进）在这里就归一化成当前名字，于是「设置页里显示什么」与
 * 「执行时认什么」始终是同一个词（见 JOY_LEGACY）。
 * @param saved - 设置里的 joystick 值（可为 undefined/{}/残缺对象）。
 * @returns {{up: string|null, right: string|null, down: string|null, left: string|null}}
 */
export const resolveJoyMapping = (saved) => {
  const src = saved && typeof saved === 'object' ? saved : {}
  const out = {}
  for (const dir of JOY_DIRS) {
    const raw = src[dir]
    if (typeof raw !== 'string') { out[dir] = JOY_DEFAULTS[dir]; continue }
    const name = raw.trim()
    out[dir] = name === '' || name === JOY_NONE ? null : normalizeJoyAction(name)
  }
  return out
}

export class JoystickController {
  #mapping = { ...JOY_DEFAULTS }
  #ops = null
  #voice = null
  #log = null
  #onGesture = null

  /**
   * @param options.ops - DshOps（DSH 功能门面，撤销/重做、侧边栏、规划模式、滚动都在它上面）。
   * @param options.voice - VoiceController（「语音」类动作直接开/关语音输入）。
   * @param options.onGesture - 每次推杆的「方向 + 动作名 + 结果」回调（会话界面那张提示卡片要它，
   *                            见 ./joystick-hud.js）。**纯通知**：回调里抛错不影响动作是否执行。
   * @param options.log - 记一行日志。
   */
  constructor(options = {}) {
    const o = options || {}
    this.#ops = o.ops || null
    this.#voice = o.voice || null
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }
    if (typeof o.onGesture === 'function') this.#onGesture = o.onGesture
  }

  /** 设置页写入的映射（可残缺、可为空对象）。 */
  setMapping = (saved) => { this.#mapping = resolveJoyMapping(saved); return this.getMapping() }
  /** 当前生效的映射（未绑定为 null）。 */
  getMapping = () => ({ ...this.#mapping })
  /** 某方向绑定的动作名；未绑定 / 未知方向 = null。 */
  actionOf = (dir) => (dir && typeof this.#mapping[dir] === 'string' ? this.#mapping[dir] : null)

  /**
   * 换掉手势回调（entry.js 在装配 HUD 之后接上；传 null 摘掉）。
   * 用 setter 而不是构造参数，是因为装配顺序是「控制器先建、UI 段后到」。
   */
  setOnGesture = (fn) => { this.#onGesture = typeof fn === 'function' ? fn : null }

  /** 由 hid-bridge 在方向事件时调用：查设置映射 → 执行 → 报出结果（给提示卡片）。 */
  handle = (dir) => {
    const name = this.actionOf(dir)
    if (!name) {
      this.#log(`摇杆方向「${dir}」未绑定动作，忽略`)
      this.#gesture({ dir, action: null, status: JOY_RESULT.UNBOUND })
      return false
    }
    const r = this.#execute(name)
    this.#gesture({ dir, action: name, status: r.status })
    return r.ok
  }

  /** 动作名 → 执行（设置页里选了什么就执行什么）。对外仍然只回「成没成」。 */
  run = (name) => this.#execute(name).ok

  /**
   * 动作名 → **执行 + 结果**（结果只给提示卡片用，见 ./joystick-hud.js 的四种状态）。
   * 为什么要带出处：卡片第三行要如实写「未绑定 / 未接线 / 未生效」——
   * 光看 handle() 那个布尔，这三种「没成」长得一模一样，用户就分不清是没配还是坏了。
   */
  #execute = (name) => {
    const action = normalizeJoyAction(name)
    if (!action || action === JOY_NONE) return { ok: false, status: JOY_RESULT.UNBOUND }
    try {
      if (action === JOY_ACTION.BACK) return this.#result(this.back())
      if (action === JOY_ACTION.FORWARD) return this.#result(this.forward())
      if (action === JOY_ACTION.SIDEBAR) return this.#result(this.toggleSidebar())
      if (action === JOY_ACTION.PLAN) return this.#result(this.togglePlanMode())
      if (action === JOY_ACTION.SCROLL_BOTTOM) return this.#result(this.scrollToBottom())
      if (action.indexOf('语音') !== -1) return this.#result(this.toggleVoice())
      this.#log(`摇杆动作「${action}」未接线（设置页技能类动作尚未实现），忽略`)
      return { ok: false, status: JOY_RESULT.UNWIRED }
    } catch (e) {
      this.#log(`摇杆动作「${action}」执行异常：${(e && e.message) || e}`)
      return { ok: false, status: JOY_RESULT.FAILED }
    }
  }

  /** 门面方法一律回布尔：true = 干了，false = 接线了但没生效（拿不到服务 / 没东西可撤销…）。 */
  #result = (ok) => ({ ok: !!ok, status: ok ? JOY_RESULT.OK : JOY_RESULT.FAILED })

  /**
   * 报一次手势。**回调是纯通知**：它自己抛错绝不改变「动作执行了没有」这个事实
   * （卡片画不出来是小事，把好好的 undo 吃掉是大事）。
   */
  #gesture = (info) => {
    if (!this.#onGesture) return
    try { this.#onGesture(info) } catch (e) { this.#log(`提示卡片回调异常：${(e && e.message) || e}`) }
  }

  // ---------------- 已接线动作（一律转给 DshOps；拿不到门面就当没接线） ----------------

  /** 撤销当前会话输入机最近一次编辑操作。 */
  back = () => (this.#ops ? this.#ops.undo() : false)

  /** 重做最近一次被撤销的编辑操作。 */
  forward = () => (this.#ops ? this.#ops.redo() : false)

  /** 切换侧边栏。 */
  toggleSidebar = () => (this.#ops ? this.#ops.toggleSidebar() : false)

  /** 切换规划模式。 */
  togglePlanMode = () => (this.#ops ? this.#ops.togglePlan() : false)

  /** 滚到当前对话底部。 */
  scrollToBottom = () => (this.#ops ? this.#ops.scrollToBottom() : false)

  /** 语音输入开关（设置页里的「语音转写」等语音类动作）。 */
  toggleVoice = () => {
    if (this.#voice && typeof this.#voice.toggle === 'function') { this.#voice.toggle(); return true }
    return false
  }
}
