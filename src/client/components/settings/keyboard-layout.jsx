// dsh-micro · client/src/components/settings/keyboard-layout.jsx
// 设置页里的**布局可视化**：把设备画出来（三排键 + 底部一行），并让真机上的操作在布局里「演」出来。
//
// ---------- 布局特效：纯视觉，不触发任何功能 ----------
// 数据只来自 /micro/state（经 hid-bridge 的 subscribe 广播）：
//   down  —— 当前**按住**的键名数组。设备对每个物理键都发一对事件（`params.act` 1/0），
//            宿主把它翻译成这个字段（见 src/core/ble.js 的 HID_ACT）。特效就按它对齐：
//            **按下就陷下去、接到松开才抬起来**，不再用「按固定时长自己弹回」去猜。
//            判据在 ../press-state.js（纯 JS，自检与探针直接验同一份）。
//   keyT  —— 每个键名一个**按下次数**计数器：按得比一次轮询还快时（轮询拿到的 down 里已经
//            空了）补一次短闪，否则那颗键毫无反应。不能用 sticky 的 `key`：两次轮询之间
//            按下的不同键只看得到最后一个。
//   joy   —— 摇杆实时方向（推着非空、松手回 null），正好用来做「推拉 + 回弹」。
// 特效只给布局里的键加一个 class、给摇杆球一个 transform，**绝不调用任何 DSH 接口**：
// 按物理键时该触发的功能由 hid-bridge 那边照常触发，这里是旁路观测，不是第二条通路。
import { useEffect, useRef, useState } from 'react'
import { DSVI } from '../../core.js'
import { capFor, micRowKeys } from '../../utils/keycaps.js'
import { CUSTOM_ICON, keycapOf } from '../../keypad.js'
import { FLASH_MS, createPressTracker, samePressed } from '../../utils/press-state.js'
import { KNOB_DOT_DEG, KNOB_DOT_REST_DEG, createKnobTracker } from '../../utils/knob-state.js'
import { Key, KeyFace } from '../common/ui.jsx'
import { CapTip, capTipHandlers, useCapTip } from '../common/cap-tip.jsx'
import { MicroKeycapModal } from '../modals/keycap.jsx'
import { MicroJoystickModal } from '../modals/joystick.jsx'

/** 摇杆每个方向推出去多远（px）——「推拉摇动」的幅度。 */
export const JOY_SHIFT = 9

/** 摇杆方向 → 球体位移。 */
export const JOY_OFFSET = {
  up: [0, -JOY_SHIFT], down: [0, JOY_SHIFT], left: [-JOY_SHIFT, 0], right: [JOY_SHIFT, 0]
}

/**
 * 旋钮蓝点到圆心的距离（px）：圆盘半径 36 − 环宽 2 − 点半径 6 = 28，取 27 留 1px 余量
 * —— 点的外缘正好贴着蓝环内侧（对齐用户给的效果图），又不会压到环上。
 */
export const KNOB_DOT_R = 27

/**
 * 订阅 HID 状态，产出布局特效需要的两样东西。
 * @param {{current: boolean}} splitRef 「独立麦克风键」是否打开（用 ref 是为了不因开关
 *   变化而重建订阅 —— 重建会把按下状态与 keyT 基线清零，刚发生的按键就漏掉了）。
 * @returns {{pressed: object, joy: string|null, tap: Function}}
 *   pressed —— 视觉键 id → true（正在显示按下）；joy —— 当前摇杆方向；tap —— 本地点击也闪一次。
 */
function useHidSignals(splitRef) {
  const [pressed, setPressed] = useState({})
  const [joy, setJoy] = useState(null)
  /** 旋钮的转动指示：{active, dir} —— 环亮不亮、蓝点停哪一侧（见 ../utils/knob-state.js）。 */
  const [knob, setKnob] = useState({ active: false, dir: null })
  const trackerRef = useRef(null)
  if (trackerRef.current === null) trackerRef.current = createPressTracker()
  const tracker = trackerRef.current
  const knobRef = useRef(null)
  if (knobRef.current === null) knobRef.current = createKnobTracker()
  const knobTracker = knobRef.current
  const shownRef = useRef({})
  const knobShownRef = useRef({ active: false, dir: null })

  // 状态机 → React：值没变就不 setState（轮询 120ms 一帧，每帧都写会白渲染）
  const commit = () => {
    const next = tracker.snapshot()
    if (!samePressed(next, shownRef.current)) { shownRef.current = next; setPressed(next) }
    // 旋钮只有「亮/灭」+「左/右」两个字段，比一下就够了
    const k = knobTracker.snapshot()
    if (k.active !== knobShownRef.current.active || k.dir !== knobShownRef.current.dir) {
      knobShownRef.current = k
      setKnob(k)
    }
  }

  /** 本地点击布局上的键：闪一下（手边没设备也要有反馈）。 */
  const tap = (visualId) => { tracker.tap(visualId); commit() }

  useEffect(() => {
    const hid = DSVI.services && DSVI.services.hid
    if (!hid || typeof hid.subscribe !== 'function') return undefined
    let lastJoy
    const off = hid.subscribe((s) => {
      tracker.fold(s, splitRef && splitRef.current)
      knobTracker.fold(s)
      commit()
      const j = s && typeof s.joy === 'string' && s.joy ? s.joy : null
      if (j !== lastJoy) { lastJoy = j; setJoy(j) }
    })
    // 短闪到期、旋钮活性窗口到期、宿主静默（按键状态不再可信）都需要有人收尾：
    // 订阅只在有帧时才被叫醒。
    const timer = setInterval(commit, Math.max(60, Math.round(FLASH_MS / 2)))
    return () => {
      off()
      clearInterval(timer)
      tracker.reset()
      knobTracker.reset()
      shownRef.current = {}
      knobShownRef.current = { active: false, dir: null }
    }
  }, [])

  return { pressed, joy, knob, tap }
}

/** 三排图标键的键码（顺序 = 布局里从左到右）。 */
const ACT_ROW_CODES = ['ACT06', 'ACT07', 'ACT08', 'ACT09']

/**
 * 布局可视化（Codex Micro 风格）。
 * @param update - 写回偏好（与设置页其它控件同一条持久化路径）。
 * @param prefs - 当前偏好快照（只看 micKey / actLabels / joystick）。
 * @param clearField - 清掉某个字段的用户层覆盖（回落 schema 默认），清空最后一颗键帽时用。
 * @param preview - **只画不响应**的预览模式（首次连接引导用）。给 `{ colors }` 时，
 *   6 颗智能体键的圆点改用 `colors[visualId]` 上色（示意键盘灯的颜色语言），
 *   并且所有键都不响应点击（不弹键帽编辑器 / 摇杆配置，也不播按压特效）。
 *   为什么要走同一个组件：引导里那张键盘图必须是**同一份绘制代码** —— 另写一份迟早
 *   画出两台不一样的键盘（键帽换了、麦克风键拆了，引导里还是老样子）。
 * @param t - 词典取值函数（**悬停气泡的第二行**要用；entry.js → panel.jsx → 这里）。可不传：
 *   不传时气泡自动省掉第二行（见 common/cap-tip.jsx 的 capTipLines），引导那张插图就不传。
 */
export function MicroLayout({ update, prefs = {}, clearField, preview = null, t }) {
  const actLabels = prefs.actLabels || {}
  const [editor, setEditor] = useState(null) // { target }
  const [joyOpen, setJoyOpen] = useState(false)
  // 预览模式：只画。信号照订（hooks 顺序不能变），但一律不反映到界面上。
  const staticShot = !!preview
  const swatch = (preview && preview.colors) || null
  const tt = typeof t === 'function' ? t : null
  // 悬停气泡：**只认键帽**（有功能的那些键）。6 颗智能体键不是键帽（它们是会话槽位），
  // 旋钮/摇杆是连续控件 —— 都不挂气泡，`data-micro-cap` 才是「这颗键有键帽」的判据。
  const { tip, show, hide } = useCapTip()
  const tipProps = (capId) => (staticShot ? {} : capTipHandlers(show, hide, keycapOf(capId)))
  // 底部那颗两倍宽的 Mic 键下面有两个开关：开关打开时拆成两颗键画（模型见 utils/keycaps.js）。
  const micSplit = !!prefs.micKey
  const micKeys = micRowKeys(prefs)
  const splitRef = useRef(micSplit)
  useEffect(() => { splitRef.current = micSplit }, [micSplit])
  // 真机信号 → 布局特效（纯视觉；见文件上方 useHidSignals 的说明）
  const { pressed, joy, knob, tap } = useHidSignals(splitRef)
  // 预览模式下摇杆不跟着真机推拉、旋钮也不亮（它们在引导里只是插图）；键帽/摇杆的弹窗也一律不开。
  const shownJoy = staticShot ? null : joy
  const shownPressed = staticShot ? {} : pressed
  const shownKnob = staticShot ? { active: false, dir: null } : knob
  // 蓝点角度：方向给出停靠位（顺时针 90° / 逆时针 -90°），只按下没转时用静止位。
  // **始终写一个角度**（而不是让点停在圆心）—— 首次顺时针转时点才会从左边滑到右边。
  const knobDeg = KNOB_DOT_DEG[shownKnob.dir] ?? KNOB_DOT_REST_DEG
  const openKeycap = (target) => () => {
    if (staticShot) return
    hide() // 弹窗一开就把气泡收起来（鼠标此刻可能还停在那颗键上，不收就浮在遮罩上）
    setEditor({ target })
  }
  // 写回键帽：target 是**键码**（actLabels 的键），不是视觉 id。
  const saveCap = (target, pick) => update('actLabels', { ...actLabels, [target]: pick })
  // 恢复默认 = 把这一格从 actLabels 里删掉（回落出厂键帽；拆分态那颗自定义键回落成「未指派」）。
  // 删空了就连字段一起 unset（见 settings/panel.jsx 的 clearField 注释）。
  const clearCap = (target) => {
    const next = { ...actLabels }
    delete next[target]
    if (!Object.keys(next).length && typeof clearField === 'function') return clearField('actLabels')
    return update('actLabels', next)
  }
  // 智能体键的圆点：预览模式给定的示意色优先（引导要展示「这几颗键靠颜色说话」）。
  const dot = (visualId) => (
    <div
      className={'micro-key-dot' + (swatch && swatch[visualId] ? ' micro-key-dot--swatch' : '')}
      style={swatch && swatch[visualId] ? { background: swatch[visualId] } : undefined}
    />
  )
  // 每个键挂上视觉 id（自检/探针按它定位）、键帽 id（探针据此核对「显示的是不是键帽」）
  // 与「正在按下」的 class。
  const slot = (visualId, onClick, extra = '') => ({
    'data-micro-key': visualId,
    className: [extra, shownPressed[visualId] ? 'micro-key--pressed' : ''].filter(Boolean).join(' '),
    onClick: staticShot ? undefined : (onClick || (() => tap(visualId)))
  })
  const [jx, jy] = JOY_OFFSET[shownJoy] || [0, 0]
  return (
    <div className={'micro-page-wrap' + (staticShot ? ' micro-page-wrap--preview' : '')}>
      <div className="micro-keyboard-wrap">
        <div className="micro-grid-4col">
          {/* Row1 左一旋钮：设备转动 / 按下时亮起蓝环，蓝点落在**这次转动的方向**上
              （顺时针 → 右侧 3 点、逆时针 → 左侧 9 点，判据见 utils/knob-state.js）。
              环与点都画在圆盘里面，所以圆盘那一层必须是定位祖先（见 settings.css）。 */}
          <div className="micro-control-item">
            <div className={'micro-control-base' + (shownKnob.active ? ' micro-knob--active' : '')}>
              <div className="micro-circle-knob-inner">
                <div className="micro-knob-ring" />
                <div
                  className="micro-knob-dot"
                  data-micro-knob-dot={shownKnob.dir || 'off'}
                  style={{ transform: `translate(-50%, -50%) rotate(${knobDeg}deg) translateY(${-KNOB_DOT_R}px)` }}
                />
              </div>
            </div>
          </div>
          <Key {...slot('r1-2')}>{dot('r1-2')}</Key>
          <Key {...slot('r1-3')}>{dot('r1-3')}</Key>
          {/* Row1 右一摇杆：点击弹出「模拟摇杆」方向配置；推杆时球体跟随方向偏移并回弹 */}
          <div
            className="micro-control-item micro-joy-ctrl"
            data-micro-key="joy"
            onClick={staticShot ? undefined : () => setJoyOpen(true)}
          >
            <div className="micro-control-base">
              <div
                className="micro-joystick-dot"
                data-joy={shownJoy || 'center'}
                style={{
                  transform: `translate(${jx}px, ${jy}px)`,
                  transition: shownJoy ? 'transform .1s ease-out' : 'transform .28s cubic-bezier(.34,1.56,.64,1)'
                }}
              />
            </div>
          </div>

          {/* Row2 */}
          <Key {...slot('r2-1')}>{dot('r2-1')}</Key>
          <Key {...slot('r2-2')}>{dot('r2-2')}</Key>
          <Key {...slot('r2-3')}>{dot('r2-3')}</Key>
          <Key {...slot('r2-4')}>{dot('r2-4')}</Key>

          {/* Row3 动作键（ACT：点击弹出「编辑按键」）。
              **画的是键帽、不是物理键码**：给 ACT07 选了 MIC，它就得长成麦克风的样子
              （键帽即功能，见 keypad.js）。以前这里印的是 actLabels 的原始值，
              于是选完 SEND 键上显示的是 'ACT12' —— 看起来像「设置了没用」。
              **只有图标、没有键下文字**（像真键盘那样）：名字走悬停气泡（tipProps）。 */}
          {ACT_ROW_CODES.map((code) => {
            const capId = capFor(code, prefs)
            const visualId = code.toLowerCase()
            return (
              <Key
                key={code}
                {...slot(visualId, openKeycap(code), 'micro-key--act' + (capId ? '' : ' micro-key--custom'))}
                data-micro-cap={capId || CUSTOM_ICON}
                {...tipProps(capId)}
              >
                <KeyFace capId={capId} />
              </Key>
            )
          })}
        </div>

        {/* 底部一行：旋钮面板 · Mic 键（两个开关，见 utils/keycaps.js）· 发送键
            data-micro-mic 把当前状态写在 DOM 上：探针据此判断该期望一颗宽键还是两颗键，
            不必去猜 aria-label 的本地化文案。 */}
        <div className="micro-bottom-row" data-micro-mic={micSplit ? 'split' : 'merged'}>
          <div className="micro-knob-panel">
            <div className="micro-knob-lights">
              <div className="micro-knob-light micro-blue"/>
              <div className="micro-knob-light micro-green"/>
              <div className="micro-knob-light micro-amber"/>
            </div>
            <div className="micro-circle-knob"/>
          </div>

          {micKeys.map((k) => (
            <Key
              key={k.visualId}
              {...slot(
                k.visualId,
                openKeycap(k.code),
                (k.wide ? 'micro-key-mic ' : '') + 'micro-key--act' + (k.custom ? ' micro-key--custom' : '')
              )}
              data-micro-cap={k.capId || CUSTOM_ICON}
              {...tipProps(k.capId)}
            >
              <KeyFace capId={k.capId} />
            </Key>
          ))}

          {(() => {
            const capId = capFor('ACT12', prefs)
            return (
              <Key
                {...slot('act12', openKeycap('ACT12'), 'micro-key--act' + (capId ? '' : ' micro-key--custom'))}
                data-micro-cap={capId || CUSTOM_ICON}
                {...tipProps(capId)}
              >
                <KeyFace capId={capId} />
              </Key>
            )
          })()}
        </div>
      </div>

      {!staticShot && editor && (
        <MicroKeycapModal
          target={editor.target}
          current={actLabels[editor.target] || null}
          fallback={capFor(editor.target, prefs)}
          t={tt}
          onCancel={() => setEditor(null)}
          onClear={() => { clearCap(editor.target); setEditor(null) }}
          onSave={(pick) => { saveCap(editor.target, pick); setEditor(null) }}
        />
      )}

      {!staticShot && joyOpen && (
        <MicroJoystickModal
          value={prefs.joystick}
          onClose={() => setJoyOpen(false)}
          onSave={(cfg) => { update('joystick', cfg); setJoyOpen(false) }}
        />
      )}

      {/* 悬停气泡本体（position:fixed，见 common/cap-tip.jsx —— 这里也在卡片里，
          相对定位会被卡片的圆角/滚动裁到）。放最外层是为了让它压在键上面。 */}
      <CapTip tip={tip} t={tt || undefined} />
    </div>
  )
}
