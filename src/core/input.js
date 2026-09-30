// dsh-micro · core/input.js
// **输入解析层** —— 把设备上报的一行 JSON 翻译成状态快照里的输入事实（从 ble.js 分拆出来）。
//
// 每个输入源有自己的累加计数器（见 ble.js 顶部 #state 的说明）：enc（旋钮带符号步数）、
// knobPress（旋钮按下 = 点击）、knobLong（旋钮长按，**打开本插件设置页**）、
// joyPush/joyDir（摇杆推了一次）、joyT（含回中的方向变化计数）、
// down/keyAct（当前按住的键 + 本次边沿）、keyT（每键按下次数）。浏览器据此归属事件，
// 而不是靠 t 猜 —— 靠状态字段猜事件类型是一类老 bug（旋钮/摇杆曾被当成麦克风键而触发语音）。
//
// 「长按」只有在这里算得出来：设备不报时长，只报一对边沿（见 HID_ACT），
// 而宿主是唯一看得到那两个边沿的地方（客户端 120ms 才轮询一次快照）。
//
// 分工：本层只「翻译输入」——不写设备、不认识灯态。唯一的外部动作是通知 leds.js
//   · markActivity()（有输入 = 有活动，自动调暗的计时基准）；
//   · wake()（按下任意键先把灯点回来，restoreLight=false 的摇杆除外）。
// 电量（device.status / 应答形状）也在这里认：它**插在按键链路之前并直接 return**，
// 否则会走完整条按键链路（t 自增、state.key 被冲成 null），客户端会因此记一条无主事件噪声。

import { logSink } from './log.js'
import { JOYSTICK_METHOD, parseJoystick } from './joystick.js'
import { HID_ACT, parseDeviceStatus } from './protocol.js'

/**
 * 「长按」的判定时长（ms）：旋钮按下到松开**够到它**就算长按（见 #settleKnob）。
 *
 * 与「点击」互斥：长按那一次**不计** knobPress —— 否则「长按打开设置页」会先顺带跑一次
 * 点击动作（navigate 模式先激活一个控件、custom 模式先跑一次 click 分配）。
 * 500ms 是手感阈值；设备去抖 250ms、宿主轮询 120ms，短按误判成长按在结构上不可能。
 */
export const KNOB_LONG_MS = 500

export class InputParser {
  #state = null
  #leds = null
  #logger
  #held = new Set() // 当前物理按住的键名（只有拿到 act 才会维护）
  /** 旋钮那次**待定**按压的按下时刻（0 = 没有待定的按压）。等松手才结成点击/长按，见 #settleKnob。 */
  #knobDownAt = 0
  #last = 0
  #debounceMs = 250 // 一次物理按压只计一次
  #triggerMethod = process.env.DSH_HID_METHOD || null // 可选：只响应某个 method
  #triggerKey = process.env.DSH_HID_KEY || null // 可选：只响应某个 params.k

  /** @param {{logger?: any, state: object, leds: object}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null, leds = null } = options
    this.#logger = logger
    this.#state = state
    this.#leds = leds
  }

  #log = (...a) => { try { this.#logger?.['info']?.(...a) } catch (e) {}; logSink.info(...a) }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; logSink.warn(...a) }

  // 防抖计数 + 空闲调暗恢复。restoreLight=false 时只通知计数、不写回 LED（用于摇杆这类纯输入事件，
  // 摇杆不应向键盘发回任何灯光信息）
  #bump = (label, restoreLight = true) => {
    const now = Date.now()
    // 有输入 = 有活动：自动调暗的计时基准归 leds 管（它才是灯的主人）。
    this.#leds?.markActivity?.(now)
    // 空闲调暗状态下，任意按键先恢复亮度
    if (restoreLight) this.#leds?.wake?.()
    if (now - this.#last < this.#debounceMs) return
    this.#last = now
    this.#state.t += 1
    this.#log(`HID 触发 ${this.#state.t}${label ? ' (' + label + ')' : ''}`)
  }

  // 处理一条完整的 JSON 通知行，如 {"method":"v.oai.hid","params":{"k":"AG00"}}
  handleLine = (line) => {
    // 入站帧**原样**回显：开发版照旧打终端（`console.log(line)`，**不带** [micro] 前缀）；
    // 正式版落进日志文件的 `[rx]` 级别（排查「设备到底说了什么」时只有它靠得住）。
    logSink.raw(line)
    const raw = line.trim()
    if (!raw) return
    let msg
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      this.#warn('非法 JSON 行:', raw)
      return
    }
    if (!msg || typeof msg !== 'object') return

    // ---- 设备状态（电量）：**插在按键链路之前并直接 return** ----
    // 它不是按键事件。落进下面的链路会让 t 自增、把 state.key 冲成 null，
    // 客户端就会因为这个「有 t 但没有可识别字段」的帧记一条无主事件诊断
    // （见 src/client/hid-bridge.js 的 #noteUnhandled）—— 电量一上报就报一条噪声。
    // 也刻意排在 `#triggerMethod` 过滤之前：那是调试用的「只认某个 method」开关，
    // 不该顺手把电量也挡掉。
    // 位置同样排在下面那条 `method` 守卫**之前**：我们主动问电量的应答是
    // `{"id":N,"result":{...}}`（**没有 method**），晚一步就会被守卫整条丢掉。
    const status = parseDeviceStatus(msg)
    if (status) {
      this.#state.battery = status.battery
      this.#state.charging = status.charging
      return
    }

    if (typeof msg.method !== 'string') return

    if (this.#triggerMethod && msg.method !== this.#triggerMethod) return

    const key = msg.params && msg.params.k
    if (this.#triggerKey && (!key || key !== this.#triggerKey)) return

    // ---- 按键边沿（见 HID_ACT）：按下 / 松开 / 脉冲 ----
    const keyAct = msg.params && typeof msg.params.act === 'number' ? msg.params.act : null
    this.#state.keyAct = keyAct

    // 松开**不是一个新事件**，只更新“当前按住的键”就结束（t 不变 → 客户端不会再执行一次动作）。
    // 以前没有这条分支：松手也会走完整条链路，AG 键会重复打开会话、语音键会被 toggle 两次，
    // 只是 250ms 去抖恰好遮住了大部分（按得慢就会露出来）。
    if (keyAct === HID_ACT.RELEASE) {
      if (key) { this.#held.delete(key); this.#state.down = [...this.#held] }
      // 旋钮松手 = 这次按压的**到期点**：一对边沿之间的时长只有这里能算（见 #settleKnob）。
      if (key === 'ENC') this.#settleKnob(Date.now())
      return
    }

    // 按住集合：**只有设备明确报了 act 才维护**——老固件只会报“按下”，
    // 若要它就会把键永久钉在按下态（永远收不到松开）。
    // 脉冲（旋钮转一格）是两个边沿之间的瞬时事件，没有“按住”语义，也不入集合。
    if (key && keyAct !== null && keyAct !== HID_ACT.PULSE) {
      this.#held.add(key)
      this.#state.down = [...this.#held]
    }

    // 记录具体按键：
    //   Agent 键 AG00..AG05 → 槽位 0..5
    //   动作键 ACT06..ACT12 → 动作码（'ACT07' 归档 / 'ACT08' 拒绝 / 'ACT09' 同意 /
    //     'ACT10'·'ACT11' 语音 / 'ACT12' 发送 / 'ACT06' 保留）
    this.#state.key = key || null

    // 每个键名一个累加计数器（keyT）：设置页的键盘布局靠它播「按键特效」。
    // 计数的是**按下**次数（松开在上面已经 return），所以「按一下 = +1」；
    // 为什么不用 sticky 的 key 计：它会被后续事件覆盖，两次轮询之间按下的不同键只看得到最后一个。
    if (key) {
      const map = this.#state.keyT || (this.#state.keyT = {})
      if (map[key] !== undefined || Object.keys(map).length < 64) {
        map[key] = (map[key] || 0) + 1
      }
    }

    // 旋钮（编码器）：CW(+1)/CC(-1) 累加带符号步数；旋钮按下 ENC 走下方普通按键路径
    if (key === 'ENC_CW') { this.#state.enc = (this.#state.enc || 0) + 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }
    if (key === 'ENC_CC') { this.#state.enc = (this.#state.enc || 0) - 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }

    // 摇杆：RPC `v.oai.rad`，参数 { a(角度), d(推力) } → 依角度归一化为四方向。
    // 角度→方向映射见 ./joystick.js；回中(d 低于阈值)时置 joy=null。
    if (msg.method === JOYSTICK_METHOD) {
      const j = parseJoystick(msg)
      const dir = (j && j.dir) || null
      this.#state.agent = -1
      this.#state.act = null
      const prev = this.#state.joy
      this.#state.joy = dir
      // 推力与原始角度**原样留下**（parseJoystick 已经归一化过）：只给客户端画「摇杆推到哪儿」的
      // 那张小卡片用（src/client/joystick-hud.js 的 feed）。它与事件归属**无关** —— 回中、推力不足
      // 也照样写，且**没有人拿它判「推了一次」**（那件事只由 joyPush 计数说了算，见下）。
      // 没有它就只能在卡片上画一个「按方向固定偏移」的点，看不出推多深。
      this.#state.joyD = j && Number.isFinite(j.d) ? j.d : 0
      this.#state.joyA = j && Number.isFinite(j.a) ? j.a : null
      // 摇杆是连续帧流：只有方向**发生变化**才触发一次，避免同方向持续推导致重复执行
      // 返回/前进等动作。
      //
      // joyT 是方向变化计数器，且**把回中也算作一次变化**（joy → null）。为什么必须
      // 单独计数：t 只在非空方向变化时递增，回中不改 t，于是浏览器端永远看不到
      // 「这一次推杆结束了」——它按 t 变化取状态，第二次推**同一个方向**时会拿
      // joy='left' 和上次的基线比，判成「持续推杆」而整个吞掉。有了 joyT，
      // 「推→回中→再推同向」各记一次，且帧流期间保持不变。
      if (dir !== prev) {
        this.#state.joyT = (this.#state.joyT || 0) + 1
        if (dir) {
          // 非空方向变化 = 「推了一次」。累加计数 + 记住方向，浏览器只靠这两个字段
          // 就能执行动作——即使松手发生在两次轮询之间（那时 joy 已经回中，
          // 光看 joy 会把这个动作整个丢掉）。
          this.#state.joyPush = (this.#state.joyPush || 0) + 1
          this.#state.joyDir = dir
          this.#bump('JOY_' + dir, false) // 纯输入，不写回键盘灯光
        }
      }
      return
    }

    const m = /^AG0([0-5])$/i.exec(key || '')
    const a = /^ACT(0[6-9]|1[0-2])$/i.exec(key || '')
    this.#state.agent = m ? Number(m[1]) : -1
    this.#state.act = a ? 'ACT' + a[1] : null

    // 旋钮按下：**新固件**带着边沿（act）→ 先只记住时刻，把「点击还是长按」推迟到松手那一刻
    // 结算（见 #settleKnob）。**老固件**永远收不到松开，只能按下即计一次点击（下一行）。
    // 脉冲（转到一格）不是按压，不参与判定。
    const knobPending = key === 'ENC' && keyAct !== null && keyAct !== HID_ACT.PULSE
    if (knobPending) this.#knobDownAt = Date.now()

    // 旋钮按下：单独计数。宿主 #bump 有 250ms 去抖，而设备可能按得比这快，
    // 光靠 t 会漏掉（浏览器也就没法归属这次按下）。旋转在更上面 ENC_CW/CC 分支处理。
    if (key === 'ENC' && !knobPending) this.#state.knobPress = (this.#state.knobPress || 0) + 1

    this.#bump(key || msg.method)
  }

  /**
   * 旋钮松手：把这次按压结算成**一个事实** —— 长按（knobLong）或点击（knobPress）。
   *
   * 为什么点击要推迟到松手才计数：长按必须能**撤回**它。若按下就 +1、松手再 -1，宿主轮询
   * 间隔 120ms 而长按阈值 500ms —— 减回去之前客户端早就看见并执行了那次点击动作，
   * 表现就是「长按开设置页」同时先激活了一个控件（navigate）或先跑了一次 click 分配（custom）。
   * 一对边沿换一次判定，代价是短按也等到松手才生效（与浏览器里 click 在 mouseup 触发同理）。
   *
   * 没有待定按压时（掉线重连后收到一条孤儿松开）什么都不做：宁可漏一次点击，不许凭空多一次。
   */
  #settleKnob = (now) => {
    if (!this.#knobDownAt) return
    const heldMs = now - this.#knobDownAt
    this.#knobDownAt = 0
    if (heldMs >= KNOB_LONG_MS) {
      this.#state.knobLong = (this.#state.knobLong || 0) + 1
      this.#log(`旋钮长按 ${heldMs}ms（≥ ${KNOB_LONG_MS}ms）→ 打开键盘设置页`)
      return
    }
    this.#state.knobPress = (this.#state.knobPress || 0) + 1
  }

  /** 链路断开时清掉「当前按住的键」——设备走了就不可能还有键按着。 */
  resetHeld = () => {
    this.#held.clear()
    this.#state.down = []
    // 待定的旋钮按压一起丢掉：它的「松开」永远不会来了，留着会把下一条孤儿松开
    // 算成一次超长按（凭空打开设置页）。
    this.#knobDownAt = 0
  }
}