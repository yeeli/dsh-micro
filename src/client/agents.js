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
// 失败的瞬态红灯由宿主在收到 agent/error 时叠加（见 src/core/ble.js 的 flashError）。
// 这里要做的只是把每槽的会话 id 一起下发，宿主才定位得到该亮哪颗键。
import { archivedIdsOf, byRecency, visibleSessions } from './core.js'

// 槽位状态标识（下发给宿主 payload 里每个槽位的 `st`，最终随 v.oai.thstatus 发给键盘）。
// 为什么要单独一个字段：以前「会话在跑 / 空闲」只体现在**颜色**上（蓝/白），设备只能靠
// 猜颜色反推状态；现在把状态本身显式发下去，设备侧就能自己按状态做灯效，颜色怎么调都不影响语义。
//
// 词表（浏览器只产出前三个）：
//   running — 该会话正在运行（agent loop 在跑）
//   idle    — 会话存在、当前空闲
//   empty   — 这个键没有分配会话（灯熄灭）
//   error   — 该会话刚才运行失败（**由宿主叠加**，只在红灯窗口内，见 src/core/ble.js）
export const AGENT_STATUS = {
  RUNNING: 'running',
  IDLE: 'idle',
  EMPTY: 'empty',
  ERROR: 'error'
}

/** 合法状态词表（宿主侧同名校验，两边必须一致）。 */
export const AGENT_STATUSES = [AGENT_STATUS.RUNNING, AGENT_STATUS.IDLE, AGENT_STATUS.EMPTY, AGENT_STATUS.ERROR]

/**
 * Codex Micro 状态色（packed RGB 整数）。
 * 导出成**模块常量**（而不是只做类的实例字段）：首次连接引导里的图例要画「设备上真的会亮的
 * 颜色」，两处各写一份迟早漂移成「图例是蓝的、键盘上亮的是紫的」那种对不上。
 */
export const AGENT_COLOR_RGB = {
  working: 0x304FFE, // 蓝 —— 运行中
  idle: 0xFFFFFF,    // 白 —— 空闲
  error: 0xFF0000,   // 红 —— 运行失败（瞬态：由宿主闪一下再回到空闲，见下）
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

  get slots() { return this.#slots }

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

  // 计算给定 prefs/snapshot 的槽位映射（别名，供外部按需取用）
  slotsFor = (prefs, snapshot) => this.buildAgentSlots(prefs, snapshot)

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
    this.pushLeds(slots, prefs && prefs.brightness, allIdle)
    return slots
  }

  /** 最近一次刷新时的「全部空闲」结论（诊断/自检用）。 */
  get allIdle() { return this.#allIdle }

  // 槽位映射 → v.oai.thstatus 的 6 个 slot 对象，POST 给 host。
  // 防抖合并：进入页面/列表变化时 refresh 会被连续触发多次，
  // 这里把多次调用合并成最后一次发送（350ms 内只发一次 thstatus）。
  //
  // 每个槽位带两样「不是设备光学参数」的信息：
  //   sid —— 会话 id：宿主要靠它把 agent/error（运行失败）定位到具体某颗键；
  //   st  —— 状态标识（running/idle/empty）：宿主要靠它区分「空闲白」和「没有会话的黑」，
  //          也是发给设备的语义字段（error 态由宿主在红灯窗口内覆盖成 'error'）。
  // 颜色只在这里决定（失败的红色也由本表下发），宿主只负责「什么时候临时换成红色」。
  //
  // 请求体里另外带 `allIdle`：宿主据此做「所有会话空闲 → 超时关灯」。
  pushLeds = (slots, brightness, allIdle) => {
    const b = Math.max(0, Math.min(1, brightness == null ? 0.9 : brightness))
    const th = (slots || []).slice(0, 6).map((s, i) => {
      if (!s || !s.id) {
        return { id: i, sid: null, st: AGENT_STATUS.EMPTY, c: 0, b: 0, e: 0, s: 0, sk: 0, sa: 0 }
      }
      const running = s.status === AGENT_STATUS.RUNNING
      return {
        id: i,
        sid: s.id,
        st: running ? AGENT_STATUS.RUNNING : AGENT_STATUS.IDLE,
        c: running ? this.AGENT_COLORS.working : this.AGENT_COLORS.idle,
        b,
        e: 1,
        s: 0,
        sk: 0,
        sa: 0
      }
    })
    const body = JSON.stringify({
      slots: th,
      errorColor: this.AGENT_COLORS.error,
      // 只在拿到明确结论时上报；undefined 会让宿主把它当「未上报」（老客户端语义）。
      ...(typeof allIdle === 'boolean' ? { allIdle } : {})
    })
    if (this.#pushTimer) { clearTimeout(this.#pushTimer); this.#pushTimer = null }
    this.#pushTimer = setTimeout(() => {
      this.#pushTimer = null
      if (typeof fetch === 'function') {
        fetch('/omkb/agents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body
        }).catch(() => {})
      }
    }, 350)
  }

  // Agent 键按下（slot 0..5）：打开对应会话；返回是否已处理
  openSlot = (slot) => {
    const s = this.#slots && this.#slots[slot]
    if (!s || !s.id) return false
    // 用**最新**快照复核，而不是信任按下时缓存的槽位：
    // 会话可能在按下之前被归档/清空（此时侧边栏也看不见它了），
    // 对已不可见的 id 调 open 会让 DSH 静默新建空会话（"多出新聊天"）。
    let snap = null
    try {
      snap = this.sessions && this.sessions.list ? this.sessions.list.getSnapshot() : null
    } catch (e) { return false }
    const byId = snap && snap.byId
    if (!byId || !byId[s.id]) return false
    if (!visibleSessions(snap, archivedIdsOf(this.workspaces)).some((v) => v.id === s.id)) return false
    if (this.sessions && typeof this.sessions.open === 'function') {
      try { this.sessions.open(s.id) } catch (e) {}
      return true
    }
    return false
  }
}
