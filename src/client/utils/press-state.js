// dsh-omkb · client/src/utils/press-state.js
// 布局按键特效的「按压状态机」：把 /omkb/state 快照折成「哪些视觉键正按着」。
//
// 要的行为：**按下就陷下去，接到松开才抬起来**（不是按固定时长自己弹回）。
// 设备给了这个信息（`params.act`：1 按下 / 0 松开，见 src/core/ble.js 的 HID_ACT），
// 宿主把它翻译成两个字段：
//   down    —— 当前按住的键名数组（**快照即真相**，对齐一次就够，幂等、不怕丢帧）
//   keyAct  —— 本次事件的边沿（0 = 松开）
// 所以主通道是 down：按住的视觉键全集对齐，不靠计时器猜「多久算抬起」。
//
// 为什么还要第二条通道（flash）：**「按下」那一瞬也要看得见**。
//   * 按得比一次轮询还快时，轮询拿到的 down 里可能已经空了（按下与松开都发生在两拍之间），
//     这时靠 keyT（按下计数）的差值补一次短闪，否则那颗键毫无反应。
//   * 本地点击布局上的键（手边没设备时也要有反馈）同样走它。
//   * **老宿主**没有 down（字段不存在）→ held 恒空，全靠 flash ⇒ 与改动前完全一致。
//
// 纯 JS、时间源可注入：自检与真机探针都能直接验这套判据（界面那几个文件是 JSX，Node 进不去）。
// 放在 utils/ 就是因为它**不属于按键功能本身**：它只是「把快照折成视觉状态」的一段纯逻辑，
// 界面组件拿去用，自检也直接 import 同一份。

import { keyVisual } from './keycaps.js'

/** 短闪时长（ms）：只在「没有按住信息」时兜底，不是常态。 */
export const FLASH_MS = 170

/**
 * 宿主静默多久就认为按键状态不可信（ms）。
 * 命中场景：宿主崩了 / 页面被挂起后恢复 / 设备掉线 —— 此时 down 里的键会永远抬不起来，
 * 布局就卡在「一直按着」。轮询间隔 120ms，正常运行时离这个阈值很远。
 */
export const STALE_MS = 1200

const isTrue = (v) => v === true || v === 1

/**
 * 建一个按压状态机。
 * @param {{now?: () => number}} [options] 时间源（自检注入假时钟用）。
 * @returns {{fold: Function, tap: Function, snapshot: Function, reset: Function}}
 */
export const createPressTracker = ({ now = () => Date.now() } = {}) => {
  /** 视觉键 id → true：设备明确按着（真相来自 down）。 */
  let held = {}
  /** 视觉键 id → 到期时间戳（短闪）。 */
  let flash = {}
  /** keyT 的上一份快照（按下计数）。 */
  let lastKeyT = null
  /** 最近一次收到快照的时刻。 */
  let lastSnapAt = 0
  /** 宿主到底有没有给过 down 字段（能力探测：老宿主没有，就不能按「按住」理解）。 */
  let sawDown = false

  /**
   * 喂一帧 /omkb/state。
   * @param {object} s 状态快照。
   * @param {boolean} split 「独立麦克风键」是否打开（ACT10/ACT11 拆成两颗）。
   */
  const fold = (s, split) => {
    if (!s || typeof s !== 'object') return
    const t = now()
    lastSnapAt = t

    // ---- 通道 1：按住集合（快照即真相）----
    if (Array.isArray(s.down)) {
      sawDown = true
      const next = {}
      // 设备不在线时不可能有键按着（宿主 close() 也会清掉 down），这里再挡一道。
      if (s.open !== false) {
        for (const name of s.down) {
          const v = keyVisual(name, split)
          if (v) next[v] = true
        }
      }
      held = next
    }

    // ---- 通道 2：按下计数 → 短闪（按下那一瞬；也覆盖老宿主）----
    const kt = s.keyT
    if (kt && typeof kt === 'object') {
      if (lastKeyT === null) {
        // 首帧：只建基线。宿主 keyT 里带着的是**历史累计值**，拿它当增量会把以前的按键重放一遍。
        lastKeyT = { ...kt }
      } else {
        for (const name of Object.keys(kt)) {
          const cur = Number(kt[name]) || 0
          const prev = lastKeyT[name]
          lastKeyT[name] = cur
          // 首帧之后再冒出来的**新键名** = 这一拍刚按下的（宿主 keyT 只增不减，且创建时就是 1）
          // → 闪一次。否则「第一次按某颗键」会毫无反应，第二次才正常。
          // 值为 0 的新键名不算：那只是宿主刚把这个键名放进表里，还没按过（真实宿主不会有，
          // 但客户端不该依赖「宿主一定不这么做」）。
          if (prev === undefined) {
            if (cur > 0) {
              const v0 = keyVisual(name, split)
              if (v0 && !held[v0]) flash[v0] = t + FLASH_MS
            }
            continue
          }
          const d = cur - (Number(prev) || 0)
          if (d <= 0) continue
          const v = keyVisual(name, split)
          if (v && !held[v]) flash[v] = t + FLASH_MS
        }
        // 注意：**逐键推进基线，不整块替换**。某一帧少带了某个键（或整块 keyT 为空）时，
        // 整块替换会把基线清掉，下一帧再看到它就当成「新增了 N 次按下」，白闪一下。
      }
    }
  }

  /**
   * 本地点击布局上的键：闪一下（与设备无关的即时反馈）。
   * @param {string} visualId 视觉键 id。
   */
  const tap = (visualId) => {
    if (visualId) flash[visualId] = now() + FLASH_MS
  }

  /**
   * 当前按下集合（视觉键 id → true）。
   * 顺手做两件到期清理：短闪过时、宿主静默超过 STALE_MS 时清空按住集合。
   * @returns {object}
   */
  const snapshot = () => {
    const t = now()
    if (sawDown && t - lastSnapAt > STALE_MS) held = {}
    const out = {}
    for (const k of Object.keys(flash)) {
      if (flash[k] > t) out[k] = true
      else delete flash[k]
    }
    for (const k of Object.keys(held)) out[k] = true
    return out
  }

  /** 断订阅/卸载时清空（下次挂载重新建基线）。 */
  const reset = () => { held = {}; flash = {}; lastKeyT = null; lastSnapAt = 0; sawDown = false }

  return { fold, tap, snapshot, reset }
}

/**
 * 两份按下集合是否等价（React 侧用来免得每 120ms 都 setState 一次）。
 * @param {object} a 集合 A。
 * @param {object} b 集合 B。
 * @returns {boolean}
 */
export const samePressed = (a, b) => {
  const ka = Object.keys(a || {})
  const kb = Object.keys(b || {})
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!isTrue(b && b[k])) return false
  return true
}
