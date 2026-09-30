// dsh-micro · client/src/utils/knob-state.js
// 布局里旋钮的「转动指示」：把 /micro/state 的旋钮计数折成「环亮不亮、蓝点停哪一侧」。
//
// 设备事实（src/core/ble.js）：`ENC_CW` → `enc + 1`（顺时针）、`ENC_CC` → `enc - 1`（逆时针），
// `knobPress` 是按下计数。enc 是**带符号累计**，所以「差值 > 0 就是顺时针」这一条
// 有宿主侧的真源，不需要在这里再猜一次方向。
//
// 用户 2026-09-25 定的语义（原话）：「接收键盘的信息，如果是顺时针右边出现蓝点，
// 逆时针左边出现蓝点」。注意这不是「转了多少度」的表盘指针，而是**方向指示**：
// 只有两个停靠位 —— 顺时针 → 右侧（3 点），逆时针 → 左侧（9 点，也是静止位）。
// 所以这里**不累计角度**：连着同向转，点停在那一侧不动；掉头，点滑到另一侧。
//
// 为什么要有「活性窗口」而不是一转就永远亮着：环与点只在设备真的在动的时候亮
// （用户选的「转动 / 按下时亮起」），最后一帧之后 KNOB_ACTIVE_MS 到期一起淡出。
// 方向**保留到窗口过期**再由 snapshot 报 null —— 掉头时能立刻拿到新鲜方向。
//
// 纯 JS、时间源可注入：界面那侧是 JSX（Node 自检 import 不了），判据必须能单独验，
// 与 utils/press-state.js 同一条纪律。

/**
 * 蓝点两个停靠位的角度（度；CSS rotate 正值 = 顺时针，0° = 12 点方向）。
 * 顺时针 → 90°（右侧 3 点）；逆时针 → -90°（左侧 9 点）。
 */
export const KNOB_DOT_DEG = { cw: 90, ccw: -90 }

/**
 * 静止位：没转过（或只按下没转）时蓝点待的地方 —— 就是截图里那个左侧位置。
 * 组件必须**始终**给点写一个角度（而不是让它停在圆心）：初始写静止位，
 * 第一次顺时针转时点才会「从左边滑到右边」，而不是从圆心飞出去。
 */
export const KNOB_DOT_REST_DEG = KNOB_DOT_DEG.ccw

/** 最后一次转动 / 按下之后，环与点保持亮着的时长（ms）。 */
export const KNOB_ACTIVE_MS = 900

/**
 * 蓝点相对圆心的偏移（px）—— 与组件里那条 CSS transform 一一对应：
 * `rotate(deg) translateY(-r)` 把「12 点方向」按顺时针转过 deg，于是
 *   dx = r·sin(deg)，dy = −r·cos(deg)
 * 存在的意义是给自检 / 真机探针一个**独立判据**：验「顺时针真的在右边」时不用手算三角函数，
 * 也不用去读组件的实现（读实现等于自己验自己）。
 * @param {'cw'|'ccw'|null} dir 方向；null = 静止位。
 * @param {number} r 点到圆心的距离（px）。
 * @returns {[number, number]} [dx, dy]（px，屏幕坐标：y 向下为正）。
 */
export const knobDotOffset = (dir, r) => {
  const deg = KNOB_DOT_DEG[dir] ?? KNOB_DOT_REST_DEG
  const rad = (deg * Math.PI) / 180
  return [r * Math.sin(rad), -r * Math.cos(rad)]
}

/**
 * 建一个旋钮指示状态机。
 * @param {{now?: () => number}} [options] 时间源（自检注入假时钟用）。
 * @returns {{fold: Function, snapshot: Function, reset: Function}}
 */
export const createKnobTracker = ({ now = () => Date.now() } = {}) => {
  /** enc 的上一份值（null = 还没建基线）。 */
  let lastEnc = null
  /** knobPress 的上一份值（null = 还没建基线）。 */
  let lastPress = null
  /** 最近一次转动的方向：'cw' | 'ccw' | null（只按下过、或还没动过）。 */
  let dir = null
  /** 亮到什么时候（时间戳）。 */
  let until = 0

  /**
   * 喂一帧 /micro/state。
   * @param {object} s 状态快照（只看 enc 与 knobPress）。
   */
  const fold = (s) => {
    if (!s || typeof s !== 'object') return
    const t = now()
    let seen = false

    // 转动：enc 是带符号累计，差值的符号就是方向（宿主 ENC_CW 加、ENC_CC 减）
    const enc = typeof s.enc === 'number' ? s.enc : null
    if (enc !== null) {
      if (lastEnc === null) {
        lastEnc = enc // 首帧只建基线：enc 是**历史累计值**，拿它当增量会凭空亮一下
      } else if (enc !== lastEnc) {
        const d = enc - lastEnc
        lastEnc = enc
        if (d !== 0) { dir = d > 0 ? 'cw' : 'ccw'; seen = true }
      }
    }

    // 按下：也亮一次（但**不动方向** —— 没转就不该把点凭空挪到某一侧）
    const press = typeof s.knobPress === 'number' ? s.knobPress : null
    if (press !== null) {
      if (lastPress === null) lastPress = press // 宿主刚升级/重启：只建基线
      else if (press !== lastPress) { lastPress = press; seen = true }
    }

    if (seen) until = t + KNOB_ACTIVE_MS
  }

  /**
   * 当前该显示成什么样。
   * @returns {{active: boolean, dir: 'cw'|'ccw'|null}} active = 环与点是否亮着（窗口未过期）。
   *   窗口过期后 dir 报 null（点回到静止位并被隐藏）。
   */
  const snapshot = () => {
    const active = now() < until
    return { active, dir: active ? dir : null }
  }

  /** 断订阅 / 卸载时清空（下次挂载重新建基线）。 */
  const reset = () => { lastEnc = null; lastPress = null; dir = null; until = 0 }

  return { fold, snapshot, reset }
}
