// dsh-omkb · client/src/components/modals/keycap.jsx
// 「编辑按键」弹窗：给某颗物理键（键码）换一颗键帽。
//
// 三条约束：
//   1) **候选就是键帽表**（keypad.js）—— 一张表同时喂布局、弹窗、按键分派，
//      弹窗里能选到的和按下去能发生的永远一致。
//   2) **候选用外面的键同一套外观**：直接复用 <Key>（.omkb-key）与 KeyFace，
//      不再另画一套 emoji 小卡片 —— 挑的时候看到的就是选完之后键盘上会变成的样子。
//   3) 保存要有意义：没选、或选的就是当前值 → 保存按钮置灰（以前点了毫无反应，
//      看起来像「编辑按键没实现」）。要退回出厂键帽用「恢复默认」。
//
// ---------- 名字去气泡了（2026-09-28）----------
// 以前每一格在键下面写一行名字（`.omkb-cap-name`）：格子被撑高、网格像标签墙，而且
// 布局里的键**没有**那行字 —— 同一个键帽在两处长成两个样子。现在两边一致（布局的键也挂了
// 同一个气泡，见 ../settings/keyboard-layout.jsx）：**键面只有图标，鼠标移上去浮出气泡**。
// 气泡的三行 = 短名 / 功能名（词典）/ 说明，实现全在 ../common/cap-tip.jsx（含「为什么用
// position:fixed」那条：这个网格是 overflow:auto 的滚动容器，相对定位的气泡会被裁掉）。
import { useState } from 'react'
import { Key, KeyFace } from '../common/ui.jsx'
import { CapTip, capTipHandlers, useCapTip } from '../common/cap-tip.jsx'
import { CUSTOM_LABEL, KEYCAPS, keycapOf } from '../../keypad.js'

/** 搜索用的可匹配文本：键帽 id / 动作名 / 中文短名 / 词典功能名 / 说明。
 *  2026-09-28 起短名是中文，只搜 `label` 会让「terminal」这类英文键名搜不到 ——
 *  所以把 `action`（总表的 id，仍是英文）与词典里那条英文/中文功能名一并搜。 */
const haystackOf = (c, tt) => {
  const key = c.labelKey
  let local = ''
  try { local = String(tt(key) || '') } catch (e) { local = '' }
  if (local === key) local = '' // 词典没绑 → bind 会把键名吐回来，那不是文案
  return [c.id, c.action, c.label, local, c.desc].map((v) => String(v || '')).join(' ').toLowerCase()
}

/**
 * @param target - 被编辑的**键码**（actLabels 的键，如 'ACT07'）。
 * @param current - 用户自己设过的键帽（没设过是 null）。
 * @param fallback - 当前生效的出厂键帽（capFor 的结果；拆分态那颗自定义键是 null）。
 * @param t - 词典取值函数（气泡第二行要用；entry.js → panel.jsx → 布局 → 这里一路传下来）。
 * @param onCancel / onClear / onSave - 取消 / 恢复默认 / 保存（pick 为键帽 id）。
 */
export function OmkbKeycapModal({ target, current, fallback, t, onCancel, onClear, onSave }) {
  // 预选 **当前生效** 的那颗键帽：没自定义过就用出厂值（fallback）——
  // 于是「打开弹窗看到高亮的那颗」永远等于「现在按下去会执行的那颗」，
  // 而「保存」只在真的换了另一颗时才可点（以前选不选都能点、点了没反应）。
  const initial = current || fallback || null
  const [pick, setPick] = useState(initial)
  const [q, setQ] = useState('')
  const tt = typeof t === 'function' ? t : (k) => k
  const { tip, show, hide } = useCapTip()
  const s = q.trim().toLowerCase()
  const list = KEYCAPS.filter((c) => !s || haystackOf(c, tt).includes(s))
  const picked = keycapOf(pick)
  const dirty = pick !== initial
  return (
    <>
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
          <div className="omkb-modal-grid omkb-capgrid" onMouseLeave={hide}>
            {list.map((c) => (
              /* 一格 = 一颗键（只有图标）。名字不再写在键下面，改由悬停气泡说 —— 见文件头。
                 鼠标事件挂在**外层格子**上：点在名字原来那个位置也算选中这颗键（老手感不变）。 */
              <div
                key={c.id}
                className={'omkb-cap-cell' + (pick === c.id ? ' omkb-cap-cell--sel' : '')}
                onClick={() => setPick(c.id)}
                {...capTipHandlers(show, hide, c)}
              >
                <Key
                  className={'omkb-cap' + (pick === c.id ? ' omkb-cap--sel' : '')}
                  data-omkb-cap={c.id}
                >
                  <KeyFace capId={c.id} />
                </Key>
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
      {/* 气泡是遮罩的**兄弟**，不是子节点：遮罩带 `backdrop-filter`，那会让它成为 fixed 后代的
          包含块（气泡的坐标是量视口算出来的）。放在外面 + position:fixed，滚动网格就裁不到它。 */}
      <CapTip tip={tip} t={tt} />
    </>
  )
}
