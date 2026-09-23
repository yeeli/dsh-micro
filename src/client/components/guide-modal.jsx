// dsh-omkb · client/src/components/guide-modal.jsx
// **首次连接引导**：设备第一次连上时弹出的三步说明（封面 + 智能体按键 + 命令键）。
//
// 谁决定「弹不弹」：`../guide.js` 的 GuideController（盯 /omkb/state 的 open +
// 落盘的 guideSeen）。这个文件只负责画，以及把按钮点回控制器 —— 判断逻辑一点都不放这儿，
// 因为那几条规则要在自检里直接断言（组件是 JSX，Node 进不去）。
//
// 挂在哪里：侧边栏底部槽位（sidebar.footer.action）里的 OmkbGuideHost。弹窗自己是
// `position:fixed` 的整屏遮罩（与设置页那几个弹窗同一种做法），所以挂在哪个槽位都盖满视口。
//
// 键盘插图走 `<OmkbLayout preview>` —— **同一份绘制代码**，不是另画一张。用户在引导里
// 看到的就是设置页里那台键盘（键帽换过了、麦克风键拆开了，这里也跟着变）。
//
// 为什么点遮罩不关闭：别的弹窗点外面即关，引导不行 —— 它一旦关掉就**永久记住「看过了」**，
// 一次误点等于再也没机会看到。所以只认三个明确出口：右上角 ×、跳过、走到最后一步。
import { useEffect, useState } from 'react'
import { DSVI } from '../core.js'
import { MONITOR_URL, monitorDot, monitorVisible } from '../utils/monitor.js'
import { GUIDE_LEGEND, agentSwatchByVisualId, isFirstStep, isLastStep, rgbHex } from '../utils/guide.js'
import { OmkbLayout } from './keyboard-layout.jsx'

/** 6 颗智能体键的示意配色（四种状态都摆出来），在模块加载时算一次即可。 */
const SWATCH = agentSwatchByVisualId()

/** 三屏的标题 / 正文文案键。 */
const TITLE = { welcome: 'guide.welcome.title', agents: 'guide.agents.title', commands: 'guide.commands.title' }
const DESC = { welcome: 'guide.welcome.desc', agents: 'guide.agents.desc', commands: 'guide.commands.desc' }

/** 图例每一行的补充说明（图例本身只说「什么颜色」，这里说「什么意思」）。 */
const LEGEND_HINT = {
  'guide.legend.running': 'guide.legend.runningHint',
  'guide.legend.idle': 'guide.legend.idleHint',
  'guide.legend.error': 'guide.legend.errorHint',
  'guide.legend.empty': 'guide.legend.emptyHint'
}

const snapshot = (g) => ({ open: !!(g && g.open), step: (g && g.step) || 'welcome' })

/**
 * 引导的**宿主**：订阅控制器，只在它说「该弹」时渲染。
 * @param t - 本插件命名空间的词典函数（槽位注册时声明 locale 由框架注入）。
 * @param onOpenSettings - 「设置」按钮：由挂载点传入（它手里有 openKeyboardSettings）。
 */
export function OmkbGuideHost({ t, onOpenSettings }) {
  const guide = DSVI.services ? DSVI.services.guide : null
  const [snap, setSnap] = useState(() => snapshot(guide))

  useEffect(() => {
    if (!guide || typeof guide.subscribe !== 'function') return undefined
    setSnap(snapshot(guide))
    return guide.subscribe(() => setSnap(snapshot(guide)))
  }, [guide])

  if (!guide || !snap.open) return null
  return <OmkbGuide t={t} guide={guide} step={snap.step} onOpenSettings={onOpenSettings} />
}

/**
 * 引导本体。
 * @param t - 词典函数。
 * @param guide - GuideController（按钮直接调它的 next/back/dismiss/replay）。
 * @param step - 当前屏（'welcome' | 'agents' | 'commands'）。
 * @param onOpenSettings - 打开「设置 → OMKB 键盘」；缺省时那个按钮不显示。
 */
function OmkbGuide({ t, guide, step, onOpenSettings }) {
  const dict = (DSVI.locales && DSVI.locales.zh) || {}
  const tt = typeof t === 'function' ? t : (k) => dict[k] || k

  // 输入监控状态：**只在引导打开时问一次**（宿主 spawn osascript，本身有缓存，见 core/monitor.js）。
  // 首次连接正是「需要知道这个权限有没有给」的时刻，所以把它放在封面上而不是藏在设置页里。
  const [monitor, setMonitor] = useState(null)
  useEffect(() => {
    if (typeof fetch !== 'function') return undefined
    let alive = true
    fetch(MONITOR_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (alive && m && typeof m === 'object') setMonitor(m) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const md = monitorDot(monitor)
  const last = isLastStep(step)
  const close = () => guide.dismiss()
  const goSettings = () => {
    // 先收起来再跳设置：引导是整屏遮罩，压在设置弹窗上面会让人以为「点了设置没反应」。
    close()
    if (typeof onOpenSettings === 'function') onOpenSettings()
  }

  return (
    <div className="omkb-modal-overlay omkb-guide-overlay">
      <div className="omkb-modal omkb-guide" data-omkb-guide={step} role="dialog" aria-modal="true">
        <button type="button" className="omkb-modal-x omkb-guide-x" onClick={close} aria-label={tt('guide.close')}>×</button>

        {/* 键盘插图：同一份布局代码的预览模式 */}
        <div className="omkb-guide-shot">
          <OmkbLayout update={noop} prefs={guide.prefs || {}} preview={{ colors: SWATCH }} />
        </div>

        <div className="omkb-guide-body">
          <div className="omkb-guide-title">{tt(TITLE[step] || TITLE.welcome)}</div>
          <div className="omkb-guide-desc">{tt(DESC[step] || DESC.welcome)}</div>

          {step === 'welcome' && (
            <div className="omkb-guide-status">
              <span className="omkb-dot omkb-dot--ok" />
              <span>{tt('guide.connected')}</span>
              {monitorVisible(monitor) && (
                <>
                  <span className="omkb-guide-sep">·</span>
                  <span className={'omkb-dot ' + md.cls} />
                  <span className={md.statusCls}>{tt('guide.monitor')} {tt(md.labelKey)}</span>
                </>
              )}
            </div>
          )}

          {step === 'agents' && (
            <div className="omkb-guide-legend">
              {GUIDE_LEGEND.map((row) => (
                <div className="omkb-guide-legend-row" key={row.key}>
                  <span className="omkb-guide-swatch" style={{ background: rgbHex(row.color) }} />
                  <span className="omkb-guide-legend-name">{tt(row.labelKey)}</span>
                  <span className="omkb-guide-legend-hint">{tt(LEGEND_HINT[row.labelKey] || '')}</span>
                </div>
              ))}
            </div>
          )}

          {step === 'commands' && (
            <div className="omkb-guide-note">{tt('guide.commands.note')}</div>
          )}
        </div>

        <div className="omkb-modal-foot omkb-guide-foot">
          {!isFirstStep(step) && (
            <button type="button" className="omkb-ghost" onClick={() => guide.back()}>{tt('guide.back')}</button>
          )}
          {step === 'welcome' && (
            <button type="button" className="omkb-ghost" onClick={close}>{tt('guide.skip')}</button>
          )}
          {last && typeof onOpenSettings === 'function' && (
            <button type="button" className="omkb-ghost" onClick={goSettings}>{tt('guide.settings')}</button>
          )}
          {/* 主按钮：封面 →「开始两步导览」；中间屏 →「最后一步」；最后一屏 →「开始构建！」（= 收起来） */}
          {last
            ? <button type="button" className="omkb-primary" onClick={close}>{tt('guide.finish')}</button>
            : (
              <button type="button" className="omkb-primary" onClick={() => guide.next()}>
                {tt(step === 'welcome' ? 'guide.start' : 'guide.last')}
              </button>
            )}
        </div>
      </div>
    </div>
  )
}

/** 传给预览布局的空更新函数：预览模式不响应任何交互，这个永远不会被调到。 */
const noop = () => {}
