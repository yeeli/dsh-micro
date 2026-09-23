// dsh-omkb · client/src/components/keycap-modal.jsx
// 「编辑按键」弹窗：给某颗物理键（键码）换一颗键帽。
//
// 三条约束：
//   1) **候选就是键帽表**（keypad/keycaps.js）—— 一张表同时喂布局、弹窗、按键分派，
//      弹窗里能选到的和按下去能发生的永远一致。
//   2) **候选用外面的键同一套外观**：直接复用 <Key>（.omkb-key）与 KeyFace，
//      不再另画一套 emoji 小卡片 —— 挑的时候看到的就是选完之后键盘上会变成的样子。
//      唯一的差别：布局的键只有图标（像真键盘），候选在键**下面**多写一行名字（见 .omkb-cap-name）。
//   3) 保存要有意义：没选、或选的就是当前值 → 保存按钮置灰（以前点了毫无反应，
//      看起来像「编辑按键没实现」）。要退回出厂键帽用「恢复默认」。
import { useState } from 'react'
import { Key, KeyFace } from './ui.jsx'
import { CUSTOM_LABEL, KEYCAPS, keycapOf } from '../keypad/keycaps.js'

/**
 * @param target - 被编辑的**键码**（actLabels 的键，如 'ACT07'）。
 * @param current - 用户自己设过的键帽（没设过是 null）。
 * @param fallback - 当前生效的出厂键帽（capFor 的结果；拆分态那颗自定义键是 null）。
 * @param onCancel / onClear / onSave - 取消 / 恢复默认 / 保存（pick 为键帽 id）。
 */
export function OmkbKeycapModal({ target, current, fallback, onCancel, onClear, onSave }) {
  // 预选 **当前生效** 的那颗键帽：没自定义过就用出厂值（fallback）——
  // 于是「打开弹窗看到高亮的那颗」永远等于「现在按下去会执行的那颗」，
  // 而「保存」只在真的换了另一颗时才可点（以前选不选都能点、点了没反应）。
  const initial = current || fallback || null
  const [pick, setPick] = useState(initial)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const list = KEYCAPS.filter((c) => (
    !s || c.id.toLowerCase().includes(s) || c.label.toLowerCase().includes(s) || c.desc.includes(s)
  ))
  const picked = keycapOf(pick)
  const dirty = pick !== initial
  return (
    <div className="omkb-modal-overlay" onMouseDown={onCancel}>
      <div className="omkb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="omkb-modal-head">
          <div>
            <div className="omkb-modal-title">编辑按键</div>
            <div className="omkb-modal-sub">
              给 {target} 选一颗键帽 —— 这颗键按下后就执行它对应的动作
            </div>
          </div>
          <button type="button" className="omkb-modal-x" onClick={onCancel}>×</button>
        </div>
        <input
          className="omkb-modal-search"
          placeholder="搜索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="omkb-modal-grid omkb-capgrid">
          {list.map((c) => (
            /* 一格 = 键（图标）+ **键下面的名字**。名字在键**外面**：布局那边已经不带文字，
               弹窗是唯一还有名字的地方，压回键面里就又跟布局长成一样了（也把「那行字绝对定位
               甩到遮罩底部」的老毛病带回来）。点击落在外层格子，名字那一下也能选中。 */
            <div
              key={c.id}
              className={'omkb-cap-cell' + (pick === c.id ? ' omkb-cap-cell--sel' : '')}
              onClick={() => setPick(c.id)}
            >
              <Key
                className={'omkb-cap' + (pick === c.id ? ' omkb-cap--sel' : '')}
                data-omkb-cap={c.id}
              >
                <KeyFace capId={c.id} />
              </Key>
              <div className="omkb-cap-name">{c.label}</div>
            </div>
          ))}
          {!list.length && <div className="omkb-sub-empty">无匹配结果</div>}
        </div>
        <div className="omkb-modal-hint">
          {picked
            ? `${picked.label} —— ${picked.desc}`
            : `当前是${CUSTOM_LABEL}：这颗键没有指派功能，按下不执行任何操作`}
        </div>
        <div className="omkb-modal-foot">
          <button
            type="button"
            className="omkb-ghost"
            onClick={onClear}
            disabled={!current}
            title="清掉这颗键的自定义键帽，回到出厂设置"
          >
            恢复默认
          </button>
          <span className="omkb-modal-spacer" />
          <button type="button" className="omkb-ghost" onClick={onCancel}>取消</button>
          <button
            type="button"
            className="omkb-primary"
            disabled={!dirty}
            onClick={() => { if (dirty) onSave(pick) }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
