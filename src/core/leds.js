// dsh-omkb · core/leds.js
// **灯态引擎** —— 「浏览器下发的期望灯态 + 宿主收到的结果态 ⇒ 实际写给设备的灯」。
// 从 ble.js 分拆出来：它是设备灯语（v.oai.rgbcfg / v.oai.thstatus）的**唯一出口**，
// 而「谁持有 HID 句柄」是 transport.js 的事 —— 本模块只会调 transport.writeRpc()。
//
// 分工：**浏览器**决定「哪个会话占哪颗键、平时什么颜色与状态」（它才知道会话列表），
// **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
// 也是唯一写 HID 的人）。浏览器下发的槽位带上会话 id（sid），宿主用它把事件定位到键。
//
// 三条主线（每条都带「一次只许发一条」的硬约束，**完整沿革与反证见技能 §2**）：
//   · **结果态**（失败转红 st=3 / 跑完一轮 st=2）**不会自己变回去**，直到该会话重新运行才收掉；
//   · **`st` 只报当前会话**（规则 1，见 `#currentSession`），判据压平在 `#stOfSlot` **只此一处**；
//     （「会话重新运行 → 6 槽 st 全空闲」的规则 2 自 2026-09-27 起停用，形态保留待恢复。）
//   · **三道防线**：① 同拍合并（`#pendingAgents`）② 跨拍内容去重（`#lastThstatus`）
//     ③ 结果态等浏览器那条（`#outcomeWindowMs`）。
//
// **进程要走了就把两组灯全部按灭**：设备会保留最后收到的灯效，不关就是「app 关了、键盘还亮着」。
// 两个落点：插件卸载（dispose）与**进程级退出**（Ctrl+C/SIGTERM/SIGHUP，见 ./guard.js 的 blackout
// 回调 —— 那条路常常等不到 dispose）。灭灯**必须同步写出去**，所以走 `#sendThstatus` 而不是合并
// 闸门（「exit」钩子里微任务根本不会跑）。
// ⚠ **断开连接（close）时刻意不灭灯** —— 断开随时会重连，在那里关灯只换来「重连之后黑一片」。

import { logSink } from './log.js'
import { AGENT_ST, AGENT_ST_DEFAULT, AGENT_ST_INBOUND, BLACKOUT_SLOTS } from './protocol.js'

export class LedEngine {
  #state = null
  #transport = null
  #logger
  #errorColor = 0xff0000 // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）

  // ---------- 浏览器下发的期望灯态 ----------
  // 槽位里带上会话 id（sid），宿主靠它把 agent/error 这类事件定位到具体那颗键。
  #desiredAgents = [] // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
  #slotSessions = [] // 槽位下标 → 会话 id
  /**
   * **当前会话** = 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`；客户端由
   * `src/client/utils/session-list.js` 的 `currentSessionIdIn` 算出来，随 POST /omkb/agents
   * 的 `current` 字段报上来）。
   *
   * **当前会话** = 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`；**只有浏览器算得
   * 出来** —— 由 `utils/session-list.js` 的 `currentSessionIdIn` 算出，随 `current` 字段报上来）。
   *
   * ⚠ **规则 1**：`st` 只报当前会话占的那颗键，其余槽位一律 `IDLE`，**颜色照旧**（别的会话在跑
   * 就还是蓝的，那由 `c` 说）。判据压平在 `#stOfSlot`，全项目**只此一处**。
   * （规则 2「会话重新运行 → 6 槽 st 全空闲」自 2026-09-27 起停用，形态留着待恢复。）
   *
   * ⚠ `#currentKnown` 区分两种「没有」——**缺 ≠ 空**：`false` = 老客户端压根没报这个字段 →
   * **不替它压平**（逐槽照旧，与改动前逐字节一致）；`true` + `null` = 报了、只是主视图此刻没会话
   * → 6 槽全空闲。
   *
   * 详见技能 §2「st 只报当前会话」。
   */
  #currentSession = null
  #currentKnown = false
  /**
   * 上一次**报过的真实会话 id**（`null` 报告不覆盖它）—— 只服务**日志**那一行「切会话：X → Y」。
   *
   * ⚠ 「切会话」只认**两个真实会话 id 之间**：浏览器在主视图重渲染的**间隙**会短暂报一次 `null`，
   * 把它也算变化，一次真实切换就被打成 A → null → B **两条**。所以 `null` =「不知道 / 暂时没有」，
   * 不是一次用户切换。「写不写设备」现在全由**内容**说了算，本字段不参与任何写判定。
   *
   * 详见技能 §2「`#currentSeen`」。
   */
  #currentSeen = null
  /**
   * 「同拍合并」的暂存位（三道防线的第一道，见 `#renderAgents`）。
   *
   *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
   *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
   *   `#pendingForce`    —— 这一份是不是**结论**驱动的（是则不许被内容去重挡下）
   *
   * ⚠ 同一拍里多个来源都会重画（宿主的 error/status 连着来、`allIdle` 翻转顺手唤醒亮度），
   * 逐条写 = 设备一口气收到好几条 `thstatus`（每条要切成 5 帧 63 字节的 HID 报告）。
   * 沿革见技能 §2「一次只发一条」。
   */
  #pendingAgents = null
  #agentsScheduled = false
  /**
   * 待写的这一份是不是**结论**驱动的 —— 是则**必须真发出去**，不许被内容去重挡下。
   *
   * ⚠ 结论是**事件**，不是「此刻的样子」：红色为宿主独占（浏览器那份改不动），于是同一个会话
   * 连续失败两次算出的报文**逐字节相同**，不绕过去重就是「第二次失败设备根本不知道」。
   * 只给 **error** 开口子 —— success 的颜色要等浏览器更正，且两次颜色本就不同，用不着。
   * ⚠ 跟着**内容**走（谁后到谁赢，与 `#pendingAgents` 同语义）。切会话曾是本字段的第二个来源，
   * 2026-09-27 已撤回：强制写对「内容不同 / 相同」两种下落都只能产生重复。
   *
   * 三轮取舍与反证见技能 §2「一次只发一条 → 结论不吃内容去重」。
   */
  #pendingForce = false
  /**
   * 上一次**真正写出去**的那条 `v.oai.thstatus` 长什么样（JSON 字符串，用来比对内容）。
   *
   * ⚠ 第二道防线：同拍合并只管**同一拍**，挡不住同一份内容**跨拍**被推两次（宿主结论与浏览器
   * 那份快照错开到达，内容却完全一样）。设备没必要听两遍。
   * ⚠ 只在**写成功之后**更新（失败时不动，下次同内容仍会尝试）；`resetOnDisconnect()` 清空 ——
   * 「链路断了」是唯一必须忘掉「上次发过什么」的时刻（重连要重放）。
   */
  #lastThstatus = null
  /**
   * **结果态的等待窗口**（毫秒）—— 结果态**不立刻下发**，先等一个窗口。
   *
   * ⚠ **为什么**：「会话状态变了」有**两条速率不同的通道** —— 宿主的事件是即时的，浏览器那份带
   * 350ms 防抖且要等列表重算，同一个物理时刻它晚 350ms 以上才到。不等就是拿**旧颜色**写一条
   * 抢跑态（实测一次「跑完一轮」设备收到 3 条，中间那条纯属抢跑）。
   * ⚠ **窗口到点 ≠ 可以写**：要先确认浏览器那条真到了（看待写内容有没有被消费掉），
   * 窗口只是「回头看一眼」的检查点 —— 取值因此不需要「比对方长」。一直不来由 `#outcomeMaxMs` 兜底。
   *
   * 诊断面不受影响（`#state.agents` 仍在同一拍同步更新）。0 = 立即写（`DSH_OMKB_OUTCOME_MS` 覆盖）。
   * 两轮演化与反证见技能 §2「一次只发一条 → 第三道防线」。
   */
  #outcomeWindowMs = 500
  /**
   * 等浏览器那条的**硬上限**（毫秒）—— 从**首次**开窗算起，不因期间又来结论而重排。
   *
   * 为什么必须有：「等对方」的判据对面可能**永远不来**（页面关了 / 崩了 / 被挂起）。
   * 没有上限就变成「灯一直不变」，那是用户明确反对的另一头。
   * 为什么是 2s：正常路径下浏览器那条 350ms~1s 内必到（防抖 + 渲染 + 后台节流），
   * 2s 已是「这次真的不会来了」的量级；再长只会让「页面关了」的场景更迟钝。
   * `DSH_OMKB_OUTCOME_MAX_MS` 覆盖（自检要调小，否则每节都得多等 2 秒）。
   */
  #outcomeMaxMs = 2000
  /** 当前这轮结果态**首次**开窗的时刻（0 = 没在等）。算 `#outcomeMaxMs` 的起点，**不重排**。 */
  #outcomeSince = 0
  /** 结果态窗口的定时器（null = 窗口没开）。见 #outcomeWindowMs / #deferAgentsWrite。 */
  #outcomeTimer = null
  /**
   * 槽位下标 → { sid, kind }，**结果态**（kind: 'error' | 'success'）。
   *
   * ⚠ **它不会自己过期**（2026-09-25 用户要求：「错误后不变白」）。原来的实现是 3 秒窗口，
   * 到点自动回到浏览器下发的常态；现在一直挂着，直到下面三件事之一发生：
   *   1. 该会话**重新开始运行** → 用户重试了，`clearOutcome()`（宿主 agent/status=running 驱动）；
   *   2. 该会话从槽位上消失（归档 / 关掉 / 被别的会话顶掉，见 applyAgents 的整表重建）；
   *   3. 同一颗键上来了**更新的结论**（又失败一次 / 这回跑成功了，后写覆盖先写）。
   *
   * 「到点自动消失」这件事**不能靠浏览器重新下发来替代**：失败那一刻浏览器快照里这个会话
   * 常常还写着 running（它的推送还带 350ms 防抖），拿浏览器下发的 st 当清除判据，红灯会在
   * 亮起的同一瞬间被自己的陈旧快照抹掉。清除只认宿主的 agent/status（见 applyAgents 的注释）。
   *
   * 两种表现：
   *   'error'   —— 状态码 st=3，**并且**把颜色换成红灯（用户可见的「上次失败了」）
   *   'success' —— 状态码 st=2，颜色不动（跑完了是正常态，不该抢眼的颜色）
   */
  #outcome = new Map()

  // ---------- 电源/空闲（自动调暗）----------
  #dimmed = false // 是否已因空闲而自动调暗
  #lastActivity = Date.now()
  /**
   * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
   * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
   */
  #allIdle = null
  #idleSince = 0 // 进入「全空闲」的时刻（0 = 未知）
  #dimTimer = null

  /** @param {{logger?: any, state: object}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null } = options
    this.#logger = logger
    this.#state = state
    // 结果态窗口（见 #outcomeWindowMs）：自检设 0 退回「同拍合并后立刻写」的老路径。
    const outcome = Number(process.env.DSH_OMKB_OUTCOME_MS)
    if (Number.isFinite(outcome) && outcome >= 0) this.#outcomeWindowMs = outcome
    // 等浏览器那条的硬上限（见 #outcomeMaxMs）：自检调小，否则每节都得多等 2 秒。
    const outcomeMax = Number(process.env.DSH_OMKB_OUTCOME_MAX_MS)
    if (Number.isFinite(outcomeMax) && outcomeMax > 0) this.#outcomeMaxMs = outcomeMax
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1000)
    this.#dimTimer.unref()
  }

  /** 装配后注入传输层（写灯的唯一出口）—— 构造顺序上 transport 依赖 leds 的 lightsOff，故后接。 */
  attach = (transport) => { this.#transport = transport }

  #log = (...a) => { try { this.#logger?.['info']?.(...a) } catch (e) {}; logSink.info(...a) }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a) } catch (e) {}; logSink.warn(...a) }

  // ---------- 电源：亮度 / 自动调暗 ----------
  /** 有输入活动（input.js 每次入站都报）—— 自动调暗的计时基准。 */
  markActivity = (now = Date.now()) => { this.#lastActivity = now }

  /**
   * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（input.js #bump）、会话重新开始运行（applyAgents）。
   * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
   * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
   * @returns {boolean} 是否真的从调暗状态恢复。
   */
  wake = () => {
    if (!this.#dimmed) return false
    this.#dimmed = false
    if (this.#state.brightness > 0) this.#sendBrightness(this.#state.brightness)
    this.#renderAgents()
    return true
  }

  // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
  #sendBrightness = (v) => {
    const b = Math.max(0, Math.min(1, v))
    if (b <= 0) {
      return this.#transport.writeRpc('v.oai.rgbcfg', {
        ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
        keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
      })
    }
    return this.#transport.writeRpc('v.oai.rgbcfg', {
      ambient: { e: 2, b, s: 0.4, m: 0, c: 0x304ffe },
      keys: { e: 1, b, s: 0, m: 0, c: 0xffffff }
    })
  }

  // 应用来自设置面板的配置补丁（公开给 server/：POST /omkb/config 的 handler 调它）。
  applyConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return
    if (typeof patch.brightness === 'number') {
      this.#state.brightness = Math.max(0, Math.min(1, patch.brightness))
      this.#dimmed = false
      this.markActivity()
      this.#sendBrightness(this.#state.brightness)
      this.#renderAgents()
    }
    if (typeof patch.autoDim === 'number') {
      this.#state.autoDim = Math.max(0, patch.autoDim)
      // 关掉自动调暗时如果正暗着，要立刻把灯点回来（#wake 只在真暗着时才动手）
      if (this.#state.autoDim <= 0) this.wake()
      else this.#dimmed = false
    }
  }

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  // 与 applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
  // 返回是否发生了改动。
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return false
    let changed = false
    if (typeof prefs.brightness === 'number') {
      const b = Math.max(0, Math.min(1, prefs.brightness))
      if (b !== this.#state.brightness) {
        this.#state.brightness = b
        this.#dimmed = false
        this.markActivity()
        this.#sendBrightness(b)
        this.#renderAgents()
        changed = true
      }
    }
    if (typeof prefs.autoDim === 'number') {
      const d = Math.max(0, prefs.autoDim)
      if (d !== this.#state.autoDim) {
        this.#state.autoDim = d
        if (d <= 0) this.wake()
        else this.#dimmed = false
        changed = true
      }
    }
    return changed
  }

  // 空闲自动调暗：autoDim(秒) 到了就关灯（亮度 0 = ambient 与键灯一起熄）。
  //
  // 计时基准有两条路：
  //   * 浏览器报过 allIdle（新客户端）→ 用「进入全空闲的时刻」与「最后一次按键」里较晚的那个
  //     起算。会话在跑 = 有活干，直接不关；刚敲过键盘也不关——否则会出现
  //     「到点关灯 → 一按键又亮 → 1 秒后又关」的闪烁。
  //   * 还没这份信息（老客户端 / 从未上报）→ 退回原来的「无按键活动」判据，行为与以前完全一致。
  #autoDimCheck = () => {
    if (this.#state.autoDim <= 0 || this.#dimmed || !this.#state.open) return
    if (this.#allIdle === false) return // 有会话在运行：不关灯
    const ref = Math.max(this.#lastActivity, this.#idleSince)
    if (Date.now() - ref < this.#state.autoDim * 1000) return
    this.#dimmed = true
    this.#sendBrightness(0)
    this.#renderAgents() // 灯态也要跟着压灭（否则下一次 thstatus 又把灯点亮）
    this.#log(`空闲自动调暗：关闭灯光（${this.#allIdle === true ? '所有会话空闲' : '无按键活动'} ${this.#state.autoDim}s）`)
  }

  #clampRgb = (v) => Math.max(0, Math.min(0xffffff, Math.round(Number(v) || 0)))

  #clamp01 = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  }

  /**
   * 状态码的白名单校验：**必须是整数**且在 allowed 里，否则回落到 IDLE。
   *
   * 为什么要判类型而不是只 `Number()` 一下：`Number(true) === 1`、`Number('1') === 1` ——
   * 只做数值转换的话，浏览器塞个 `true` 就能伪装成「运行中」。设备拿这个数直接分支，
   * 所以校验必须严于「能转成数字」。
   */
  #stOf = (v, allowed) => (typeof v === 'number' && Number.isInteger(v) && allowed.includes(v) ? v : AGENT_ST_DEFAULT)

  /** 浏览器报上来的状态码：只接受 IDLE/RUNNING（见 AGENT_ST_INBOUND）。 */
  #inboundSt = (v) => this.#stOf(v, AGENT_ST_INBOUND)

  /** 真正下发到设备前的兜底（此时才允许宿主叠加的 SUCCESS/ERROR）。 */
  #clampSt = (v) => this.#stOf(v, Object.values(AGENT_ST))

  // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
  // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
  //
    // 每个槽位恰好 5 个字段：id / c / b / e / st（曾经多发的 s / sk / sa 恒为 0，已删）。
    // 要加新字段，先答得出「谁产出它、谁消费它」。
  //
  // 自动调暗期间一律把 e/b 压成 0：调暗是「灯全灭」，而浏览器仍会照常推送灯态
  // （设置页打开、会话列表变化都会触发），不压的话下一次推送就把灯又点亮了。
  // st **不压**：它是语义而不是光学量，压成「空闲」会让设备以为会话跑完了。
  /**
   * 一组槽位 → 真正写给设备的参数（白名单 5 字段 + 取值范围收敛 + 调暗压灭）。
   * **不改变任何状态、不碰设备** —— 什么时候把它交出去由调用方决定。
   */
  #thstatusParams = (slots) => {
    const dimmed = this.#dimmed
    return slots.slice(0, 6).map((s, i) => ({
      id: i,
      c: this.#clampRgb(s && s.c),
      b: dimmed ? 0 : this.#clamp01(s && s.b, 0),
      e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
      st: this.#clampSt(s && s.st)
    }))
  }

  /**
   * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
   *
   * ⚠ **只有常态灯态才吃这套去重**。`force`（= **结论**，见 `#pendingForce`）为真时，
   *   内容再一样也**必须发**：结论是**一件事发生了**，「设备此刻已经是红色」并不等于「设备已经知道
   *   又失败了一次」。用户 2026-09-26 第四次报的「连续两次失败，第二次不发」就是被这条挡下的。
   * @param params - `#thstatusParams` 规范化过的 6 槽参数。
   * @param force - true = **结论**驱动（见 `#pendingForce`），跳过内容比对直接发。
   * @returns {boolean} 是否真的写了（内容没变且非结论时为 false，这不是错误）。
   */
  #writeThstatus = (params, force = false) => {
    const key = JSON.stringify(params)
    if (key === this.#lastThstatus) {
      if (!force) {
        this.#log('灯态与上次写出去的完全相同 → 跳过重复写回')
        return false
      }
      // 结论态照发 —— 这一行是给「又失败一次，终端里却什么都没有」留的证据。
      this.#log('这一条是结论态 → 内容与上次相同也照发（内容去重只挡常态灯态）')
    }
    const ok = this.#transport.writeRpc('v.oai.thstatus', params)
    if (ok) {
      this.#lastThstatus = key
    }
    return ok
  }

  /**
   * **立刻**把一组槽位写给设备（规范化 + 记诊断 + 写）。
   *
   * 只有「进程要走了」那条线该用它（`#lightsOff` 灭灯），因为那条路**必须同步**：
   *   · `dispose()` 的灭灯要排在 `close()` 之前，早一步句柄就没了；
   *   · 安全网的 `'exit'` 钩子跑在 process 退出回调里，**微任务根本不会被执行**。
   * 会话灯态走 `#renderAgents()`（同拍合并 + 内容去重），**不要**拿这个函数去写常态灯。
   *
   * 它也过内容去重（见 `#writeThstatus`）：连续两次灭灯只会写出去一条 —— 「全灭」本来就已经
   * 是设备此刻的样子。
   * @returns {boolean} 是否真的写给了设备（内容与上次相同 → false）。
   */
  #sendThstatus = (slots) => {
    if (!Array.isArray(slots)) return false
    const params = this.#thstatusParams(slots)
    this.#state.agents = params
    return this.#writeThstatus(params)
  }

  /**
   * 把灯**全部**关掉 —— 两组灯各一条指令，缺一不可。
   *
   * 为什么要主动关：灯效是**设备自己记着**的状态，BLE 链路断开并不会让它熄灭。设备会一直
   * 保持最后收到的那个画面（Agent 键亮着、氛围灯亮着），看起来就像「app 都关了，键盘还亮着」。
   *
   * 两条指令覆盖两组互不相干的灯：
   *   · `v.oai.rgbcfg` 全 0  —— 普通键背光 + 外周氛围灯；
   *   · `v.oai.thstatus` 全 0 —— Agent 键那圈灯（它**不走** rgbcfg）。
   * 只关一组就是「亮着一半」，用户照样看得出没关干净。
   *
   * **只在「进程要走了」这条线上调用，绝不在 close() 里**：断开是随时会发生的（掉线 /
   * 点「重连」/ 宿主重扫设备），在那儿关灯只会让「重连之后黑一片」（用户明确要求做出这个区别）。
   * 两个落点 ——
   *   · `dispose()`：插件卸载（宿主优雅关闭 / 重载）；
   *   · **退出安全网**（exit-guard）：Ctrl+C / SIGTERM / SIGHUP 这类进程级退出，
   *     宿主未必来得及走到 `dispose()`（见 ./guard.js 顶部「退出前必须灭灯」）。
   *
   * 幂等：重复调用只是把同一份「全灭」再写一遍，弄不坏任何状态（插件可能被卸载两次、
   * 安全网也可能在 exit 钩子上再调一次）。
   *
   * 它会让 `state.agents` 也变成全 0（`#sendThstatus` 的正常副作用）：这正是设备此刻
   * 真实的样子，也是 /omkb/state 该报的事实。**期望灯态 `#desiredAgents` 一个字节都不动**。
   * @returns {boolean} 两条指令是否真的写出去了（没连上、或内容与上次完全相同被跳过时 false）。
   */
  #lightsOff = () => {
    const dim = this.#sendBrightness(0)
    const dark = this.#sendThstatus(BLACKOUT_SLOTS)
    return dim && dark
  }

  /**
   * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫在 transport）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：上层（ble.js 的 blackout / 退出安全网）
   * 拿它当回调，自检也可以换掉它来观测「退出路径到底有没有灭灯」。
   * @returns {boolean} 是否真的写给设备了。
   */
  lightsOff = () => this.#lightsOff()

  // ---------- 期望灯态 + 结果态 ⇒ 实际灯态 ----------
  // 会话灯态的**唯一出口**：把浏览器下发的期望灯态与「上一轮跑出结论的那几颗键」叠加后写 HID。
  // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把结果态
  // 冲掉——收不收只由宿主说了算（见 #latchOutcome 与 applyAgents）。
  //
  // ⚠ **不直接写设备**：把「此刻应该是什么样」算出来存进 `#pendingAgents`，写入排到本拍末尾
  //   （微任务、同拍再多次也只是覆盖）→ 管**同拍**；跨拍的重复由 `#writeThstatus` 的**内容去重**
  //   兜住 → 管**跨拍**。两条防线各管一段，缺一不可（见技能 §2「一次只发一条」）。
  //
  // ⚠ 诊断字段（`#state.agents` / `#state.outcomes`）必须留在**同步**这一半更新：读 /omkb/state
  //   与自检的人不该被一个微任务的时序影响。**灭灯不走这里**：退出路径必须同步写。
  //
  // @param {{defer?: boolean, force?: boolean, stIdle?: boolean, stAs?: {current: (string|null), known: boolean}}} [opts]
  //   defer  - 排到结果态窗口之后（见 #deferAgentsWrite），只给结果态用。
  //   force  - 这一份是**结论** → 写出去时不吃内容去重（见 #pendingForce）。
  //   stIdle - 这份报文的 st 一律空闲（规则 2 的清除报文）。**2026-09-27 起无调用方**：
  //            `clearOutcome` 不再发清除报文，这条分支保留着以便随时恢复（见 #composeAgents）。
  //   stAs   - 「**按别的当前会话**来算这一份的 st」，只给 `applyAgents` 用：当前会话刚换人时它把
  //            这一份按**换人之前**的样子画出来，于是内容与设备手里那份逐字节相同、被内容去重
  //            挡下 —— 那条推送就一条都不写（见 applyAgents 末尾的长注释）。诊断面
  //            `#state.agents` 跟着它走是对的：那正是设备手里将会保留的那份画面。
  #renderAgents = (opts = {}) => {
    const { defer = false, force = false, stIdle = false, stAs = null } = opts || {}
    if (!this.#desiredAgents.length) return false
    const params = this.#thstatusParams(this.#composeAgents(
      stIdle,
      stAs ? stAs.current : this.#currentSession,
      stAs ? stAs.known : this.#currentKnown
    ))
    // ⚠ 下面两行**同步**更新，与「什么时候写设备」无关：读诊断面的人（GET /omkb/state、
    //   自检）不该被一个写设备的时机左右。defer 只推迟 #pendingAgents 的落地。
    this.#state.agents = params
    // 排查用：哪些键此刻挂着结果态（红/成功）、分别是哪个会话。它们是**不会自己消失**的，
    // 所以「灯的颜色没人解释」时，先来这里看是谁挂的。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }))
    this.#pendingAgents = params
    // 「是不是结论」跟着**内容**一起记（谁后到谁赢，与 #pendingAgents 同一套语义，见 #pendingForce）。
    this.#pendingForce = force
    if (defer) this.#deferAgentsWrite()
    else if (!this.#agentsScheduled) {
      this.#agentsScheduled = true
      queueMicrotask(this.#flushAgents)
    }
    return true
  }

  /** 设备（重）连后重放灯态（open() 成功时由 transport 回调）—— 空期望态时什么也不做。 */
  replayAgents = () => this.#renderAgents()

  /**
   * 把待写的那份灯态排到**一个窗口之后**（见 `#outcomeWindowMs`）—— 只给**结果态**用
   * （`#latchOutcome` / `clearOutcome`），常态灯态照旧走同拍合并后立刻写。
   *
   * 窗口内再来多少次都只是覆盖 `#pendingAgents`（谁后到谁赢，算的都是「此刻应该是什么样」），
   * 到点只写一条。**已经在窗口里就直接返回，起点不重排** —— 否则连续事件会把写入无限往后推，
   * 变成「一直不亮」。
   *
   * 窗口为 0（自检 / `DSH_OMKB_OUTCOME_MS=0`）时走的还是老路径：同拍合并后立刻写。
   * 这样「结果态延后」这件事不会把「同拍只发一条」那套既有语义搅乱。
   */
  #deferAgentsWrite = () => {
    if (this.#outcomeWindowMs <= 0) {
      if (!this.#agentsScheduled) {
        this.#agentsScheduled = true
        queueMicrotask(this.#flushAgents)
      }
      return
    }
    if (this.#outcomeTimer) return
    if (!this.#outcomeSince) this.#outcomeSince = Date.now()
    this.#outcomeTimer = setTimeout(this.#afterOutcomeWindow, this.#outcomeWindowMs)
    // 绝不因为一条灯效把进程留住（窗口到点前进程就该能走；那时灯也没人看了）。
    this.#outcomeTimer.unref?.()
  }

  /**
   * 窗口到点：**回头看一眼浏览器那条来了没有** —— 只有来了（或等过头了）才把灯写出去。
   *
   * 怎么知道它来了：**看 `#pendingAgents` 还在不在**。浏览器那条一到就走
   * `applyAgents` → `#renderAgents()`（非 defer）→ 微任务把终态写下去，这一份随即被消费掉；
   * 所以「到点后 `#pendingAgents` 还在」= 这期间没有任何东西写过灯。此刻写出去的是
   * 「旧颜色 + 新 st」，等浏览器到了还得再写一条，设备就收到两条 —— 那正是用户报的病。
   * 于是**继续等**，等到 `#outcomeMaxMs` 才认输兜底。
   *
   * ⚠ 曾经这里还比过一个「浏览器推送序号」（`#browserSeq` / `#outcomeSeq`）。反证时发现
   *   **摘掉它行为完全不变** —— 因为「浏览器推过」的充分表现就是上面那份待写内容被消费掉，
   *   序号是第二份判据、多一个可以不同步的字段。按「不留无法反证的分支」删掉了。
   */
  #afterOutcomeWindow = () => {
    this.#outcomeTimer = null
    const patientLeft = Date.now() - this.#outcomeSince < this.#outcomeMaxMs
    if (this.#pendingAgents && patientLeft) {
      this.#deferAgentsWrite()
      return
    }
    // 认输：连同窗口一起撤掉（`#flushAgents` 里的 #cancelOutcomeWindow），别留孤儿。
    this.#flushAgents()
  }


  /**
   * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
   *
   * 链路断开时 `resetOnDisconnect()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了
   * 多一行「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 open() 会重新让灯态重放出来，
   * 不会漏（`resetOnDisconnect()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
   * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
   */
  #flushAgents = () => {
    this.#agentsScheduled = false
    // 这一轮等待到此结束（灯已经有人写了）→ **窗口必须一起撤掉**（`#cancelOutcomeWindow`）：
    // 只清一半会留下**孤儿窗口**，它到点会把 flush 之后新来的那份**抢跑**写出去 = 设备收到两条
    // （用户第三次报的「点击发送后还是两条」，详见那里与 verify_blackout §8g）。
    this.#cancelOutcomeWindow()
    const params = this.#pendingAgents
    // 「是不是结论」与内容一起消费掉（同一个暂存位的两半）。
    const force = this.#pendingForce
    this.#pendingAgents = null
    this.#pendingForce = false
    if (!params) return false
    return this.#writeThstatus(params, force)
  }

  /**
   * 撤掉还没到点的结果态窗口，并清掉「这一轮从何时算起」。
   *
   * 谁清 `#outcomeSince` 谁就得清 `#outcomeTimer` —— 这两个字段是**同一件事的两半**：
   * 窗口活着 = 这一轮还在等浏览器那条。只清一个就会留下孤儿窗口，它到点时按「已经等过头了」
   * 处理，把不该写的待写内容抢跑写出去（见 `#flushAgents` 与 §8g）。
   *
   * ⚠ 这条曾经被当成「删掉也没有断言变红」的冗余代码删过一次 —— 那是**当时漏了场景**：
   *   §8f 覆盖的是「开窗后没有新的结果态变化」，而 orphan 要的是
   *   「开窗 → 浏览器那条到（flush）→ **又来一次结果态变化**（点击发送 / clearOutcome）」。
   *   §8g 补上之后，删掉它立刻红 3 条。**别再删了。**
   */
  #cancelOutcomeWindow = () => {
    if (this.#outcomeTimer) { clearTimeout(this.#outcomeTimer); this.#outcomeTimer = null }
    this.#outcomeSince = 0
  }

  /**
   * 期望灯态 + 结果态 → 6 个槽位（设备字段形态）。不改变状态、不碰设备。
   *
   * 结果态只认「此刻占着这个槽位的那个会话」：会话消失 / 换人时宁可少亮一盏，也不要把
   * 别人上一轮的失败挂到新来的会话身上（`applyAgents` 已经整表重建过，这里是出口兜底）。
   *
   * ⚠ **`st` 只报「当前会话」**（规则 1，用户 2026-09-26）—— 判据与优先级都在 `#stOfSlot`。
   * @param stIdle - true = 这份报文的 st 一律空闲（规则 2 的清除报文）。**2026-09-27 起无调用方**
   *   （`clearOutcome` 不再发清除报文）—— 保留是为了恢复规则 2 时只改一处，见 `clearOutcome`。
   * @param current - 「当前会话」用哪一个来算（默认就是此刻记账里的那个）。给 `applyAgents` 留的口子：
   *   「当前会话刚换人」时它要把同一份期望灯态**按换人之前的样子**再算一遍，好拿内容去重把那条
   *   纯 st 位移的报文挡下（见那里）。**颜色与它无关** —— 颜色只跟「谁在跑」走。
   * @param known - 「浏览器报过 current 没有」，与 `current` 配对（见 `#currentKnown`）。
   */
  #composeAgents = (stIdle = false, current = this.#currentSession, known = this.#currentKnown) => this.#desiredAgents.map((s, i) => {
    const out = this.#outcome.get(i)
    const mine = out && this.#slotSessions[i] === out.sid ? out : null
    const red = !!mine && mine.kind === 'error'
    return {
      id: i,
      st: this.#stOfSlot(i, s.st, mine, stIdle, current, known),
      // 颜色与 st 的归属**故意不同**：失败的红照旧压在那颗键上（用户要求「只动 st，颜色照旧」），
      // 哪怕它不是当前会话 —— 灯的颜色说的是「这条会话上一轮跑成什么样」。
      c: red ? this.#errorColor : s.c,
      b: s.b,
      e: s.e
    }
  })

  /**
   * 槽位 `slot` 该报什么 `st` —— **规则 1 / 规则 2 的唯一落点**。
   *
   * 两条规则在这里合成一句话：**只有「当前会话」这一颗键会报出非空闲的 st**。
   *   · `stIdle`（规则 2：一个会话重新开始运行）→ 6 槽全空闲，把设备上的旧结论一次清掉；
   *     **2026-09-27 起无调用方**（`clearOutcome` 不再发清除报文），保留以便恢复。
   *   · 浏览器**没报过**「谁是当前会话」（老客户端）→ 不知道就不压平，逐槽照旧下发
   *     （与改动前逐字节一致，见 `#currentKnown`）；
   *   · 已知当前会话 → 只有它占的那一槽可能非空闲。它没占键 / 已被归档时自然退化成「全空闲」
   *     ——这正是规则 1 说的「其它会话的为空闲」。
   * 结果态的优先级不变：失败(3) 压过成功(2)，都压过浏览器下发的常态(0/1)。
   * @param slot - 槽位下标。
   * @param desiredSt - 浏览器下发的常态状态码（只可能是 IDLE/RUNNING）。
   * @param mine - 该槽位此刻挂着的**本会话**结果态（`{sid,kind}`），没有则 null。
   * @param stIdle - 规则 2 的清除报文。
   * @param current / known - 「当前会话」的判据（默认取此刻记账里的那个，`applyAgents` 会传换人
   *   之前的那一份进来重算 —— 见 `#composeAgents`）。
   */
  #stOfSlot = (slot, desiredSt, mine, stIdle, current = this.#currentSession, known = this.#currentKnown) => {
    if (stIdle) return AGENT_ST.IDLE
    const isCurrent = typeof current === 'string' && this.#slotSessions[slot] === current
    // 「知道当前会话是谁，但它不是这一槽」→ 空闲。注意先判 isCurrent 再判 currentKnown：
    // 空槽位的 #slotSessions 是 null，而 currentSession 为 null 时 `null === null` 会误命中。
    if (known && !isCurrent) return AGENT_ST.IDLE
    if (mine) return mine.kind === 'error' ? AGENT_ST.ERROR : AGENT_ST.SUCCESS
    return desiredSt
  }

  /**
   * 某个会话这一轮跑出了结论 → 让它占的那几颗键**保持**这个结果态，直到该会话重新运行
   * （见 clearOutcome）。
   * @param sessionId - 会话 id（DSH 里 agent.id 就是会话 id）。
   * @param kind - 'error'（运行失败，**顺带把灯换成红灯**）| 'success'（正常跑完一轮，只改状态码）。
   * @returns {boolean} 是否真的命中了某个键（该会话没占键时为 false，不算异常）。
   */
  #latchOutcome = (sessionId, kind) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    const bad = kind === 'error'
    const slots = []
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i)
    if (slots.length === 0) return false // 不在侧边栏 / 还没下发过灯态 → 没有键可亮
    // 同槽位后写覆盖先写：失败之后重试成功，红灯该被成功盖掉（反过来则说明重试又失败了，
    // 那个也是新的结论）。两颗键对应同一会话时一起设。
    for (const slot of slots) this.#outcome.set(slot, { sid: sessionId, kind })
    // ⚠ 两种结论的写入时机不同，判据是「**颜色由谁定**」（详见 #outcomeWindowMs）：
    //   error 的红是**宿主独占** → 立即写（抢跑那条与浏览器那条逐字节相同，会被去重挡下）；
    //   success 要**等浏览器更正颜色** → 走窗口。
    // force（见 #pendingForce）：**只有失败**才打开内容去重的口子。两层理由：
    //   · 上面那条「两者算出来的内容相同」的对偶事实 —— 对**成功**来说颜色每次都不同
    //     （蓝→白），去重根本挡不住它、也用不着开口子；对**失败**来说内容必然相同（红是宿主
    //     独占的，其余槽位一个字节都不动），于是「又失败一次」会被静默吞掉（用户实测：
    //     连续两次发送失败，第二次终端里没有「→ 写 thstatus」）。一个结论必须让设备知道一次。
    //   · 规则 1（`st` 只报当前会话，见 #stOfSlot）让「成功不用 force」这条**更站得住**而不是
    //     更松：非当前会话的 st 恒为 0、颜色也不动，它连跑成功两次算出来的报文确实一模一样
    //     —— 而那种「重复」对设备来说**本来就是同一个画面**（规则 1 有意如此），挡掉不丢信息。
    this.#renderAgents({ defer: !bad, force: bad })
    this.#log(bad
      ? `会话运行失败 → 槽位 ${slots.join(',')} 转红灯（保持到该会话重新运行）`
      : `会话跑完一轮 → 槽位 ${slots.join(',')} 报成功（保持到该会话重新运行）`)
    return true
  }

  /**
   * 某个会话运行失败 → 让它的那颗键**一直红着**（状态码同时变 3），不再自己变回白色。
   *
   * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
   * 时发出：用户主动中断走的是另一条分支，不会转红。
   * 收掉它的唯一常规途径是「该会话重新开始运行」（clearOutcome）。
   */
  reportError = (sessionId) => this.#latchOutcome(sessionId, 'error')

  /**
   * 某个会话**正常跑完一轮** → 让它那颗键一直报 st=2（成功），颜色不动。
   *
   * 由宿主的 `agent/turn-stopping` 驱动：那是「这一轮要收尾了」的钩子，用户中断
   * （signal.aborted）与真失败（agent/error）都在它之前就 throw 掉了，走不到这一步 ——
   * 所以它天然就是「成功」的信号，不需要再去比对什么 reason。
   */
  reportSuccess = (sessionId) => this.#latchOutcome(sessionId, 'success')

  /**
   * 某个会话**重新开始运行** → 收掉它的结果态（红 / 成功）。
   *
   * 这是结果态唯一会「自己走掉」的途径，由宿主的 `agent/status`（status === 'running'）驱动：
   * 那是 agent loop 的相位变化，用户重试 = 新一轮 = 相位从 idle 变 running。
   *
   * 为什么**不**拿浏览器下发的 `st=1` 当清除判据：浏览器那份快照带 350ms 防抖，失败发生的
   * 那一刻它手里往往还写着「这个会话在跑」，把它当成「用户重试了」会让红灯刚亮就被抹掉
   * ——那正是这次要修的病（见 #outcome 的注释）。
   *
   * ⚠ **2026-09-27 用户要求：这里不发任何报文**（「clearOutcome 先不要，这个也会导致发送多条」）。
   *   在此之前它会额外发一条「6 槽 st 全空闲」的清除报文（规则 2），问题出在**时序叠加**：
   *   `agent/status=running` 在「发一条消息」与「失败后重试」时都会来，于是
   *     ① 这条清除报文（全空闲）  ② 随后的浏览器那份（蓝·st=1）
   *   一次操作设备收到两条 —— 用户在终端里看到的两行「→ 写 thstatus」正是它们。
   *
   *   现在只做**内部记账**：把结论从 `#outcome` 里撤掉（这样下一次浏览器推送重算时红灯自然
   *   消失 —— 不撤的话红灯会永远压着）。设备上的画面交给**浏览器那条推送**去更正：
   *   「一个会话重新开始运行」本来就会让会话列表变化 → 浏览器推一次 → 宿主重算（此时已无结论）
   *   → 写出正确状态。一场重试因此**只剩一条**。
   *
   *   诊断面同步（**不写设备**）：`#state.agents` 仍是设备上一份真实画面，`#state.outcomes`
   *   如实反映「结论已经收掉」。`#renderAgents` 的 `stIdle` 分支暂时无调用方（保留以便随时恢复
   *   规则 2，见 #composeAgents）。
   * @param sessionId - 会话 id。
   * @returns {boolean} 这一轮是否真的收掉了某个结果态（本来就没挂时为 false，此时什么都不做）。
   */
  clearOutcome = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    let hit = false
    for (const [slot, t] of [...this.#outcome]) {
      if (t.sid !== sessionId) continue
      this.#outcome.delete(slot)
      hit = true
    }
    // 只更新诊断面，**不渲染、不写设备**（原因见上面的注释）。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }))
    if (hit) this.#log(`会话 ${sessionId} 重新开始运行 → 收掉结果灯（不再额外发清除报文）`)
    return hit
  }

  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor, allIdle, current } 或纯数组）。
  // 公开给 server/：POST /omkb/agents 的 handler 调它。
  applyAgents = (payload) => {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.slots) ? payload.slots : null)
    if (!list) return
    // **这一份是不是一次「切会话」** —— 只用来打一行日志：写不写设备由**内容**说了算
    // （末尾那段：只有 st 该报哪颗键变了的那条一条都不写）。判据是「在两个真实会话 id 之间
    // 切换」，见 `#currentSeen`。
    let switched = false
    // 「当前会话」**换人之前**的两半判据 —— 末尾那条「只有 st 该报哪颗键变了就不额外发」要用它把
    // 同一份期望灯态按换人之前的样子再算一遍。必须在下面覆盖之前取（对照 §9 的形态守卫）。
    const prevCurrent = this.#currentSession
    const prevKnown = this.#currentKnown
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // 必须严格判定类型：Number(null) === 0 会让「字段缺失/null」被当成合法的黑色，
      // 于是红灯变成一颗看不见的灯（比报错更难查）。
      const c = payload.errorColor
      if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) this.#errorColor = c
      // 「所有会话都空闲」→ 自动调暗的计时起点；有会话重新开始运行 → 立刻把灯点回来。
      // 老客户端不发这个字段（数组形态的老请求更是没有），此时 #allIdle 保持 null = 未知，
      // 自动调暗退回「无按键活动」判据。
      if (typeof payload.allIdle === 'boolean') {
        this.#state.idle = payload.allIdle
        if (payload.allIdle !== this.#allIdle) {
          this.#allIdle = payload.allIdle
          if (payload.allIdle) this.#idleSince = Date.now()
          else { this.#idleSince = 0; this.wake() }
        }
      }
      // **谁是「当前会话」**（规则 1 的判据，见 #currentSession）：主视图正在看的那一条。
      // 判据与 errorColor 一样严格 —— 只认 `string`（会话 id）与 `null`（知道，但没有）两种形态；
      // 数字/布尔/对象这类畸形值一律当作**这次没报**处理（保持原有认知），绝不让一个坏字段
      // 把整盘 st 压成空闲。老客户端根本不发这个字段 → `#currentKnown` 保持 false →
      // 不替它压平，逐槽照旧下发（与改动前逐字节一致）。
      if (typeof payload.current === 'string' || payload.current === null) {
        const next = payload.current || null
        // 「切没切」必须在**覆盖之前**算，而且判据是「**在两个真实会话 id 之间**切换」——
        // 见 `#currentSeen`：`null` 是「主视图暂时没有会话」，把它也算成变化的话，一次真实
        // 切换会被算成两次（A → null → B），多写一条与设备已有内容逐字节相同的报文。
        // 留下那行日志是为了让现场日志自己说清「这一条是切换驱动的」，不用再靠猜。
        const prevSeen = this.#currentSeen
        switched = typeof next === 'string' && prevSeen !== null && prevSeen !== next
        if (typeof next === 'string') this.#currentSeen = next
        this.#currentKnown = true
        this.#currentSession = next
        if (switched) this.#log(`切会话：当前会话 ${prevSeen} → ${next}（内容有变才发，逐字节相同就不发 —— 见末尾注释）`)
      }
      // 诊断面（GET /omkb/state）：排查「为什么其它会话的 st 都是 0」时先看这里 ——
      // 它就是规则 1 用来挑那一颗键的判据。
      // ⚠ 两个字段必须**一起**看，`agentsCurrent` 单个字段的 `null` 是**两种**事：
      //   · `known: false` + `null` —— 浏览器**从没报过这个字段**（老客户端）→ 我们不压平；
      //   · `known: true`  + `null` —— 报过，只是主视图此刻没有会话 → 6 槽全空闲。
      // 这正是 `#currentKnown` 想分开的东西，所以**必须让它可观测**：不然现场只能靠读源码分辨
      // （与 `#state.idle` 同一条纪律：诊断面照旧同步、别让排查的人去猜）。
      this.#state.agentsCurrent = this.#currentKnown ? this.#currentSession : null
      this.#state.agentsCurrentKnown = this.#currentKnown
    }
    const desired = []
    const sessions = []
    for (let i = 0; i < 6; i++) {
      const s = list[i] || {}
      desired.push({
        st: this.#inboundSt(s.st),
        c: this.#clampRgb(s.c),
        b: this.#clamp01(s.b, 0),
        e: Math.round(Number(s.e) || 0)
      })
      sessions.push(typeof s.sid === 'string' && s.sid ? s.sid : null)
    }
    this.#desiredAgents = desired
    this.#slotSessions = sessions
    // 结果态要跟着会话走，不能跟着槽位走：会话列表重排时槽位会换人，结果态必须一起搬家，
    // 会话消失（归档 / 关掉）时则撤掉。这里整表重建，避免原地增删的边界情况。
    //
    // ⚠ 这里**不**看浏览器下发的 st：它带 350ms 防抖，失败那一刻常常还是「running」的陈旧
    //   快照（见 #outcome 的注释），拿它收结果态 = 红灯刚亮就被抹掉。收只认 agent/status。
    const next = new Map()
    for (const [, t] of this.#outcome) {
      const at = sessions.indexOf(t.sid)
      if (at !== -1 && !next.has(at)) next.set(at, t)
    }
    this.#outcome = next
    // 这条写出去就是**终态**（带着结果态 + 浏览器刚更正的颜色）：结果态窗口到点时再算一遍
    // 内容相同，会被 #writeThstatus 去重挡下；此时 #pendingAgents 也已被这一拍消费掉，
    // 窗口到点直接空转返回 —— 所以这里不需要显式去取消它（没有它行为也一样，见 #outcomeWindowMs）。
    //
    // ⚠ **「当前会话」换人本身不写设备**（用户 2026-09-27 第三次改口径：「切换 session 后，
    //   成功/错误返回又多发了一条，目标是只发一条，只发一条」）。
    //
    //   判据不是「切没切」这个事件（那条路当天走过一版 force，只能产生重复，已撤回），而是
    //   **内容**：拿**换人之前**的当前会话把同一份期望灯态再算一遍，若与设备上那份逐字节相同，
    //   就说明这条推送带来的**唯一**变化是「规则 1 该把 st 挪到哪颗键」—— 而**颜色一个字节都没动**
    //   （颜色只跟「谁在跑」走，与 current 无关，见 #composeAgents）。那种报文对设备是纯噪音：
    //   本次推送没有带来任何新画面。于是这里**按换人之前的样子重画** → 内容与设备手里那份相同
    //   → 被 #writeThstatus 的内容去重挡下 → **一条都不发**。st 的排布留到**下一次真实变化**
    //   （跑起来 / 跑完 / 失败 / 颜色变了）时一并带过去，那时 #stOfSlot 用的已经是新的当前会话。
    //
    //   代价说清楚：这期间设备上那颗键的 st 还是**上一任**当前会话的（比如它还报着 st=1「在跑」）
    //   —— 颜色始终正确，规则 1 只是**推迟**到下一次真实变化才生效。这正是用户要的取舍：
    //   「一条都不多发」优先于「切换瞬间就把 st 挪过去」。（反例都不必构造：只要某一次推送真的
    //   改了颜色 / 结果态 / 哪个会话在跑，下面这行比较就不成立，照旧立刻发一条。）
    const moved = prevKnown !== this.#currentKnown || prevCurrent !== this.#currentSession
    let stAs = null
    if (moved && this.#lastThstatus) {
      const asBefore = JSON.stringify(this.#thstatusParams(this.#composeAgents(false, prevCurrent, prevKnown)))
      if (asBefore === this.#lastThstatus) stAs = { current: prevCurrent, known: prevKnown }
    }
    if (stAs) this.#log('只有「st 该报哪颗键」变了（当前会话换人）→ 不额外发一条；下一次真实变化会把它一起带过去')
    this.#renderAgents(stAs ? { stAs } : {})
  }

  /**
   * 链路断开时属于**灯态**的那部分收尾（由 ble.js 的 close 调）：
   *   · 电量读数作废 —— 它是「这台设备的读数」，设备不在了就该如实变成「不知道」，
   *     而不是把断开前的 12% 一直挂在界面上（用户看到的就是一台没连上的键盘还有电量）；
   *   · 排着队还没写出去的灯态作废 —— 链路都没了还补写一条，只会多一行「设备未连接」的 warn；
   *   · 还没到点的结果态窗口撤掉，并忘掉「上次写出去的灯态长什么样」：链路断过之后设备那份
   *     画面不再可信（它可能自己重启过 / 被人手动改过），重连时灯态必须**真的重放一次**，
   *     不能被内容比对挡掉。重连时 open() 会重新重放灯态，所以不会漏。
   */
  resetOnDisconnect = () => {
    this.#state.battery = null
    this.#state.charging = false
    this.#pendingAgents = null
    // 「是不是结论」也一起作废：它属于被丢掉的那一份待写内容，留着会让**下一条**无关灯态
    // 平白绕过内容去重（那个暂存位的两半必须同生同灭，见 #pendingForce）。
    this.#pendingForce = false
    // 用 #cancelOutcomeWindow 而不是只清定时器：它顺手把「这轮从什么时候开始等」也归零，
    // 两个字段本来就该同生同灭（见它的注释）。
    this.#cancelOutcomeWindow()
    this.#lastThstatus = null
  }

  /** 插件卸载（进程要走了）：停掉自动调暗定时器。句柄与安全网由 transport 收尾。 */
  dispose = () => {
    if (this.#dimTimer) { clearInterval(this.#dimTimer); this.#dimTimer = null }
  }
}
