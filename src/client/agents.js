// dsh-omkb · client/src/agents.js
// 智能体键：把 6 个物理 Agent 键（AG00..AG05）映射到 DSH 会话（智能体），
// 按每个会话的状态点亮键盘 LED（v.oai.thstatus，经 host 的 POST /omkb/agents）。
// 按键回调由 hid-bridge 触发；LED 刷新由 entry.js 的全局 effect 驱动。
//
// 槽位来源必须与侧边栏一致：`listSessions` 用 core.js 的共享可见性判据（非子代理 /
// 未归档 / 非空白会话），**亮几个灯 = 侧边栏看得见几个**。归档集合来自 workspaces
// 服务（会话摘要里没有这个字段），因此本控制器同时持有 sessions 与 workspaces。
//
// 运行失败的红色不在这里计算：客户端只负责「谁占哪颗键、平时什么颜色」，
// 失败红灯由宿主在收到 agent/error 时叠加（见 src/core/ble.js 的 reportError）。
// **那个红不会自己变回白色**（用户 2026-09-25 要求），要等该会话重新运行才收掉 ——
// 所以客户端这里也不许「顺便下发一次就把红冲掉」。这里要做的只是把每槽的会话 id
// 一起下发，宿主才定位得到该亮哪颗键。
import { archivedIdsOf, byRecency, currentSessionIdIn, visibleSessions } from './core.js'

// 槽位状态（字符串）—— **只在浏览器内部用**：给槽位的 `status` 字段与首次连接引导的图例当 key。
// 下发给设备的是**另一套**：整数状态码 `AGENT_STATE`（见下）。两套并存是有意的 ——
// 字符串这套在这里可读、可直接比较；整数那套是设备固件的线格式，改动成本高。
//
//   running — 该会话正在运行（agent loop 在跑）
//   idle    — 会话存在、当前空闲
//   empty   — 这个键没有分配会话（灯熄灭）
//   error   — 该会话运行失败（红色由宿主叠加并一直保持；这里只给引导页图例当 key）
export const AGENT_STATUS = {
  RUNNING: 'running',
  IDLE: 'idle',
  EMPTY: 'empty',
  ERROR: 'error'
}

/**
 * 下发给设备的**槽位状态码**（整数）—— 就是 v.oai.thstatus 里每个槽位的 `st`。
 *
 * 为什么是整数而不是上一版那几个字符串：设备固件要按状态分支做灯效，数值能直接当索引/位掩码，
 * 字符串还得在固件里建一张对照表。**词表必须与 src/core/ble.js 的 `AGENT_ST` 逐字一致**
 * （两边自检都会断言这两个表相等，改一边忘一边会立刻被抓出来）。
 *
 * 谁产出哪一档：
 *   IDLE / RUNNING —— **浏览器**（只有它知道会话列表和谁在跑；`pushLeds` 里算）。
 *   SUCCESS / ERROR —— **宿主**叠加（只有它收得到那条总线，也只有它说得清
 *                     「用户主动中断」和「真失败」的区别，见 src/core/index.js）。
 *                     这两个是**结果态、不会自己过期**，要等该会话重新运行才收掉。
 * 空槽位（没有分配会话）同样是 IDLE，靠 `e: 0`（灯灭）区分 —— 设备侧不需要第 5 个值。
 */
export const AGENT_STATE = {
  IDLE: 0,    // 空闲 —— 会话在、没在跑
  RUNNING: 1, // 运行 —— agent loop 在跑
  SUCCESS: 2, // 成功 —— 跑完一轮（宿主叠加，一直保持到该会话下次运行）
  ERROR: 3    // 失败 —— 跑失败了（宿主叠加，同时把灯转红；一直保持到该会话下次运行）
}

/**
 * Codex Micro 状态色（packed RGB 整数）。
 * 导出成**模块常量**（而不是只做类的实例字段）：首次连接引导里的图例要画「设备上真的会亮的
 * 颜色」，两处各写一份迟早漂移成「图例是蓝的、键盘上亮的是紫的」那种对不上。
 */
export const AGENT_COLOR_RGB = {
  working: 0x304FFE, // 蓝 —— 运行中
  idle: 0xFFFFFF,    // 白 —— 空闲
  error: 0xFF0000,   // 红 —— 运行失败（由宿主点亮并保持，直到该会话重新运行）
  off: 0x000000      // 黑 —— 关（未分配）
}

export class AgentController {
  // Codex Micro 状态色（packed RGB 整数）—— 与上面的模块常量同一份
  AGENT_COLORS = AGENT_COLOR_RGB
  sessions = null
  workspaces = null
  conversation = null
  #slots = []
  #pushTimer = null
  #allIdle = null
  // 内容级去重的账本 =「**宿主此刻持有的**那份请求体」。**只有发成功才更新**；null = 还没成功发过。
  // ⚠ 失败**不重置**它 —— 理由见 pushLeds 里的推演（清账会让「切回原状态」白发一条）。
  #lastSentBody = null
  // 跨插件服务**延迟取值**（与 actions/index.js 的 DshOps 同一套写法）：别的客户端插件
  // 晚于本插件加载，建对象时缓存下来会永远是 undefined。
  #services = () => undefined
  #log = (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }

  /** @param options.services - (name) => service（取 ctx 上的跨插件服务，如 uiWorkspace）。 */
  constructor(options = {}) {
    const o = options || {}
    if (typeof o.services === 'function') this.#services = o.services
    if (typeof o.log === 'function') this.#log = o.log
  }

  get slots() { return this.#slots }

  log = (msg) => { this.#log(msg) }
  #service = (name) => { try { return this.#services(name) } catch (e) { return undefined } }

  setSessions = (sess) => { this.sessions = sess }
  setWorkspaces = (ws) => { this.workspaces = ws }
  setConversation = (conv) => { this.conversation = conv }

  // 侧边栏可见的顶层会话，保持快照顺序（判据见 core.js：与 dsh-client-ui-workspace
  // 的 sessionVisible 逐字一致）。
  listSessions = (snapshot) => visibleSessions(snapshot, archivedIdsOf(this.workspaces))

  // 依据偏好的 agentKey 模式对会话排序（取前 6），返回 [{id,title,status}]
  buildAgentSlots = (prefs, snapshot) => {
    const mode = (prefs && prefs.agentKey) || 'recent'
    const all = this.listSessions(snapshot)
    const seen = new Set(all.map((s) => s.id))
    const toSlot = (s) => ({ id: s.id, title: s.displayTitle || s.id, status: s.running ? AGENT_STATUS.RUNNING : AGENT_STATUS.IDLE })
    const empty = () => ({ id: null, title: null, status: AGENT_STATUS.EMPTY })

    // 自定义分配：槽位号由 agentAssign 的键决定（'0'..'5' → 会话 id）。
    // 必须**按下标就位**，不能把已分配的会话依次压紧——只分配第 3 个槽时，
    // 压紧会让那个会话跑到第 1 个键上。未分配的槽位保持空。
    if (mode === 'custom') {
      const assign = (prefs && prefs.agentAssign) || {}
      const byId = (snapshot && snapshot.byId) || {}
      return [0, 1, 2, 3, 4, 5].map((i) => {
        const s = assign[i] ? byId[assign[i]] : undefined
        // 已在快照里消失 / 被归档 / 是空白会话的分配视为无效，槽位留空，
        // 否则灯会亮在一个按下去打不开任何东西的键上。
        return s && seen.has(s.id) ? toSlot(s) : empty()
      })
    }

    // recent（默认）= 侧边栏的「最新在前」；priority = 运行中的排前，同档再按最新。
    // 两者都在全量可见会话上重排，因此不会漏掉任何可见会话，也不会多出会话。
    const ordered = mode === 'priority'
      ? all.slice().sort((a, b) => ((b.running ? 1 : 0) - (a.running ? 1 : 0)) || byRecency(a, b))
      : all.slice().sort(byRecency)

    const slots = []
    for (let i = 0; i < 6; i++) slots.push(ordered[i] ? toSlot(ordered[i]) : empty())
    return slots
  }

  // 计算 + 缓存 + 推送 LED
  refresh = (prefs, snapshot) => {
    const slots = this.buildAgentSlots(prefs, snapshot)
    this.#slots = slots
    // 「所有会话都空闲」也要一起报给宿主：自动调暗（关灯）按它计时，而不是按按键活动
    // ——会话在跑说明还有活干，不该关灯；全空闲才是真正的「没事了」。
    // 没有任何可见会话时也算全空闲（灯本来就是空的，关不关都一样）。
    const all = this.listSessions(snapshot)
    const allIdle = !all.some((s) => s && s.running)
    this.#allIdle = allIdle
    // 「谁是当前会话」= 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`，
    // 见 utils/session-list.js）。**只有浏览器算得出来**，所以必须随灯态一起报给宿主 ——
    // 宿主拿它决定「6 颗键里只有哪一颗能报非空闲的 st」（规则 1，见 src/core/ble.js 的 #currentSession）。
    this.pushLeds(slots, prefs && prefs.brightness, allIdle, currentSessionIdIn(snapshot))
    return slots
  }

  /** 最近一次刷新时的「全部空闲」结论（诊断/自检用）。 */
  get allIdle() { return this.#allIdle }

  // 槽位映射 → 6 个 slot 对象，POST 给 host（宿主再把这些字段写进 v.oai.thstatus 发给键盘）。
  // 防抖合并：进入页面/列表变化时 refresh 会被连续触发多次，
  // 这里把多次调用合并成最后一次发送（350ms 内只发一次）。
  //
  // 每个槽位带两样「不是设备光学参数」的信息：
  //   sid —— 会话 id：宿主要靠它把 agent/error（运行失败）与 agent/turn-stopping
  //          （跑完一轮）定位到具体某颗键；
  //   st  —— 状态码（int，见 AGENT_STATE）：设备侧直接按它做灯效，不必反推颜色。
  //          这里只发 IDLE/RUNNING，成功/失败由宿主叠加。
  //
  // ⚠ **这里下发的 st 是「每个槽位自己的状态」，不是最终写给设备的那份**（2026-09-26 起）：
  //   「st 只报当前会话、其它会话为空闲」这条线规则（规则 1/2）由**宿主**在唯一的落笔点
  //   `#stOfSlot` 里压平 —— 一份判据住在一处，才不会出现「客户端算一半、宿主算一半」。
  //   浏览器这份保持**如实**（谁在跑就报 1），它表达的是「期望灯态」。
  //   颜色只在这里决定（失败的红色也由本表下发），宿主只负责「什么时候点亮红色、什么时候收掉」。
  // ⚠ 宿主**不看**这里下发的 st 去收回红灯：本表带 350ms 防抖，失败那一刻它常常还写着
  //   running（见 src/core/ble.js 的 #outcome）。
  //
  // 请求体里另外带两样宿主需要的信息：
  //   allIdle —— 宿主据此做「所有会话空闲 → 超时关灯」；
  //   current —— **谁是「当前会话」**（主视图正在看的那条，DSH 官方判据 retainedBy.mainView）。
  //              只有浏览器算得出来，而宿主没有它就压不平 st（规则 1）。**永远发这个字段**：
  //              `null` 是「知道，但主视图此刻没有会话」，与「老客户端压根没发」是两件事
  //              （宿主用 `#currentKnown` 区分，见那边注释）。
  //
  // ⚠ 设备契约只要这几个字段（id/c/b/e/st）。曾经还发过 s/sk/sa 三个，**从头到尾恒为 0**
  //   （没有任何一行代码给过它们别的值），2026-09-25 按用户要求删掉 —— 留着它们只会让
  //   读协议的人以为「这几个字段有用，只是暂时没接上」。要加回新字段，先想清楚谁产出。
  pushLeds = (slots, brightness, allIdle, current) => {
    const b = Math.max(0, Math.min(1, brightness == null ? 0.9 : brightness))
    const th = (slots || []).slice(0, 6).map((s, i) => {
      if (!s || !s.id) {
        // 没分配会话：灯灭（e:0）。状态码仍给 IDLE —— 设备用 e 区分「灭着的空位」。
        return { id: i, sid: null, st: AGENT_STATE.IDLE, c: 0, b: 0, e: 0 }
      }
      const running = s.status === AGENT_STATUS.RUNNING
      return {
        id: i,
        sid: s.id,
        st: running ? AGENT_STATE.RUNNING : AGENT_STATE.IDLE,
        c: running ? this.AGENT_COLORS.working : this.AGENT_COLORS.idle,
        b,
        e: 1
      }
    })
    const body = JSON.stringify({
      slots: th,
      errorColor: this.AGENT_COLORS.error,
      current: typeof current === 'string' && current ? current : null,
      // 只在拿到明确结论时上报；undefined 会让宿主把它当「未上报」（老客户端语义）。
      ...(typeof allIdle === 'boolean' ? { allIdle } : {})
    })
    if (this.#pushTimer) { clearTimeout(this.#pushTimer); this.#pushTimer = null }
    this.#pushTimer = setTimeout(() => {
      this.#pushTimer = null
      if (typeof fetch !== 'function') return
      // ---- 内容级去重（用户 2026-09-27：「切换 session 的时候发送一条 thstatus，不要多发」）----
      // 切一个会话会把 refresh 连触发几次（sessions / workspaces / scope 三路订阅 + 首屏那一次），
      // 内容相同的那些没必要再打一遍 HTTP —— 宿主那边虽然也有内容去重，但少发一次就少一次日志
      // 噪音、也少一次「看起来像多发」的误判。
      // ⚠ 判定放在**真正要发的那一刻**（而不是排定时器时）：排定时器时被覆盖掉的那些 body
      //   本来就没发出去，不能记进账本，否则「X → Y → X」这种回落会被误跳过。
      if (body === this.#lastSentBody) return
      // 账本 `#lastSentBody` 表达的是「**宿主此刻持有的样子**」，所以只有**发成功**才更新。
      //
      // ⚠ 失败时**不碰**账本 —— 这一行不是遗漏，是语义（曾经写成「失败清成 null」，是错的）。
      //   推演：账本 = A（A 上次发成功，宿主手里就是 A）→ 发 B **失败**（B 没到宿主，宿主仍是 A）
      //   → 用户又切回 A。此时
      //     · 不清账（现在）：账本还是 A，`A === A` → **跳过**，正确（宿主本来就是 A）；
      //     · 清成 null（旧写法）：`A !== null` → **又发一条 A**，而宿主手里就是 A —— 白发一条。
      //   「又发一条」正是用户 2026-09-27 要修的病，所以清账是帮倒忙。
      //   至于「失败会让同一份内容被永久跳过」—— 那担心是多余的：另一份内容 Y 的判据是
      //   `Y !== 账本`，账本里只可能躺着「上次成功的那份」，Y 永远不会被它挡住。
      //   宿主侧同处完全一致（`#writeThstatus`：`if (ok) 记账`，失败分支不碰账本）——
      //   两边同源，才不会出现「浏览器以为宿主知道、宿主其实不知道」。
      fetch('/omkb/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
      }).then(
        () => { this.#lastSentBody = body },
        () => {} // 失败：不碰账本（理由见上）
      )
    }, 350)
  }

  // Agent 键按下（slot 0..5）：打开对应会话；返回是否已处理
  //
  // ⚠ **打开会话的入口是 `uiWorkspace.openSession(id)`，不是 `sessions.open(id)`。**
  // 后者在 DSH 0.1.7-rc.2 已被删掉（`sessions` 服务面只剩 retain / using / retainInfo /
  // refreshProjections / search / fork / scope / binding），而官方入口在 uiWorkspace 上：
  // DSH 侧边栏点击会话走的正是 `ctx.uiWorkspace.openSession(id)`
  // （`SessionTarget = SessionId | SubagentAddress` → 直接给 id 字符串即可）。
  //
  // 踩过的坑（用户报「智能体键无法切换会话」）：这里以前只调 `sessions.open`，
  // 拿不到就**静默** `return false` —— 而调用方（hid-bridge）根本不看返回值，
  // 于是「按键完全没反应、且一行日志都没有」。所以现在三件事缺一不可：
  //   ① 先走官方入口 uiWorkspace.openSession；② 再退到老宿主的 sessions.open；
  //   ③ 都没有 / 抛错 → **记一行日志**再说 false，绝不静默（见 actions/index.js
  //      的 archive/fork，那两条一直就是这么写的）。
  //
  // 另：「这颗键本来没分配会话」不算失败，是正常状态（灯就是灭的），不记日志。
  openSlot = (slot) => {
    const s = this.#slots && this.#slots[slot]
    if (!s || !s.id) return false
    // 用**最新**快照复核，而不是信任按下时缓存的槽位：
    // 会话可能在按下之前被归档/清空（此时侧边栏也看不见它了），
    // 对已不可见的 id 调 open 会让 DSH 静默新建空会话（"多出新聊天"）。
    let snap = null
    try {
      snap = this.sessions && this.sessions.list ? this.sessions.list.getSnapshot() : null
    } catch (e) {
      this.log(`智能体键 ${slot}：读不到会话快照（${(e && e.message) || e}），这次按键丢弃`)
      return false
    }
    const byId = snap && snap.byId
    if (!byId || !byId[s.id]) {
      this.log(`智能体键 ${slot}：槽位里的会话已不在快照里（${s.id}），跳过`)
      return false
    }
    if (!visibleSessions(snap, archivedIdsOf(this.workspaces)).some((v) => v.id === s.id)) {
      this.log(`智能体键 ${slot}：会话已不可见（归档 / 子代理 / 空白），跳过 ${s.id}`)
      return false
    }

    // ① 官方入口（0.1.7-rc.2 起唯一正确的那条）。
    const ui = this.#service('uiWorkspace')
    if (ui && typeof ui.openSession === 'function') {
      try { ui.openSession(s.id); return true } catch (e) {
        this.log(`智能体键 ${slot}：uiWorkspace.openSession 抛错（${(e && e.message) || e}）`)
      }
    }
    // ② 老宿主退路：0.1.7-rc.2 之前 `sessions` 上有 open（现已删除）。
    if (this.sessions && typeof this.sessions.open === 'function') {
      try { this.sessions.open(s.id); return true } catch (e) {
        this.log(`智能体键 ${slot}：sessions.open 抛错（${(e && e.message) || e}）`)
      }
    }
    this.log(`智能体键 ${slot}：拿不到「打开会话」的入口（既没有 uiWorkspace.openSession，`
      + `也没有老宿主的 sessions.open），${s.id} 没能打开`)
    return false
  }
}
