// dsh-omkb · client/joystick-hud.js
// **摇杆提示卡片** —— 会话界面顶部居中的一张小卡片：左边一个方向盘（点跟着真实推力走），
// 右边三行「方向 / 干的事 / 结果」，下面一条随停留时间走完的进度条。
//
// 为什么要它：摇杆的四个方向可绑任何动作（设置页里能改），可推下去之后**屏幕上什么都不发生**
// —— 用户看不出「刚才那一推到底有没有被认到、执行的是哪一条」。设置页里的键盘布局有推拉动画，
// 但那是设置页；会话界面这一侧以前是彻底静音的。
//
// 数据从两条路进来，**各管各的**（这条纪律是本文件的骨架）：
//   · feed(snapshot)  —— 每次轮询的状态快照（hid-bridge 的 subscribe 广播）。只管**画面**：
//                        推着就实时跟（joy + joyD + joyA），回中就起停留计时。**不产生任何动作**。
//   · notify(gesture) —— 摇杆控制器算出的「方向 → 动作名 → 执行结果」。只管**文案**。
//   两者在同一个轮询拍里先后到达（emit 在 consume 之前），所以卡片永远不会先显示上一推的旧文案。
//
// 它还**不是**控制器：不碰 DSH、不碰 core，只认 DOM 与词典（拿不到 document 就安静地什么都不做）。
// 样式在 assets/hud.css（随 DSVI.css 注入）。
//
// 角度约定与宿主完全一致（见 src/core/joystick.js）：0=右、90=下、180=左、270=上（顺时针）。
// 没有 joyA（老宿主）时按方向取正中的那个角度；没有 joyD 时按「推到底」画（有方向就够用了）。

import { JOY_ACTION } from './config/default.js'
// 结果词表（ok / unbound / unwired / failed）**只在 joystick.js 定义一次** —— 卡片这里 import
// 进来直接用，绝不自己再抄一份（两处各写一份词表，迟早有一天对不上）。
import { JOY_RESULT } from './joystick.js'

/** 松手之后卡片还留多久（ms）。 */
export const HUD_LINGER_MS = 1500

/** 卡片根节点的 class（探针 / 自检都靠它找）。 */
export const HUD_CLASS = 'omkb-joyhud'

/** 四个方向的「正中角度」（度，与宿主同一套约定）。 */
export const DIR_ANGLE = { right: 0, down: 90, left: 180, up: 270 }

/** 方向 → 箭头字面量。摇杆弹窗里那套（components/modals/joystick.jsx）也是这四个字，别改歪。 */
export const DIR_ARROW = { up: '↑', right: '→', down: '↓', left: '←' }

/** 方向 → 词典键（中英各一份文案）。 */
export const DIR_TEXT_KEY = {
  up: 'joyHud.up', right: 'joyHud.right', down: 'joyHud.down', left: 'joyHud.left'
}

/** 方向 → 兜底文案（词典没绑上时用；不该出现英文界面里蹦中文，但总比空白好）。 */
export const DIR_FALLBACK = { up: '上', right: '右', down: '下', left: '左' }

/** 结果 → 词典键。 */
export const STATUS_TEXT_KEY = {
  ok: 'joyHud.ok', unbound: 'joyHud.unbound', unwired: 'joyHud.unwired', failed: 'joyHud.failed'
}

/** 结果 → 兜底文案。 */
export const STATUS_FALLBACK = { ok: '已触发', unbound: '未绑定', unwired: '未接线', failed: '未生效' }

/** 结果 → 状态行前面那个符号（✓ 是唯一的「成了」，其余都是「没成」）。 */
export const STATUS_MARK = { ok: '✓', unbound: '·', unwired: '·', failed: '!' }

/**
 * 内置摇杆动作名 → 词典键。用**计算键**从 JOY_ACTION（默认配置的唯一声明处）生成 ——
 * 手抄一份「动作名 → 词条」迟早和 JOY_ACTION 漂移（改了名字这里还指着老词条）。
 * 表里没有的动作名（技能名等）原样显示，与设置页下拉里的写法一致。
 */
export const JOY_ACTION_LOCALE = {
  [JOY_ACTION.BACK]: 'joyAct.undo',
  [JOY_ACTION.FORWARD]: 'joyAct.redo',
  [JOY_ACTION.SIDEBAR]: 'joyAct.sidebar',
  [JOY_ACTION.PLAN]: 'joyAct.plan',
  [JOY_ACTION.SCROLL_BOTTOM]: 'joyAct.scrollBottom'
}

/** 圆盘里能让点偏移出去的最大半径（px）。比盘子半径小一圈，贴边时看着才还在盘里。 */
export const DOT_RADIUS = 12

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
const round2 = (n) => Math.round(n * 100) / 100

/**
 * 圆盘里那个点该偏到哪儿（纯函数，自检直接量的就是它）。
 *
 * @param dir - 四方向之一（'up'/'right'/'down'/'left'）；空 = 回中（点回正中心）。
 * @param push - 推力 0..1（宿主 joyD）。非数字时按「推到底」算。
 * @param a - 原始角度 0..1（宿主 joyA，右=0、顺时针）。给了就用**真实角度**：
 *            推向右下角时点也落在右下角，而不是吸到四个方向上。没给就取该方向的正中角度。
 * @returns {{x: number, y: number}} 相对中心的像素偏移。
 */
export const dotOffset = (dir, push, a) => {
  if (!dir) return { x: 0, y: 0 }
  const deg = Number.isFinite(a)
    ? (((a % 1) + 1) % 1) * 360
    : DIR_ANGLE[dir]
  if (!Number.isFinite(deg)) return { x: 0, y: 0 }
  const r = DOT_RADIUS * (Number.isFinite(push) ? clamp01(push) : 1)
  const rad = (deg * Math.PI) / 180
  return { x: round2(Math.cos(rad) * r), y: round2(Math.sin(rad) * r) }
}

/**
 * 卡片控制器。生命周期：entry.js 里 `ctx.effect` 建一个，卸载时 dispose()。
 *
 * 三段相位（对外用 status() 看）：
 *   idle   没在屏幕上
 *   live   摇杆正被推着（点跟着推力走）
 *   linger 松手后的停留（进度条从满走到空，到点自己消失）
 */
export class JoystickHud {
  #doc = null
  #t = null
  #lingerMs = HUD_LINGER_MS
  #log = null
  #root = null
  #els = null
  #timer = null
  #phase = 'idle'
  /** 卡片上正在显示的那一条：{ dir, action, status }。**留着不删** —— 同方向再推一次无需重算文案。 */
  #info = null
  /** 当前这一推的实时画面：{ dir, push, a }。回中后置 null（点归中心）。 */
  #push = null
  /** 「拿不到 document」只出声一次（每次显示都刷屏的话，控制台就没法看了）。 */
  #warnedMissingDoc = false

  /**
   * @param options.doc - 注入的 document（不传就用运行时的 document；测试里装假 DOM 用）。
   * @param options.t - 词典函数（`ctx.locale.bind(NS)`）。拿不到 / 返回未知词条时退回内置中文。
   * @param options.lingerMs - 松手后的停留时长（测试里调小）。
   * @param options.log - 记一行日志（拿不到 document 这类「看起来没反应」的情况必须出声）。
   */
  constructor(options = {}) {
    const o = options || {}
    if (o.doc) this.#doc = o.doc
    this.#t = typeof o.t === 'function' ? o.t : null
    if (Number.isFinite(o.lingerMs) && o.lingerMs >= 0) this.#lingerMs = o.lingerMs
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }
  }

  /** 给自检 / 探针看的一眼状态（不含 DOM 细节，量 DOM 请查 .omkb-joyhud）。 */
  status = () => ({
    phase: this.#phase,
    visible: this.visible,
    info: this.#info ? { ...this.#info } : null,
    push: this.#push ? { ...this.#push } : null,
    lingerMs: this.#lingerMs
  })

  /** 卡片此刻真的在屏幕上吗（判据是 DOM 的 hidden，不是我自己的相位变量）。 */
  get visible() { return !!(this.#root && this.#root.hidden === false) }

  /**
   * 每次轮询的状态快照。**只画画面，不执行任何动作**。
   * @param snap - /omkb/state 的形状（只读 joy / joyD / joyA / open）。
   */
  feed = (snap) => {
    // 还没发生过任何手势 → 没有文案可画，整段跳过（否则每次轮询都在做无用功）。
    if (!this.#info) return
    const s = snap && typeof snap === 'object' ? snap : {}
    // 设备不在了就不可能还推着：宿主断开时**不会**把 joy 清回来（那是它自己的历史遗留），
    // 不在这里挡一下的话，掉线那一刻推着的那张卡片会永远挂在屏幕上。
    const live = s.open !== false && typeof s.joy === 'string' && !!s.joy
    if (!live) {
      if (this.#phase !== 'live') return // idle / 已在停留里：不重开计时（否则每次轮询都续命）
      this.#phase = 'linger'
      this.#push = null
      this.#paint() // 点归中心
      if (this.#root) this.#startLinger()
      else this.#phase = 'idle'
      return
    }

    const entered = this.#phase !== 'live'
    this.#phase = 'live'
    this.#cancelLinger()
    // 新的一次推杆：等这一拍的手势回调把文案换好再显示。emit 排在 consume 之前，
    // 所以正常情况下面那次 notify 就在同一个 tick 里 —— 这里挡住的是「文案还是上一推的」那一帧。
    if (entered && this.#info.dir !== s.joy) return
    this.#push = { dir: s.joy, push: Number.isFinite(s.joyD) ? s.joyD : 1, a: Number.isFinite(s.joyA) ? s.joyA : null }
    this.#paint()
    this.#show()
  }

  /**
   * 摇杆控制器报来的一次手势（方向 + 动作名 + 结果）。**只管文案**。
   * @param info - { dir, action, status }；status 见 joystick.js 的 JOY_RESULT（认不出的按 ok 处理）。
   */
  notify = (info) => {
    const i = info && typeof info === 'object' ? info : null
    if (!i || typeof i.dir !== 'string' || !i.dir) return
    this.#info = {
      dir: i.dir,
      action: typeof i.action === 'string' && i.action ? i.action : null,
      status: STATUS_TEXT_KEY[i.status] ? i.status : JOY_RESULT.OK
    }
    const ok = this.#paint()
    if (!ok) return
    // 推着推来的：不动计时，等松手（feed 会接上）。快推一下（两次轮询之间就松了）：
    // feed 根本没看见「推着」，这里直接把停留计时开起来 —— 不然一闪而过的推杆永远不显示。
    if (this.#phase !== 'live') { this.#phase = 'linger'; this.#startLinger() }
    this.#show()
  }

  /** 立刻收起来（设置页演示闸门期间 / 卸载）。 */
  hide = () => {
    this.#cancelLinger()
    this.#phase = 'idle'
    if (this.#root) this.#root.hidden = true
  }

  /** 卸载：连节点一起摘掉（只 hidden 的话，重装会在 body 上堆一串死节点）。 */
  dispose = () => {
    this.#cancelLinger()
    this.#phase = 'idle'
    this.#push = null
    const root = this.#root
    this.#root = null
    this.#els = null
    if (root && typeof root.remove === 'function') { try { root.remove() } catch (e) {} }
  }

  // ------------------------------------------------------------------ 内部

  #docOf = () => this.#doc || (typeof document !== 'undefined' ? document : null)

  /** 词典取词：拿不到（没注入 / 词条没绑 / 返回键名本身）时退回内置文案。 */
  #text = (key, fallback) => {
    let v = null
    try { v = this.#t ? this.#t(key) : null } catch (e) { v = null }
    return typeof v === 'string' && v && v !== key ? v : fallback
  }

  #cancelLinger = () => { if (this.#timer) { clearTimeout(this.#timer); this.#timer = null } }

  #startLinger = () => {
    this.#cancelLinger()
    this.#timer = setTimeout(() => { this.#timer = null; this.hide() }, this.#lingerMs)
  }

  #show = () => { const els = this.#ensure(); if (els) els.root.hidden = false }

  #el = (tag, cls, text) => {
    const el = this.#docOf().createElement(tag)
    if (cls) el.className = cls
    if (text !== undefined) el.textContent = text
    return el
  }

  /** 惰性建节点：第一次真的要显示时才碰 DOM（没有 document 时安静地什么都不做，只记一行）。 */
  #ensure = () => {
    if (this.#els) return this.#els
    const doc = this.#docOf()
    if (!doc || !doc.body || typeof doc.createElement !== 'function') {
      if (!this.#warnedMissingDoc) {
        this.#warnedMissingDoc = true
        this.#log('拿不到 document.body，摇杆提示卡片不显示')
      }
      return null
    }
    const root = this.#el('div', HUD_CLASS)
    root.setAttribute('role', 'status')
    root.setAttribute('aria-live', 'polite')
    root.setAttribute('data-status', JOY_RESULT.OK)
    root.hidden = true

    const pad = this.#el('span', HUD_CLASS + '__pad')
    const dot = this.#el('span', HUD_CLASS + '__dot')
    pad.appendChild(dot)

    const body = this.#el('span', HUD_CLASS + '__body')
    const dirRow = this.#el('span', HUD_CLASS + '__dir')
    const arrow = this.#el('span', HUD_CLASS + '__arrow')
    const dirText = this.#el('span', HUD_CLASS + '__dirtext')
    dirRow.appendChild(arrow)
    dirRow.appendChild(dirText)
    const action = this.#el('span', HUD_CLASS + '__action')
    const statusRow = this.#el('span', HUD_CLASS + '__status')
    const mark = this.#el('span', HUD_CLASS + '__mark')
    const statusText = this.#el('span', HUD_CLASS + '__statustext')
    statusRow.appendChild(mark)
    statusRow.appendChild(statusText)
    const bar = this.#el('span', HUD_CLASS + '__bar')
    const fill = this.#el('i', HUD_CLASS + '__fill')
    // 进度条的时长就写在这儿：停留多久它就走多久（见 hud.css 的 keyframes）。
    fill.style.animationDuration = this.#lingerMs + 'ms'
    bar.appendChild(fill)

    body.appendChild(dirRow)
    body.appendChild(action)
    body.appendChild(statusRow)
    body.appendChild(bar)
    root.appendChild(pad)
    root.appendChild(body)
    doc.body.appendChild(root)

    // 两个引用都要留：#els 给画图用，#root 给 visible / show / dispose 用。
    // （首版只存了 #els，于是 visible 恒为 false、dispose 摘不掉节点 —— 自检当场抓出来的。）
    this.#root = root
    this.#els = { root, dot, arrow, dirText, action, mark, statusText, fill }
    return this.#els
  }

  /** 把 #info / #push 画到节点上。没建成节点（没有 document）时返回 false。 */
  #paint = () => {
    if (!this.#info) return false
    const els = this.#ensure()
    if (!els) return false
    const { dir, action, status } = this.#info
    els.arrow.textContent = DIR_ARROW[dir] || ''
    els.dirText.textContent = this.#text(DIR_TEXT_KEY[dir], DIR_FALLBACK[dir] || dir)
    // 没绑动作就没有「干的事」可写 → 一行破折号，别留空白让人以为卡片坏了。
    els.action.textContent = action ? this.#text(JOY_ACTION_LOCALE[action], action) : '—'
    els.mark.textContent = STATUS_MARK[status] || ''
    els.statusText.textContent = this.#text(STATUS_TEXT_KEY[status], STATUS_FALLBACK[status] || status)
    els.root.setAttribute('data-status', status)
    els.root.setAttribute('data-dir', dir)
    const o = this.#push ? dotOffset(this.#push.dir, this.#push.push, this.#push.a) : { x: 0, y: 0 }
    els.dot.style.transform = `translate(${o.x}px, ${o.y}px)`
    return true
  }
}
