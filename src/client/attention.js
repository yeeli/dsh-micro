// dsh-omkb · client/attention.js
// **弹窗注意力探测**（用户 2026-09-29）：界面上有弹窗时，让**当前会话**那颗键换一个颜色提醒你。
//
//   ① 批准弹窗（审批 / 计划确认 / 多步确认）在场 → **琥珀黄**；
//   ② 手按旋钮、或点输入框那个「+」之后打开的弹窗 → **玫粉**，**直到弹窗关闭**才恢复原色。
//
// 分工：本文件只负责**看界面、说是哪种弹窗**；颜色怎么用（给哪一槽、跟红灯谁优先）全在宿主
// （src/core/leds.js 的 #attentionColor），色值在 src/client/agents.js 的调色板 ——
// 与 errorColor / successColor 完全同一套分工，别在这里另算一份颜色。
//
// 三件容易被下一个人好心改坏的事：
//   ① **批准弹窗优先**：它可能同时被 findActivePopup 认成一般弹窗，所以先判它。
//   ② **粉色要「先按旋钮 / 先点 +」才认**（用户选的正是这一档）：判据不是「弹窗长什么样」，
//      而是「这次弹窗是不是我们这两个手势招来的」——所以有一个 arm（待命）状态，
//      没待命时鼠标随便点开的下拉**不亮粉**。
//   ③ **待命不会被「第一拍没看到弹窗」清掉**：React 挂载弹窗要一两拍，按下旋钮的那一拍
//      什么弹窗都还没有。只有「见到过弹窗、之后又没了」或「待命超时」才收工（见 #disarm）。
//
// 判据本体全在 ./actions/dom.js（interactionPanelRoot / findActivePopup / findInputRoot）——
// 那是全项目唯一一份「界面结构理解」，这里只调它，不再抄一套选择器。

import { findActivePopup, findInputRoot, interactionPanelRoot, isTextEntry } from './actions/dom.js'

/** 轮询间隔（ms）：弹窗是视觉反馈，太慢会「松手半天才变色」，太快没必要。 */
export const ATTENTION_POLL_MS = 150

/**
 * 待命时长（ms）：按下旋钮 / 点了「+」之后，等弹窗出现的窗口。
 *
 * 超时只是**不再把之后出现的弹窗算作粉色**，不改任何灯色（本来就还没变色）——
 * 所以它不参与「灯色对错」，只决定「多久之后不再赖账」。
 */
export const ATTENTION_ARM_MS = 4000

/** 输入框里「能招来弹窗」的控件：按钮 / 弹出触发器。 */
const COMPOSER_TRIGGER_SEL = 'button, [role="button"], [aria-haspopup], [aria-expanded]'

export class AttentionController {
  /** 灯态控制器（./agents.js）—— 探测结果通过它的 setAttention 上报。 */
  #agents = null
  #timer = null
  #armTimer = null
  /** 是否在「等弹窗」（见文件头 ②）。 */
  #armed = false
  /** 这一轮待命期间**见到过**弹窗（见文件头 ③）。 */
  #sawPopup = false
  /** 上一次上报给 agents 的值（null = 没有弹窗）。 */
  #reported = null
  #onClick = null
  #log = (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }

  pollMs = ATTENTION_POLL_MS
  armMs = ATTENTION_ARM_MS

  constructor({ agents, log, pollMs, armMs } = {}) {
    this.#agents = agents || null
    if (typeof log === 'function') this.#log = log
    if (typeof pollMs === 'number' && pollMs > 0) this.pollMs = pollMs
    if (typeof armMs === 'number' && armMs > 0) this.armMs = armMs
  }

  /** 当前上报出去的弹窗态（诊断 / 自检用）。 */
  get attention() { return this.#reported }
  get armed() { return this.#armed }

  start = () => {
    if (typeof document === 'undefined') return
    this.stop()
    // 捕获阶段：点在按钮上的那一下可能在冒泡到 document 之前就被界面 stopPropagation 了。
    this.#onClick = this.#handleClick
    try { document.addEventListener('click', this.#onClick, true) } catch (e) {}
    this.#timer = setInterval(this.#tick, this.pollMs)
    this.#tick()
  }

  stop = () => {
    if (this.#timer) { clearInterval(this.#timer); this.#timer = null }
    this.#disarm()
    if (this.#onClick) {
      try { document.removeEventListener('click', this.#onClick, true) } catch (e) {}
      this.#onClick = null
    }
    // 收工时把灯色还回去：插件卸载后还顶着一颗粉灯，看起来就像「它还在值班」。
    this.#report(null)
  }

  /** 旋钮按下（由 KnobController.setOnPress 调）→ 进入待命，等它招来的弹窗。 */
  arm = () => this.#arm()

  /** 诊断快照（`__dshOmkb.services.attention.diagnose()`）。 */
  diagnose = () => ({
    attention: this.#reported, armed: this.#armed, sawPopup: this.#sawPopup,
    pollMs: this.pollMs, armMs: this.armMs
  })

  #arm = () => {
    this.#armed = true
    this.#sawPopup = false
    if (this.#armTimer) clearTimeout(this.#armTimer)
    this.#armTimer = setTimeout(() => { this.#armTimer = null; this.#disarm(); this.#tick() }, this.armMs)
    this.#armTimer?.unref?.()
    // 立刻看一眼：有的弹窗（比如界面上本来就开着的那种）不用等下一拍。
    this.#tick()
  }

  #disarm = () => {
    this.#armed = false
    this.#sawPopup = false
    if (this.#armTimer) { clearTimeout(this.#armTimer); this.#armTimer = null }
  }

  /**
   * 点在输入框里某个控件上 → 待命。
   *
   * ⚠ 刻意**只认控件**（按钮 / 弹出触发器），不认「点在输入区里的任何地方」：点进编辑区打字
   * （文本输入框）和点正文里的提及块都不该算 —— 它们不是「按了那颗 + 号」。
   * ⚠ 认「输入框里的控件」而不是「那颗 + 号」本身：DSH 的 + 号没有稳定可认的标记
   * （class 带构建期 hash，见 ./actions/dom.js 的 composerFileInput 那段注释），
   * 而这一条覆盖得到它、也不会把正文里的随便一颗按钮算进来。
   */
  #handleClick = (ev) => {
    try {
      const el = ev && ev.target
      if (!el) return
      if (isTextEntry(el)) return
      const root = findInputRoot()
      if (!root || !root.contains(el)) return
      if (typeof el.closest !== 'function') return
      if (!el.closest(COMPOSER_TRIGGER_SEL)) return
      this.#arm()
    } catch (e) {}
  }

  /**
   * 一拍：先认批准弹窗（优先），再认「待命期间出现的弹窗」，最后看看待命该不该收。
   */
  #tick = () => {
    let kind = null
    if (interactionPanelRoot()) kind = 'approval'
    else if (this.#armed && findActivePopup()) { this.#sawPopup = true; kind = 'menu' }
    // 见过弹窗、现在没了 → 这一轮结束（用户把弹窗关了）。此后**不再**把别的弹窗算作粉色 ——
    // 否则「关了 + 菜单 → 几分钟后自己弹出一个提示」会莫名其妙又亮一次粉。
    if (!kind && this.#armed && this.#sawPopup) this.#disarm()
    this.#report(kind)
  }

  #report = (kind) => {
    if (kind === this.#reported) return
    this.#reported = kind
    const a = this.#agents
    if (!a || typeof a.setAttention !== 'function') return
    try { a.setAttention(kind) } catch (e) { this.#log(`弹窗灯色上报失败：${(e && e.message) || e}`) }
  }
}
