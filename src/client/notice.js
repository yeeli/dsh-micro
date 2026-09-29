// dsh-omkb · client/notice.js
// **顶部浮动提示** —— 「这颗键在当前页面做不了」必须**看得见**（用户 2026-09-28 要求，
// 给的样子是一张浮动卡片：左侧一个圆形实底图标 + 一行文案）。
//
// ── 为什么要有它 ───────────────────────────────────────────────────────────
// 本项目最贵的一条纪律是「拿不到入口必须出声」。可那条纪律一直只落在**日志**上：
// 开发版打终端、正式版只写 $DSH_HOME/logs/dsh-omkb.log —— 也就是说**用户那一侧是静音的**。
// 症状就是用户报过好几次的那句「按了没反应，也查不出原因」：日志里有一行，界面上什么都没有。
// 这个模块补的就是「界面上那一下」。
//
// ── 与 components/toast/save.jsx（设置页保存提示）的分工 ──────────────────
//   保存提示   React 组件，住在设置页里，只在「保存中/已保存/保存失败」三态出现；
//   本模块     纯 DOM，**全局**：设置页关着、弹窗盖着也要能出现（按键随时会被按到）。
// 两条都 position:fixed 挂在视口顶部正中、都 pointer-events:none、都用 DSH 主题令牌，
// 但**形状不同是有意的**：保存提示是那一页的局部反馈（胶囊），这条是「你刚按的那颗键
// 没生效」的跨页面通知（卡片，照用户给的截图：圆角矩形 + 圆形实底图标 + 一行文案）。
//
// ── 为什么不是 React / 不走槽位 ────────────────────────────────────────────
// 槽位插进去的东西只活在**它那个页面**里，而这条提示要能在任意页面（含本插件自己的
// 设置页弹窗之上）出现。纯 DOM 的做法与 joystick-hud.js 同源 —— 那一条的「结果」也是
// 纯 DOM。本文件**不 import 任何东西**（连 react 都不碰），所以 Node 自检能直接加载它，
// 不会撞上 `ERR_MODULE_NOT_FOUND: react`（见技能 §2）。
//
// ── 五条硬约束 ─────────────────────────────────────────────────────────────
//   1) position:fixed + z-index 高于本插件的弹窗（9999 / 10002）与另两条顶部提示（10045 / 10050）
//      —— 它是「刚才那一下失败了」，比摇杆预览卡片更要紧，允许盖在它上面；
//   2) pointer-events:none —— 它是通知不是控件，绝不挡住底下任何点击；
//   3) 到点自己摘（NOTICE_MS）—— 不攒一堆、不需要用户去关；
//   4) **同一拍只认第一条**（NOTICE_COALESCE_MS）—— 门面已经报了「需要对应的 DSH 插件」，
//      紧跟着分派层的兜底还会报一句通用的；两条都弹就是噪音，先到的（更具体）为准；
//   5) 拿不到 document 时**只记一行日志**、安静地什么都不做（Node / 无 DOM 环境不许抛）。

/** 根节点 class（探针 / 自检 / 控制台都靠它找）。 */
export const NOTICE_CLASS = 'omkb-notice'

/** 显示时长（ms）：够读完一句话，又不至于留在屏幕上碍事。 */
export const NOTICE_MS = 3600

/**
 * 「同一拍去重」窗口（ms）。真实链路是**同步连着**两次调用：
 * DshOps 的失败分支（具体原因）→ 分派层的兜底（通用原因），相隔不到 1ms；
 * 而两次按键之间最少也隔着一整个轮询拍（hid-bridge 120ms 起）。300ms 两头都留足了余量。
 */
export const NOTICE_COALESCE_MS = 300

/**
 * **能说什么**的唯一一张表：原因 id → 词典键（config/locales.js）。
 *
 * 门面（actions/index.js）与按键分派（keypad.js）只许报这里的 id ——
 * 「想加一句话」= 这里加一条 + 词典加中英各一条（verify_notice 会盯着这两边对齐）。
 */
export const NOTICE_REASON = {
  /** 没有当前会话（登录页 / 还没点开任何会话）。 */
  noSession: 'notice.noSession',
  /** 需要的跨插件服务拿不到（通常是对应插件没装）。 */
  noService: 'notice.noService',
  /** 当前没有待确认的弹窗。 */
  noPanel: 'notice.noPanel',
  /** 弹窗里是**选项**（提问 / 计划多选）：该转旋钮选、按旋钮勾。 */
  panelOptions: 'notice.panelOptions',
  /** 弹窗认出来了，但按文案与位置都挑不出可点的按钮。 */
  noButton: 'notice.noButton',
  /** 当前页面没有可用的输入框（写草稿 / 清空）。 */
  noInput: 'notice.noInput',
  /** 输入栏里找不到原生文件选择框（上传）。 */
  noUpload: 'notice.noUpload',
  /** 会话快照上没有项目目录（cwd），打开位置无从谈起。 */
  noCwd: 'notice.noCwd',
  /** 轨迹视图的闸门（DSH 设置里的「代码工作工具」）没开。 */
  gateOff: 'notice.gateOff',
  /** 只有在空会话（blank）上才允许换 Agent 预设。 */
  sessionBusy: 'notice.sessionBusy',
  /** 「推理±」：这个模型没有可调的推理等级（与 DSH 菜单那句「当前模型未提供推理等级」同一句）。 */
  noReasoning: 'notice.noReasoning',
  /** 「推理+」：已经在最高一档（**不绕圈**，与旋钮蓝环的夹边一致）。 */
  reasoningTop: 'notice.reasoningTop',
  /** 「推理-」：已经在最低一档。 */
  reasoningBottom: 'notice.reasoningBottom',
  /** 兜底：这次操作在当前页面就是不能执行（分派层的安全网）。 */
  notAvailable: 'notice.notAvailable'
}

/**
 * 认不出的原因 id（以及分派层「说不出理由」时）落到哪一条 —— 是**原因 id**，不是词典键。
 * **绝不把 id / 词典键显示给用户**：认不出就走这句通用文案。
 */
export const NOTICE_FALLBACK = 'notAvailable'

/**
 * 词典键 → 内置中文兜底（词典还没绑上 / 词条缺失时用）。
 * 与 joystick-hud 的 STATUS_FALLBACK 同源：不该出现英文界面里蹦中文，但总比空白好。
 */
export const NOTICE_TEXT_FALLBACK = {
  'notice.noSession': '先打开一个会话，再按这颗键',
  'notice.noService': '这个功能需要对应的 DSH 插件，当前页面用不了',
  'notice.noPanel': '现在没有待确认的弹窗',
  'notice.panelOptions': '这次弹窗要选选项：转旋钮选、按旋钮勾',
  'notice.noButton': '弹窗上找不到可点的按钮',
  'notice.noInput': '当前页面没有可用的输入框',
  'notice.noUpload': '输入栏里找不到文件选择框',
  'notice.noCwd': '这条会话没有记录项目目录',
  'notice.gateOff': '需要在 DSH 设置里开启「代码工作工具」',
  'notice.sessionBusy': '这条会话已经在跑了，新开一条再换',
  'notice.noReasoning': '当前模型未提供推理等级',
  'notice.reasoningTop': '已经是最高的推理强度了',
  'notice.reasoningBottom': '已经是最低的推理强度了',
  'notice.notAvailable': '当前页面不能执行这个操作'
}

/**
 * 图标：圆形实底 + 白色感叹号（用户的截图上那个「圆底 + 白色符号」的做法）。
 * 颜色跟随 CSS 的 `color`（currentColor），所以深浅色主题都不用改这里。
 * 用 innerHTML 塞进去而不是 createElementNS —— 本插件另一种做法见 sidebar.js（insertAdjacentHTML），
 * 两者都只为绕开「createElement 造不出 SVG 命名空间」这个坑。
 */
export const NOTICE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="12" fill="currentColor"/>' +
  '<path d="M12 6.5v6.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M12 16.6h.01" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' +
  '</svg>'

/** 认识这个原因 id 吗（纯判据，自检直接调）。 */
export const isNoticeReason = (reason) => Object.prototype.hasOwnProperty.call(NOTICE_REASON, reason)

/**
 * 原因 id → 要显示的那句话。词典优先，词典没绑上（返回键名本身 / 抛错）时退回内置中文。
 * 认不出的原因 id 一律回退到 NOTICE_FALLBACK 那句 —— 不许把 id 当文案显示出去。
 * @param {string} reason - NOTICE_REASON 里的 id。
 * @param {(key: string) => string} [t] - 词典函数（`ctx.locale.bind(DSVI.NS)`）。
 */
export const noticeTextOf = (reason, t) => {
  const key = NOTICE_REASON[reason] || NOTICE_REASON[NOTICE_FALLBACK]
  let v = null
  try { v = typeof t === 'function' ? t(key) : null } catch (e) { v = null }
  return (typeof v === 'string' && v && v !== key) ? v : NOTICE_TEXT_FALLBACK[key]
}

/**
 * 顶部提示。生命周期：entry.js 里建一个，注入给门面（DshOps，作为 `notice`）与按键分派
 * （KeypadController）；组件卸载时 dispose()。
 * **节点是惰性建的**（第一次真的要显示时才碰 DOM），所以构造它本身不需要 document，
 * 也就不必等某个界面挂载。
 */
export class OmkbNotice {
  #doc = null
  #t = null
  #ms = NOTICE_MS
  #log = null
  #root = null
  #els = null
  #timer = null
  /** 正在显示（或刚显示完）的那条：{ reason, text, at }。 */
  #shown = null
  /** 「拿不到 document」只出声一次（每次显示都刷屏的话，控制台就没法看了）。 */
  #warnedMissingDoc = false

  /**
   * @param options.doc - 注入的 document（不传就用运行时的；测试里装假 DOM 用）。
   * @param options.t - 词典函数（`ctx.locale.bind(DSVI.NS)`）。返回未知词条时退回内置中文。
   * @param options.ms - 显示时长（测试里调小）。
   * @param options.log - 记一行日志（拿不到 document 这类「看起来没反应」的情况必须出声）。
   */
  constructor(options = {}) {
    const o = options || {}
    if (o.doc) this.#doc = o.doc
    this.#t = typeof o.t === 'function' ? o.t : null
    if (Number.isFinite(o.ms) && o.ms >= 0) this.#ms = o.ms
    this.#log = typeof o.log === 'function' ? o.log : (msg) => { try { console.log('[omkb] ' + msg) } catch (e) {} }
  }

  /** 给探针 / 自检 / 控制台看的一眼状态（量 DOM 请查 .omkb-notice）。 */
  status = () => ({
    visible: this.visible,
    text: this.#shown ? this.#shown.text : null,
    reason: this.#shown ? this.#shown.reason : null,
    ms: this.#ms
  })

  /** 此刻真的在屏幕上吗（判据是 DOM 的 hidden，不是我自己的变量）。 */
  get visible() { return !!(this.#root && this.#root.hidden === false) }

  /**
   * 报一句「当前页面不能执行」。
   * @param {string} reason - NOTICE_REASON 里的 id（'noSession' / 'noService' / …）。
   * @returns {boolean} 这次有没有真的显示出去（被去重丢掉 / 没有 document → false）。
   */
  showKey = (reason) => this.show(noticeTextOf(reason, this.#t), reason)

  /**
   * 显示一条原文（控制台手验 / 探针用；正式链路一律走 showKey）。
   * @param {string} text - 要显示的文案（空串 = 什么都不做）。
   * @param {string} [reason] - 来源原因 id（只进 status / DOM 属性，便于查「刚才那条是谁报的」）。
   * @returns {boolean} 这次有没有真的显示出去。
   */
  show = (text, reason) => {
    const s = String(text == null ? '' : text).trim()
    if (!s) return false
    const els = this.#ensure()
    if (!els) return false
    // 同一拍只认第一条：下一条紧接着来（门面具体原因 → 分派层通用兜底）时丢掉，
    // 屏幕上留的就是更具体的那句。**判据是「正在显示」**——已经收起来的提示不参与去重。
    if (this.visible && this.#shown && (Date.now() - this.#shown.at) < NOTICE_COALESCE_MS) return false
    this.#shown = { reason: reason || null, text: s, at: Date.now() }
    els.text.textContent = s
    els.root.setAttribute('data-reason', this.#shown.reason || '')
    els.root.hidden = false
    this.#restart()
    return true
  }

  /** 立刻收起来（不需要等自动消失的场合：设备断开、页面卸载）。 */
  hide = () => {
    this.#cancel()
    if (this.#root) this.#root.hidden = true
  }

  /** 卸载：连节点一起摘掉（只 hidden 的话，重装会在 body 上堆一串死节点）。 */
  dispose = () => {
    this.#cancel()
    const root = this.#root
    this.#root = null
    this.#els = null
    this.#shown = null
    if (root && typeof root.remove === 'function') { try { root.remove() } catch (e) {} }
  }

  // ------------------------------------------------------------------ 内部

  #docOf = () => this.#doc || (typeof document !== 'undefined' ? document : null)

  #cancel = () => { if (this.#timer) { clearTimeout(this.#timer); this.#timer = null } }

  #restart = () => {
    this.#cancel()
    this.#timer = setTimeout(() => { this.#timer = null; this.hide() }, this.#ms)
  }

  #el = (tag, cls) => {
    const el = this.#docOf().createElement(tag)
    if (cls) el.className = cls
    return el
  }

  /** 惰性建节点：第一次真的要显示时才碰 DOM（没有 document 时安静地什么都不做，只记一行）。 */
  #ensure = () => {
    if (this.#els) return this.#els
    const doc = this.#docOf()
    if (!doc || !doc.body || typeof doc.createElement !== 'function') {
      if (!this.#warnedMissingDoc) {
        this.#warnedMissingDoc = true
        this.#log('拿不到 document.body，顶部提示不显示（按键失败将只留下一行日志）')
      }
      return null
    }
    const root = this.#el('div', NOTICE_CLASS)
    // role=status + aria-live=polite：读屏会把这句话念出来 —— 它是给用户看的，不只是装饰。
    root.setAttribute('role', 'status')
    root.setAttribute('aria-live', 'polite')
    root.hidden = true

    const ico = this.#el('span', NOTICE_CLASS + '__ico')
    // 图标是静态 SVG 串（NOTICE_ICON）：假 DOM 里 innerHTML / insertAdjacentHTML 只是文本槽，
    // 自检单独验那份串（它是不变的常量，不必靠 DOM 断言）。
    if (typeof ico.insertAdjacentHTML === 'function') ico.insertAdjacentHTML('afterbegin', NOTICE_ICON)
    else if ('innerHTML' in ico) ico.innerHTML = NOTICE_ICON

    const text = this.#el('span', NOTICE_CLASS + '__text')
    root.appendChild(ico)
    root.appendChild(text)
    doc.body.appendChild(root)

    this.#root = root
    this.#els = { root, ico, text }
    return this.#els
  }
}
