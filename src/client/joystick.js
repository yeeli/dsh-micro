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
// 这个文件只做**映射与分派**：方向 → 动作名 → 调 DshOps 的哪个方法。
// 动作本身怎么落到 DSH 上（输入机 undo/redo、layout 服务、/plan 命令通道、滚动容器）
// 全在 ./actions/index.js —— client 目录下唯一直接操作 DSH 的地方，别在这里再摸一次服务。
// 唯一不走门面的是「语音」：那是浏览器能力（Web Speech），由注进来的 voice 控制器管。

/** 四个方向（顺序即设置页弹窗的显示顺序）。 */
export const JOY_DIRS = ['up', 'right', 'down', 'left']

/** 未绑定：写进设置里的字面量（宿主 schema 是 dict<string>，不能存 null）。 */
export const JOY_NONE = 'none'

/** 已接线的系统动作名（设置页可选；显示名即存储值）。 */
export const JOY_ACTION = {
  /** 左方向默认：应用里撤销（undo）。 */
  BACK: '撤销',
  /** 右方向默认：应用里重做（redo）。 */
  FORWARD: '重做',
  SIDEBAR: '切换侧边栏',
  PLAN: '切换规划模式',
  SCROLL_BOTTOM: '滚动到底部'
}

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

/** 出厂默认映射：设置里没存过 `joystick`（或某方向缺失）时用它兜底。 */
export const JOY_DEFAULTS = {
  up: JOY_ACTION.PLAN,
  right: JOY_ACTION.FORWARD,
  down: JOY_ACTION.SIDEBAR,
  left: JOY_ACTION.BACK
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

  /**
   * @param options.ops - DshOps（DSH 功能门面，撤销/重做、侧边栏、规划模式、滚动都在它上面）。
   * @param options.voice - VoiceController（「语音」类动作直接开/关语音输入）。
   * @param options.log - 记一行日志。
   */
  constructor(options = {}) {
    const o = options || {}
    this.#ops = o.ops || null
    this.#voice = o.voice || null
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }
  }

  /** 设置页写入的映射（可残缺、可为空对象）。 */
  setMapping = (saved) => { this.#mapping = resolveJoyMapping(saved); return this.getMapping() }
  /** 当前生效的映射（未绑定为 null）。 */
  getMapping = () => ({ ...this.#mapping })
  /** 某方向绑定的动作名；未绑定 / 未知方向 = null。 */
  actionOf = (dir) => (dir && typeof this.#mapping[dir] === 'string' ? this.#mapping[dir] : null)

  /** 由 hid-bridge 在方向事件时调用：查设置映射 → 执行。 */
  handle = (dir) => {
    const name = this.actionOf(dir)
    if (!name) { this.#log(`摇杆方向「${dir}」未绑定动作，忽略`); return false }
    return this.run(name)
  }

  /** 动作名 → 执行（设置页里选了什么就执行什么）。 */
  run = (name) => {
    const action = normalizeJoyAction(name)
    if (!action) return false
    try {
      if (action === JOY_ACTION.BACK) return this.back()
      if (action === JOY_ACTION.FORWARD) return this.forward()
      if (action === JOY_ACTION.SIDEBAR) return this.toggleSidebar()
      if (action === JOY_ACTION.PLAN) return this.togglePlanMode()
      if (action === JOY_ACTION.SCROLL_BOTTOM) return this.scrollToBottom()
      if (action === 'none') return false
      if (action.indexOf('语音') !== -1) return this.toggleVoice()
      this.#log(`摇杆动作「${action}」未接线（设置页技能类动作尚未实现），忽略`)
      return false
    } catch (e) {
      this.#log(`摇杆动作「${action}」执行异常：${(e && e.message) || e}`)
      return false
    }
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
