// dsh-omkb · client/src/hid-bridge.js
// BLE/HID 桥接轮询：node-hid 运行在宿主 Node 进程，读 omkb 小键盘的按键后把
// **各输入源自己的累加计数器**暴露到同源端点 /omkb/state。这里轮询该端点并分派：
//   智能键(AG00..AG05) → 打开会话；动作键(ACT06..ACT12) → 语音/发送/同意/拒绝/归档；
//   旋钮 → enc 差值=旋转、knobPress 计数=按下（走进 ./knob.js 的模式分派）；
//   摇杆 → joyPush+joyDir（老宿主回退 joyT/joy）走进 ./joystick.js 的方向映射。
//
// ⚠️ 语音**只由显式动作**触发：动作键 ACT10/ACT11（见 ./keypad.js），或设置页里把某个
// 摇杆方向 / 旋钮手势显式绑成「语音」。这里**没有**任何「认不出来就当麦克风键」的兜底
// ——早期版本有这个兜底，于是任何客户端没能归属的事件（摇杆推完立刻松手、旋钮长按、
// 设备上其它没接线的键）都会莫名其妙打开语音输入。认不出来就只记一条诊断（diagnose()），
// 什么也不做。新增/排查键时先看 diagnose()，不要恢复任何兜底。
//
// 为什么不能靠全局计数器 t 归属事件：t 只能说明「发生过一件事」，而设备状态字段会被
// 后续事件覆盖——推完摇杆立刻松手时，轮到浏览器轮询那一刻 joy 已经回中（宿主的 t 却
// 已经加过了），于是「t 变了但没有可识别字段」被误判成麦克风键。所以：
//   enc 带符号累计（差值=步数）/ knobPress 计数 / joyPush 计数 + joyDir 最近有效方向，
//   各自独立、不受其它事件影响，也不会因为「事件在两次轮询之间开始又结束」而丢失。
//
// **设置页打开时只演示不执行**（2026-09-25）：我们的设置分区挂载期间调 enterSim()，
// 此后按键 / 旋钮 / 摇杆一律不落到控制器上，只有布局里的按压特效照演（那条走 subscribe）。
// 闸门开在「调用控制器」那一层（见 #dispatch），归属与计数器基线照常推进 —— 于是关掉设置页
// 之后不会把这段时间的操作补发出来。智能体键（AG00..AG05）与**松开收尾**都不受闸门管。
//
// **按住 vs 点按**：宿主除了各计数器，还给 `down`（当前按住的键名全量快照）+ `keyAct`（本次边沿）。
// 按下走上面的计数器通道（run()），**松开走 down 的差集**（release()）——
// 因为松开的帧 t 不变（不是事件），只有「上一帧按住、这一帧没按住」才认得出来。
// 按住型的动作（语音：按住说话、松开停止）全靠它收尾；快按（比一次轮询还快）由 #guardTap 兜。
export const HID_STATE_URL = '/omkb/state'

/**
 * 轮询间隔（ms）。300ms 是「够用但发木」的档位；提到 120ms 后按键到动作的平均延迟从
 * 一拍的 ~150ms 降到 ~60ms，设置页里那套「按键特效」也才跟得上手。
 * 走的是本机 HTTP，代价可以忽略。
 */
export const POLL_MS = 120

/** 旋钮相关的设备按键名：它们会让 t 自增，但不需要走按键分派。 */
const KNOB_KEYS = new Set(['ENC', 'ENC_CW', 'ENC_CC'])

/** 一次轮询里最多补执行几次摇杆/旋钮动作（防推力在阈值附近抖动时刷出一串动作）。 */
const MAX_CATCHUP = 3

/**
 * 快按兜底：按键「按下又松开」发生在**两次轮询之间**时，down 里从来没出现过它，
 * 也就等不到松开事件 —— 按住型的动作（语音）会开着不关。比一次轮询还快的按动
 * 本来就录不到什么，这里给一个最短停留再收尾，至少不会留下一个永不停止的录音。
 */
export const TAP_HOLD_MS = 400

export class HidBridge {
  agents = null
  /** 按键控制器（./keypad.js）：键码 → 动作。 */
  keypad = null
  knob = null
  joystick = null
  timer = null
  /** 诊断：最近几次「认不出来、被忽略」的事件（认出来的不入队）。 */
  unhandled = []
  /** 诊断：累计忽略过多少次。 */
  unhandledCount = 0
  #last = null
  #lastEnc = 0
  #lastJoy = null
  #lastJoyT = null
  #lastJoyPush = null
  #lastKnobPress = null
  /** 上一次轮询看到的「当前按住的键」集合（null = 还没建立基线）。差集就是本次松开的那几颗。 */
  #lastDown = null
  /** 快按兜底的收尾定时器（见 TAP_HOLD_MS）。 */
  #tapTimer = null
  #warned = new Set()
  /** 状态快照的订阅者（设置页的布局特效）——与动作分派无关，见 subscribe()。 */
  #subs = new Set()
  /** 「只演示不执行」的闸门深度（0 = 正常工作）；设置页打开我们的分区时由它持有，见 enterSim()。 */
  #sim = 0

  // 注意：这里**不收** voice。语音只能由显式动作（ACT10/ACT11 或设置页里绑定的动作）
  // 触发，桥接层拿不到也不该拿到语音控制器——少一条隐式通路，就少一类误触发。
  constructor({ agents, keypad, knob, joystick } = {}) {
    this.agents = agents || null
    this.keypad = keypad || null
    this.knob = knob || null
    this.joystick = joystick || null
  }

  start = () => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return
    // 每次启动都重置首读基线，避免用上一次的陈旧计数制造假增量
    this.#last = null
    this.#lastEnc = 0
    this.#lastJoy = null
    this.#lastJoyT = null
    this.#lastJoyPush = null
    this.#lastKnobPress = null
    this.#lastDown = null
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(this.poll, POLL_MS)
  }

  stop = () => {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.#tapTimer) { clearTimeout(this.#tapTimer); this.#tapTimer = null }
    this.#lastDown = null
  }

  /**
   * 订阅状态快照：每次轮询拿到 /omkb/state 后广播一次（**不管有没有事件**）。
   * 用途只有一个：设置页的键盘布局拿它播「按键特效 / 摇杆推拉」——那是纯视觉，
   * 绝不能掺进上面的动作分派里（分派路径必须保持「认不出来就什么都不做」）。
   * 消费者自己比对 keyT / joy 的差值即可，这里不做任何判断。
   * @param fn - 收到快照的回调。
   * @returns 取消订阅的函数。
   */
  subscribe = (fn) => {
    if (typeof fn !== 'function') return () => {}
    this.#subs.add(fn)
    return () => { this.#subs.delete(fn) }
  }

  // ---------------------------------------------------------------------------
  // 「只演示不执行」：设置页（我们的分区）打开时，设备照样被读、布局照样演，
  // 但**按键 / 旋钮 / 摇杆一律不落到控制器上** —— 用户在设置页里试按键，不该真的
  // 切会话、切规划模式、发消息、批准审批（用户 2026-09-25 要求）。
  //
  // 为什么闸门开在「调用控制器」那一层，而不是在 poll() 开头整段跳过：事件的归属与
  // 各输入源的计数器基线**必须照常推进**（见 #dispatch）。智能体键（AG00..AG05）
  // **不受闸门管**：按下去仍然真的打开会话（用户明确要求的一部分）。
  // ---------------------------------------------------------------------------

  /** 当前是否处于「只演示不执行」（诊断与自检读它）。 */
  get simulating() { return this.#sim > 0 }

  /**
   * 进入「只演示不执行」，返回**释放函数**（幂等）。
   * 用深度计数而不是布尔：持有者可能不止一个，`useEffect(() => hid.enterSim(), [])`
   * 的清理函数正好就是那个释放函数 —— 挂载进、卸载出，天然成对。
   * @returns {() => void} 释放（重复调用无副作用）。
   */
  enterSim = () => {
    this.#sim += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.#sim = Math.max(0, this.#sim - 1)
    }
  }

  /**
   * 真实动作的唯一出口 —— **闸门落下时（simulating）这里什么都不做**。
   *
   * 为什么基线要照常推进：enc / knobPress / joyPush / t 都是**累加计数器**，且每条都带
   * MAX_CATCHUP 补执行。若抑制期间让它们原地不动，关掉设置页后的第一帧就会把「在设置页里
   * 转过的圈、推过的杆、按过的键」一次性补发出去 —— 那正是用户最不想要的一幕。
   * 所以：**归属与计数照常，只有最后一跳被丢掉**。
   *
   * 松开（#release）**故意不过这道闸门**：那是给已经开着的按住型动作收尾（语音按住说话），
   * 不是「触发功能」。在这里吞掉松开，会让「在设置页里按住麦克风键再松手」留下一个
   * 永不停止的录音。
   *
   * @param fn - 真正要落地的那一跳。
   * @returns {boolean} 是否真的执行了（调用方据此决定要不要连带启动快按兜底）。
   */
  #dispatch = (fn) => {
    if (this.#sim > 0) return false
    if (typeof fn !== 'function') return false
    fn()
    return true
  }

  #emit = (s) => {
    if (!this.#subs.size) return
    for (const fn of [...this.#subs]) { try { fn(s) } catch (e) {} }
  }

  /**
   * 测试注入：把一段 /omkb/state 形状的快照直接广播给订阅者。
   * 只给自检与真机探针用（宿主没重启、手边没设备时，验「按键特效 / 摇杆推拉」不必真的按键）。
   * **它只广播**：不建立基线、不做事件归属，所以绝不会触发任何真实功能。
   */
  feed = (snap) => { this.#emit(snap || {}) }

  /** 诊断快照：出问题时先看这里（浏览器控制台 `__dshOmkb.services.hid.diagnose()`）。 */
  diagnose = () => ({
    unhandledCount: this.unhandledCount,
    unhandled: this.unhandled.slice(),
    voice: '仅显式动作（ACT10/ACT11 或设置页绑定的动作），桥接层不触发语音'
  })

  poll = () => {
    fetch(HID_STATE_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (!s || typeof s.t !== 'number') return
        // 广播给订阅者（设置页的布局特效）：放在基线与事件分派之前，
        // 这样「只是看着」的消费者永远拿得到最新快照，且不会影响下面任何判断。
        this.#emit(s)
        if (this.#last === null) { this.#baseline(s); return }

        // ---- 摇杆 / 旋钮：每次轮询都读，且各自看自己的计数器 ----
        // 不套在「t 变了」里面：这两个事件可能在两次轮询之间开始又结束，
        // 只有自己的累加计数才追得回来（详见文件头注释）。
        const tChanged = s.t !== this.#last
        // 新宿主一定带 down（数组），老宿主没有 —— 它是分辨「这次 t 自增到底是谁造成的」的钥匙。
        const hostDown = Array.isArray(s.down) ? s.down : null
        // 「松手也算一次事件」只是**老宿主**的毛病：它没有 down，分不出按下与松开，只能认出 act=0。
        // 新宿主则相反：松手的帧根本不会让 t 自增，所以「t 变了 + keyAct=0」只可能是
        // 「按下与松开都发生在两次轮询之间」—— 那一次按下必须照常执行，
        // 否则快速点一下 SEND 就静默没反应（这条以前被无条件跳过，是真的会丢按键）。
        const released = s.keyAct === 0 && hostDown === null
        // 松开分派（按住型动作靠它收尾）：必须在按键分派**之前**，且不看 tChanged ——
        // 松开的帧 t 不变，只靠 down 的差集才认得出来。
        this.#consumeReleases(s)
        const joySeen = this.#consumeJoystick(s)
        const knobSeen = this.#consumeKnob(s, tChanged, released)

        // ---- 按键：只有事件计数器前进才说明有按键事件（AG/ACT 键）----
        if (!tChanged) return
        this.#last = s.t
        if (released) return

        const slot = typeof s.agent === 'number' ? s.agent : -1
        const act = s.act || null
        if (slot >= 0 && this.agents && typeof this.agents.openSlot === 'function') {
          // 智能体键**不过闸门**：设置页打开时按 AG00..AG05 仍然真的打开会话（用户明确要求）。
          this.agents.openSlot(slot)
        } else if (act && this.keypad && typeof this.keypad.run === 'function') {
          // 设置页打开时只演示：run 被闸门吞掉 → 也不启动快按兜底（没有 run 就没有录音要收尾）
          if (this.#dispatch(() => this.keypad.run(act))) this.#guardTap(s, act)
        } else if (knobSeen || joySeen || KNOB_KEYS.has(s.key)) {
          // 旋钮/摇杆的上报同样会让 t 自增（宿主 #bump）：它们上面已经处理过了，
          // 这里只是承认这次自增有主，不是「认不出来」。
        } else {
          // 认不出来：只记诊断。**绝不做任何动作**（尤其不要碰语音）。
          this.#noteUnhandled(s)
        }
      })
      .catch(() => {})
  }

  /**
   * 松开分派：`down`（宿主给出的「当前按住的键」全量快照）的差集就是本次松开的那几颗。
   *
   * 为什么用差集而不是宿主另发一个「松开了谁」的字段：**快照即真相** ——
   * 差集天然处理「两颗键分别松开」「设备断开」这类情况，也不怕轮询漏帧（漏了也只是延后一拍）。
   * 老宿主没有 down（undefined）→ 整段跳过，行为退回引入它之前（客户端仍然兼容）。
   *
   * ⚠ 松开**不受「只演示不执行」闸门管**（见 #dispatch）：它是收尾。若在这里也吞掉，
   * 「在设置页里按住麦克风键、然后松手」就永远等不到 stop，留下一个停不下来的录音。
   */
  #consumeReleases = (s) => {
    const list = Array.isArray(s.down) ? s.down : null
    if (list === null) return
    const cur = new Set(list.filter((k) => typeof k === 'string' && k))
    const prev = this.#lastDown
    this.#lastDown = cur
    if (prev === null) return // 首读只建基线：启动前就按着的键不该补一次「松开」
    for (const k of prev) if (!cur.has(k)) this.#release(k)
  }

  #release = (key) => {
    if (!this.keypad || typeof this.keypad.release !== 'function') return
    try { this.keypad.release(key) } catch (e) {}
  }

  /**
   * 快按兜底：这次的按下**没有出现在 down 里**（按得比一次轮询还快），那就永远等不到松开。
   * 只有按住型的动作（语音）需要它 —— 给一个最短停留再收尾，不留一个永不停止的录音。
   * 判据用宿主给的 down 快照：在同一帧里，按下与「进入 down」是同一个 JSON 里的字段，
   * 所以「按下了但 down 里没有它」只可能是「已经松开了」。
   */
  #guardTap = (s, act) => {
    const held = Array.isArray(s.down) ? s.down : null
    if (held === null) return // 老宿主：没有 down，也就没有快按这回事
    const key = typeof s.key === 'string' ? s.key : null
    if (!key || held.includes(key)) return
    if (!this.keypad || typeof this.keypad.resolve !== 'function') return
    let fn = null
    try { fn = this.keypad.resolve(act) } catch (e) { return }
    if (fn !== 'voice') return
    if (this.#tapTimer) clearTimeout(this.#tapTimer)
    this.#tapTimer = setTimeout(() => {
      this.#tapTimer = null
      this.#release(key)
    }, TAP_HOLD_MS)
  }

  // 首读只建立基线：用陈旧计数制造假增量会把「上一次会话」的按键重放一遍
  #baseline = (s) => {
    this.#last = s.t
    this.#lastEnc = typeof s.enc === 'number' ? s.enc : 0
    this.#lastJoy = typeof s.joy === 'string' ? s.joy : null
    this.#lastJoyT = typeof s.joyT === 'number' ? s.joyT : null
    this.#lastJoyPush = typeof s.joyPush === 'number' ? s.joyPush : null
    this.#lastKnobPress = typeof s.knobPress === 'number' ? s.knobPress : null
  }

  /**
   * 摇杆：新宿主看 joyPush（非空方向变化计数）+ joyDir（最近一次有效方向）。
   * 这两者让「推了一下就松手」在两次轮询之间也照样执行——回中会清掉 joy，
   * 但 joyDir 记着方向、joyPush 记着次数。
   * 老宿主（没有 joyPush）退回 joyT（含回中）/ joy 的边沿检测，语义与之前一致。
   * @returns {boolean} 本次轮询是否消费了摇杆事件（供「认不出来」诊断判据使用）。
   */
  #consumeJoystick = (s) => {
    const joy = typeof s.joy === 'string' ? s.joy : null
    const joyPush = typeof s.joyPush === 'number' ? s.joyPush : null
    let seen = false

    if (joyPush !== null) {
      if (this.#lastJoyPush === null) {
        // 运行中才拿到 joyPush（宿主刚升级/重启）→ 只建立基线，不补发历史事件
        this.#lastJoyPush = joyPush
      } else if (joyPush !== this.#lastJoyPush) {
        const n = Math.max(1, Math.min(joyPush - this.#lastJoyPush, MAX_CATCHUP))
        this.#lastJoyPush = joyPush
        const dir = typeof s.joyDir === 'string' && s.joyDir ? s.joyDir : joy
        if (dir && this.joystick && typeof this.joystick.handle === 'function') {
          this.#dispatch(() => { for (let i = 0; i < n; i++) this.joystick.handle(dir) })
        }
        seen = true
      }
    } else {
      // 老宿主：没有 joyPush / joyDir
      const joyT = typeof s.joyT === 'number' ? s.joyT : null
      if (joyT !== null && this.#lastJoyT === null) {
        this.#lastJoyT = joyT
      } else if (joyT !== null) {
        if (joyT !== this.#lastJoyT) {
          this.#lastJoyT = joyT
          // 回中事件（joy=null）只推进基线，没有动作要执行
          if (joy && this.joystick && typeof this.joystick.handle === 'function') this.#dispatch(() => this.joystick.handle(joy))
          seen = true
        }
      } else if (joy !== this.#lastJoy) {
        // 连 joyT 都没有的老宿主：靠「每次轮询都刷新 joy 基线」达到同样效果
        if (joy && this.joystick && typeof this.joystick.handle === 'function') this.#dispatch(() => this.joystick.handle(joy))
        seen = true
      }
    }

    this.#lastJoy = joy
    return seen
  }

  /**
   * 旋钮：旋转看 enc 差值（带符号累计），按下看 knobPress 计数。
   * @param s - 状态快照。
   * @param tChanged - 本次轮询 t 是否自增（老宿主只有 sticky 的 key，必须靠它才能判一次）。
   * @param released - 本次事件是不是「松开」（老宿主会把松手也算成一次，得挡掉）。
   * @returns {boolean} 本次轮询是否消费了旋钮事件。
   */
  #consumeKnob = (s, tChanged, released) => {
    let seen = false

    // 旋转：enc 是带符号累计步数，差值就是这次要走的步数
    const enc = typeof s.enc === 'number' ? s.enc : this.#lastEnc
    if (enc !== this.#lastEnc) {
      const d = enc - this.#lastEnc
      this.#lastEnc = enc
      if (this.knob && typeof this.knob.step === 'function') {
        const n = Math.min(Math.abs(d), 50)
        this.#dispatch(() => { for (let i = 0; i < n; i++) this.knob.step(d > 0 ? 1 : -1) })
      }
      seen = true
    }

    const press = typeof s.knobPress === 'number' ? s.knobPress : null
    if (press !== null) {
      if (this.#lastKnobPress === null) {
        this.#lastKnobPress = press // 宿主刚升级/重启：只建立基线
      } else if (press !== this.#lastKnobPress) {
        const n = Math.max(1, Math.min(press - this.#lastKnobPress, MAX_CATCHUP))
        this.#lastKnobPress = press
        for (let i = 0; i < n; i++) this.#knobPress()
        seen = true
      }
    } else if (tChanged && !released && s.key === 'ENC') {
      // 老宿主：旋钮按下只能认 sticky 的 state.key === 'ENC'，而 sticky 只能在 t
      // 自增时判一次——否则每次轮询都会再「按」一下。released 是新宿主才有的信息，
      // 挡掉「松手也被当成一次按下」（老宿主下 released 恒为 false，行为不变）。
      this.#knobPress()
      seen = true
    }

    return seen
  }

  #knobPress = () => {
    this.#dispatch(() => { if (this.knob && typeof this.knob.press === 'function') this.knob.press() })
  }

  #noteUnhandled = (s) => {
    const rec = { at: Date.now(), t: s.t, key: s.key || null }
    this.unhandled.push(rec)
    if (this.unhandled.length > 8) this.unhandled.shift()
    this.unhandledCount += 1
    const name = rec.key || '(该帧没有按键名)'
    // 同一个键名只提醒一次，免得刷屏；要完整清单看 diagnose()
    if (!this.#warned.has(name)) {
      this.#warned.add(name)
      try { console.warn(`[omkb] 未归属的按键事件（已忽略，不会触发语音）：${name}`) } catch (e) {}
    }
  }
}
