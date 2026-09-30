// dsh-micro · client/src/components/modals/joystick.jsx
// 「模拟摇杆」配置弹窗：给四个方向各挑一个动作（二级弹窗里搜索/挑选）。
//
// 方向的顺序 / 动作名 / 出厂默认都来自摇杆控制器（../joystick.js），这里只补界面文案：
// 两边各写一份默认值必然漂移——按键可能在设置页被打开之前就被推动了。
import { useState } from 'react'
import { JOY_ACTION, JOY_DEFAULTS, JOY_DIRS as JOY_DIR_KEYS, JOY_NONE } from '../../joystick.js'

const JOY_DIR_LABEL = { up: '上', right: '右', down: '下', left: '左' }
const JOY_DIR_ARROW = { up: '↑', right: '→', down: '↓', left: '←' }
const JOY_DIRS = JOY_DIR_KEYS.map((dir) => ({ dir, label: JOY_DIR_LABEL[dir], arrow: JOY_DIR_ARROW[dir] }))

const JOY_ACTIONS = [
  { cat: '系统操作', name: JOY_ACTION.BACK, des: '在应用里撤销（undo）上一次编辑' },
  { cat: '系统操作', name: JOY_ACTION.FORWARD, des: '在应用里重做（redo）被撤销的那次编辑' },
  { cat: '系统操作', name: JOY_ACTION.SIDEBAR, des: '打开或收起侧边栏' },
  { cat: '系统操作', name: JOY_ACTION.PLAN, des: '规划模式 开 / 关' },
  { cat: '系统操作', name: JOY_ACTION.SCROLL_BOTTOM, des: '滚到当前对话底部' },
  { cat: '系统操作', name: JOY_NONE, des: '不执行任何操作' },
  { cat: '技能（未接线）', name: 'Documents', des: '处理 Word 与文档文件', soon: true },
  { cat: '技能（未接线）', name: 'Excel Live Control', des: '实时控制打开的 Excel 表格', soon: true },
  { cat: '技能（未接线）', name: 'Image Gen', des: '为站点/游戏等生成或编辑图片', soon: true },
  { cat: '技能（未接线）', name: '网页搜索', des: '搜索并获取网络信息', soon: true },
  { cat: '技能（未接线）', name: '语音转写', des: '语音内容的实时转写（当前等价于开关语音输入）', soon: true },
]

/** 显示名：未绑定在界面上叫「不绑定」。 */
const joyLabel = (name) => (!name || name === JOY_NONE ? '不绑定' : name)

/**
 * @param value - 设置里存的 joystick 映射（可为空/残缺）。
 * @param onClose - 关掉（不保存）。
 * @param onSave - 保存整张映射。
 */
export function MicroJoystickModal({ value, onClose, onSave }) {
  const [local, setLocal] = useState(value && Object.keys(value).length ? { ...value } : { ...JOY_DEFAULTS })
  const [editDir, setEditDir] = useState(null) // 正在编辑的方向（触发二级选择）
  const setDir = (dir, name) => setLocal({ ...local, [dir]: name })
  return (
    <>
      <div className="micro-modal-overlay" onMouseDown={onClose}>
        <div className="micro-modal micro-modal--joy" onMouseDown={(e) => e.stopPropagation()}>
          <div className="micro-modal-head">
            <div>
              <div className="micro-modal-title">模拟摇杆</div>
              <div className="micro-modal-sub">选择每个方向触发的操作</div>
            </div>
            <button type="button" className="micro-modal-x" onClick={onClose}>×</button>
          </div>
          <div className="micro-joy-body">
            <div className="micro-joy-pad"><span className="micro-joy-knob" /></div>
            <div className="micro-joy-list">
              {JOY_DIRS.map(({ dir, label, arrow }) => (
                <div
                  key={dir}
                  className={'micro-joy-row' + (editDir === dir ? ' micro-joy-row--sel' : '')}
                  onClick={() => setEditDir(dir)}
                >
                  <span className="micro-joy-arrow">{arrow}</span>
                  <span className="micro-joy-dir">{label}</span>
                  <span className="micro-joy-val">{joyLabel(local[dir] ?? JOY_DEFAULTS[dir])}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="micro-joy-foot">
            <button type="button" className="micro-primary micro-joy-done" onClick={() => onSave(local)}>完成</button>
          </div>
        </div>
      </div>

      {editDir && (
        <JoyPicker
          title={JOY_DIRS.find((d) => d.dir === editDir)?.label}
          current={joyLabel(local[editDir] ?? JOY_DEFAULTS[editDir])}
          onClear={() => { setDir(editDir, JOY_NONE); setEditDir(null) }}
          onClose={() => { setEditDir(null) }}
          onPick={(name) => { setDir(editDir, name); setEditDir(null) }}
        />
      )}
    </>
  )
}

/**
 * 二级挑选弹窗（搜索 + 按类分组）。未接线（soon）的条目只展示、不可选。
 */
function JoyPicker({ title, current, onClear, onClose, onPick }) {
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const items = JOY_ACTIONS.filter((a) => (
    !s || a.name.toLowerCase().includes(s) || a.des.toLowerCase().includes(s) || joyLabel(a.name).includes(s)
  ))
  const cats = [...new Set(items.map((a) => a.cat))]
  return (
    <div className="micro-modal-overlay micro-overlay--sub" onMouseDown={onClose}>
      <div className="micro-modal micro-modal--sub" onMouseDown={(e) => e.stopPropagation()}>
        <div className="micro-modal-head">
          <div className="micro-sub-title">指定{title}</div>
          {current && (
            <button type="button" className="micro-sub-clear" onClick={onClear}>
              {current} <span>×</span>
            </button>
          )}
        </div>
        <input className="micro-modal-search" placeholder="搜索操作和技能" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="micro-sub-body">
          {cats.map((cat) => (
            <div key={cat}>
              <div className="micro-sub-cat">{cat}</div>
              {items.filter((a) => a.cat === cat).map((a, i) => (
                <div
                  key={cat + i}
                  className={'micro-sub-pick' + (a.soon ? ' micro-sub-pick--soon' : '')}
                  onClick={a.soon ? undefined : () => onPick(a.name)}
                >
                  <span className="micro-sub-name">{joyLabel(a.name)}</span>
                  <span className="micro-sub-des">{a.des}</span>
                </div>
              ))}
            </div>
          ))}
          {!items.length && <div className="micro-sub-empty">无匹配结果</div>}
        </div>
      </div>
    </div>
  )
}
