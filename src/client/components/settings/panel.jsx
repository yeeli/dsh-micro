// dsh-omkb · client/src/components/settings/panel.jsx
// **设置面板本体**（DSH 设置页里的「OMKB 键盘」分区）：连接状态、输入监控提示、
// 亮度/自动调暗（写回 HID）、布局可视化（引用 settings/keyboard-layout.jsx）、以及按键/旋钮映射等
// 本地偏好（持久化走 DSH 的设置表单 `ctx.configForms.get('dsh-omkb')`）。
//
// 这个文件同时是**设置样式 settings.css 的注入处**（DSVI.css += settings.css?raw）。
// ⚠ **默认值不在这个文件里了**：2026-09-26 起全部集中到 `../config/default.js`
// （偏好默认值 + 布局出厂键帽 + 第三方插件清单），这里只 import 进来用 —— 那份必须与宿主
// schema（src/core/settings.js）逐字段对齐，理由见 default.js 顶部。
import { useEffect, useRef, useState } from 'react'
import { DSVI, archivedIdsOf, visibleSessions } from '../../core.js'
import { MONITOR_URL, PRIVACY_URL, monitorDot, monitorNeedsSettings, monitorVisible } from '../../utils/monitor.js'
// 「写入算不算成功」的判据与重试策略只有一份（utils/device.js）——设置页与控制器的
// 所有落盘都按同一口径判（DSH 的 scope.set() 失败时 promise 照样 resolve）。
import { SCOPE_RETRY, batteryView, isDeviceHidden, readbackOk, sameJson } from '../../utils/device.js'
// 旋钮自定义分配的选项来自功能总表（与键帽候选、按下分派同一份，见 actions/registry.js）
import { knobActions, actionById } from '../../actions/registry.js'
// 默认配置（偏好默认值 + 第三方插件清单）只在 config/default.js 里写一份 —— 见下面的
// 「默认偏好」段。这个 import 是**唯一**读默认值的地方，别在此处再手写一份字面量。
import { OMKB_DEFAULTS, PLUGIN_DEPS } from '../../config/default.js'
import '../../config/locales.js'
import settingsCss from '../../assets/settings.css?raw'
import { OmkbLayout } from './keyboard-layout.jsx'
import { OmkbResetModal } from '../modals/reset.jsx'
import { OmkbRemoveModal } from '../modals/remove.jsx'
import { OmkbSaveToast } from '../toast/save.jsx'
import { BatteryIcon } from '../common/ui.jsx'
// 移除之后要把设置弹窗从本分区切走（我们的导航行会被藏起来，停在原地只剩一块空白内容区）。
// 导航行怎么找只有那一个地方知道（findSectionRow/candidateLabels 也在那儿）。
import { leaveOurSection } from '../sidebar/action.jsx'

// ---------- 默认偏好 ----------
// **值不在这里**，在 ../config/default.js（客户端默认配置的唯一声明处，用户要求「把 OMKB 中的
// 默认设置参数配置都写在这个文件中，方便后续更换」）。这里只把它挂到共享 DSVI 上：
//   · 本文件的 update/clearField/resetLayout 用 DSVI.OMKB_DEFAULTS[key] 取默认值；
//   · entry.js 把它交给 DeviceController（「移除键盘」要清空**全部**字段，清单从这里来）。
// 为什么必须与宿主 schema（src/core/settings.js）逐字段对齐：任一字段只在一侧声明，
// 设置页写它时就会被宿主判为「无契约」，重启后静默丢失。自检有两套断言守着这条。
DSVI.OMKB_DEFAULTS = OMKB_DEFAULTS

// 设置样式追加到共享 DSVI.css（随 installStyles 注入，见 ../assets/settings.css）
DSVI.css += settingsCss

// 翻译字典已拆分到 ../config/locales.js（side-effect import 挂载到 DSVI.locales）。

// 从会话列表快照里取「侧边栏可见」的会话（供「自定义分配」下拉读取）。
// 判据与键盘灯共用 core.js 的 sessionVisible：下拉里能被选中的，才是灯能亮、键能打开的。
const listSessions = (snapshot, workspaces) => visibleSessions(snapshot, archivedIdsOf(workspaces))

/**
 * 旋钮自定义分配里可选的功能（键 → 词典键）。
 * **来自功能总表**（../actions/registry.js）：与「编辑按键」弹窗的候选、按下时的分派同一份 ——
 * 所以加/删一个功能只改那一处，三个地方自动跟着变（这里曾经另抄一张清单，已经删掉）。
 * 总表顺序即这里的顺序：先是能当键帽的那些功能，最后是旋钮专属的导航/滚动/推理。
 */
const KNOB_ACTION_OPTIONS = knobActions().map((a) => [a.id, a.label])

/** 旋钮自定义分配的四个手势（键 → 文案 key）。 */
const GESTURES = [
  ['cw', 'opts.knobCustom.cw'],
  ['ccw', 'opts.knobCustom.ccw'],
  ['click', 'opts.knobCustom.click'],
  ['long', 'opts.knobCustom.long']
]

/**
 * 功能 id → 展示短名（「第三方插件」卡片里「依赖它的功能」那一列用）。
 * 优先键帽短名（name，如 MIC / ARCH），没有短名（旋钮专属手势）就落回词典 label，
 * 词典也没有就原样显示 id。三种都是可读的，绝不让界面冒出 undefined。
 */
const pluginKeyLabel = (id, tt) => {
  const entry = actionById(id)
  if (entry && entry.name) return entry.name
  if (entry && entry.label) return tt(entry.label)
  return String(id)
}

/** 自动调暗的可选档位（秒 → 文案 key）。 */
const AUTO_DIM_OPTIONS = [
  [0, 'autoDim.off'],
  [30, 'autoDim.30s'],
  [60, 'autoDim.1m'],
  [120, 'autoDim.2m'],
  [300, 'autoDim.5m']
]

/**
 * 设置分区组件（由 entry.js 注册到 settings.section 槽位）。
 * @param scope - 设置表单的绑定（读写命名空间 dsh-omkb）。
 * @param t - 词典函数。
 * @param sessions / workspaces - 会话与工作区服务（自定义分配下拉要用）。
 */
export function OmkbSettingsSection({ scope, t, sessions, workspaces }) {
  const tt = t || ((k) => k)

  // 会话列表（供「自定义分配」下拉读取）：与键盘灯共用同一可见性判据
  const [sessionsList, setSessionsList] = useState(() =>
    sessions && sessions.list ? listSessions(sessions.list.getSnapshot(), workspaces) : []
  )
  useEffect(() => {
    const list = sessions && sessions.list ? sessions.list : null
    const wsList = workspaces && workspaces.list ? workspaces.list : null
    const onChange = () => setSessionsList(list ? listSessions(list.getSnapshot(), workspaces) : [])
    const off = list && typeof list.subscribe === 'function' ? list.subscribe(onChange) : null
    // 归档状态变化也会改变这份列表（归档的会话要从下拉里消失）
    const offWs = wsList && typeof wsList.subscribe === 'function' ? wsList.subscribe(onChange) : null
    onChange()
    return () => { if (off) off(); if (offWs) offWs() }
  }, [sessions, workspaces])

  // 初始偏好：settingsScope 快照 ?.value 合并默认值
  const initial = (() => {
    try {
      const s = scope && scope.getSnapshot()
      const v = s && s.value
      return v && typeof v === 'object' ? v : {}
    } catch (e) { return {} }
  })()
  const [prefs, setPrefs] = useState(() => ({ ...DSVI.OMKB_DEFAULTS, ...initial }))

  // 订阅 scope 的后续变更，保持 UI 与持久化值同步
  useEffect(() => {
    if (!scope || typeof scope.subscribe !== 'function') return undefined
    const off = scope.subscribe(() => {
      try {
        const s = scope.getSnapshot()
        const v = s && s.value
        if (v && typeof v === 'object') {
          setPrefs((p) => ({ ...p, ...v }))
        }
      } catch (e) {}
    })
    return off
  }, [scope])

  // 保存状态反馈：idle / saving / saved / error —— 由顶部悬浮提示呈现（OmkbSaveToast）。
  // 成功留 1.8s（够看清又不碍事），失败留 3.2s（要读完「保存失败」这个坏消息）。
  const SAVE_TOAST_MS = { saved: 1800, error: 3200 }
  const [saveStatus, setSaveStatus] = useState(null) // null=idle, 'saving', 'saved', 'error'
  const saveTimer = useRef(null)
  const showSaveStatus = (status) => {
    setSaveStatus(status)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const hold = SAVE_TOAST_MS[status]
    saveTimer.current = hold ? setTimeout(() => setSaveStatus(null), hold) : null
  }

  // 连接状态 + 电量：都来自同一个端点（/omkb/state），一次轮询一起取。
  // 电量走这里而不是走 DeviceController，是因为**只有这一行要用它**（控制器只管移除/恢复）。
  const [conn, setConn] = useState({ open: false, product: null, battery: null, charging: false })
  /** 「重置布局」确认弹窗是否打开（破坏性操作，先摆清楚再动手）。 */
  const [resetOpen, setResetOpen] = useState(false)
  /** 「移除键盘」确认弹窗是否打开（同样是破坏性操作）。 */
  const [removeOpen, setRemoveOpen] = useState(false)

  // scope 快照（未绑定 / 命名空间未注册时为 null）。
  const readScope = () => {
    try { return scope && typeof scope.getSnapshot === 'function' ? scope.getSnapshot() : null }
    catch (e) { return null }
  }
  // 回读校验：写入的 promise 结算时，共享镜像可能还没刷新到这一版（同一 tick 内
  // 的后续写入也会把前一次标记为 superseded），因此失败时短暂重试几次再判定。
  // 判据与重试策略取自 utils/device.js（与 client/device.js 的移除/恢复同源）。
  const readBack = (check, tries = SCOPE_RETRY.tries) => new Promise((resolve) => {
    let left = tries
    const attempt = () => {
      const snap = readScope()
      if (readbackOk(snap) && check(snap)) { resolve(true); return }
      left -= 1
      if (left <= 0) { resolve(false); return }
      setTimeout(attempt, SCOPE_RETRY.delayMs)
    }
    attempt()
  })

  // 写入持久层。
  //
  // 必须回读校验：DSH 客户端的 scope.set() 在「命名空间未注册 / 只读 / 校验失败」时
  // 同样会 resolve（内部 recover 后直接 return），只挂 then/catch 会把失败显示成
  // 「已保存」——这正是「界面提示已保存、重启却全部丢失」的假象来源。落盘与否以
  // 回读到的快照为准（status === 'ready' 且该字段的值确实等于期望值）。
  //
  // run/expected 分开是为了同时服务两种写法：set(值) 与 unset(清掉覆盖、回落默认)。
  const writeSeq = useRef(0)
  const persistWrite = (key, run, expected, opts = {}) => {
    const silent = opts.silent === true
    const sc = scope
    if (!sc) {
      if (!silent) showSaveStatus('error')
      return Promise.resolve(false)
    }
    const before = readScope()
    if (before && before.status === 'unavailable') {
      // 命名空间没有在宿主侧注册：写入必定被丢弃，直接如实报错。
      if (!silent) showSaveStatus('error')
      return Promise.resolve(false)
    }
    const seq = ++writeSeq.current
    if (!silent) showSaveStatus('saving')
    return Promise.resolve(run()).then(
      () => readBack((snap) => snap.writable !== false && sameJson((snap.value || {})[key], expected)).then((ok) => {
        // 只由最新一次写入决定状态，避免快速连续操作时被前一次的结论覆盖。
        if (!silent && seq === writeSeq.current) showSaveStatus(ok ? 'saved' : 'error')
        return ok
      }),
      () => {
        if (!silent && seq === writeSeq.current) showSaveStatus('error')
        return false
      }
    )
  }
  const persist = (key, value, opts = {}) => {
    const sc = scope
    if (!sc || typeof sc.set !== 'function') {
      if (opts.silent !== true) showSaveStatus('error')
      return Promise.resolve(false)
    }
    return persistWrite(key, () => sc.set(key, value), value, opts)
  }
  /**
   * 清掉某个字段的用户层覆盖（回落 schema 默认）。
   * 为什么「清空最后一颗键帽」要走 unset 而不是 set({})：设置文件里只该留**用户真的
   * 改过什么**。写个空对象在语义上等价（schema 默认就是 {}），但会让文件里永远挂着一行
   * 「改过 actLabels」——排查「这条设置是哪来的」时是噪声。
   * 老客户端没有 unset 时退回 set(默认值)，语义一致（都是「回落默认」）。
   */
  const clearField = (key, opts = {}) => {
    const sc = scope
    if (!sc) {
      if (opts.silent !== true) showSaveStatus('error')
      return Promise.resolve(false)
    }
    if (typeof sc.unset !== 'function') return persist(key, DSVI.OMKB_DEFAULTS[key], opts)
    return persistWrite(key, () => sc.unset(key), DSVI.OMKB_DEFAULTS[key], opts)
  }

  // 连续调整的控件（亮度滑杆）：**拖完之后才发一次**。
  //
  // 为什么不在拖动过程中逐帧下发：亮度一格 1%，快拖一次就是几十次变化，每条 rgbcfg
  // 要拆成多个 64 字节 report 连发，设备根本跟不上（表现就是灯乱跳/只认最后一条）。
  // 所以两条通道都只在**停止拖动之后**发最终值那一次：键盘灯干净地落到目标亮度。
  const pending = useRef(new Map()) // key → { timer, send }
  const debounceSend = (key, send, ms) => {
    const prev = pending.current.get(key)
    if (prev && prev.timer) clearTimeout(prev.timer)
    const entry = { send, timer: null }
    pending.current.set(key, entry)
    entry.timer = setTimeout(() => {
      pending.current.delete(key)
      send()
    }, ms)
  }
  // 卸载时把还没发出去的最后一次补上，避免「拖完立刻关掉设置页」连一条都没发出去。
  useEffect(() => () => {
    for (const [, entry] of pending.current) {
      if (entry.timer) clearTimeout(entry.timer)
      if (entry.send) entry.send()
    }
    pending.current.clear()
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const update = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    // 写入持久层
    return persist(key, value)
  }
  const postConfig = (patch) => {
    if (typeof fetch === 'function') {
      fetch('/omkb/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch)
      }).catch(() => {})
    }
  }
  const setBrightness = (v) => {
    setPrefs((p) => ({ ...p, brightness: v }))
    // rgb 只在**拖拽结束后**发一次（停止 220ms 后）：拖动过程中逐帧下发设备跟不上，
    // 灯会乱跳、最后还只认松手那一条，不如干脆只发最终值。
    debounceSend('brightness:rgb', () => postConfig({ brightness: v }), 220)
    // 落盘同样等拖完（300ms）：一次拖动只写一次盘
    debounceSend('brightness:save', () => persist('brightness', v), 300)
  }
  const setAutoDim = (v) => {
    setPrefs((p) => ({ ...p, autoDim: v }))
    postConfig({ autoDim: v })
    persist('autoDim', v)
  }

  // 重置布局：清除用户覆盖字段，让设置恢复到 schema 默认值。
  // 含 guideSeen：清掉之后下次连上设备会**重新弹一次首次连接引导**（与重置弹窗里那条文案对应）。
  const resetLayout = () => {
    const keys = ['agentKey', 'knob', 'micKey', 'agentAssign', 'knobCustom', 'actLabels', 'joystick', 'guideSeen']
    setPrefs((p) => {
      const next = { ...p }
      for (const key of keys) next[key] = DSVI.OMKB_DEFAULTS[key]
      return next
    })
    const sc = scope
    const canUnset = !!sc && typeof sc.unset === 'function'
    const canSet = !!sc && typeof sc.set === 'function'
    if (!canUnset && !canSet) { showSaveStatus('error'); return }
    // unset 是首选路径：清掉用户层覆盖后重新继承 schema 默认值，
    // 字段也就回到「没有被用户改过」的状态。
    //
    // 逐个 await 而不是并发：客户端的写队列只把「最新一代」的结果折回镜像，
    // 并发下发会让除最后一条外的写入拿不到回执，回读校验就会误判为失败。
    const seq = ++writeSeq.current
    showSaveStatus('saving')
    let chain = Promise.resolve()
    for (const key of keys) {
      chain = chain.then(() => {
        const run = canUnset
          ? Promise.resolve(sc.unset(key))
          : Promise.resolve(sc.set(key, DSVI.OMKB_DEFAULTS[key]))
        return run.catch(() => {}) // 单次失败不中断，成败由末尾的统一回读判定
      })
    }
    chain.then(() => readBack((snap) => keys.every(
      // 「清掉了」有两种同样正确的样子：DSH 的镜像会把 schema 默认值补齐（unset 之后读回来
      // 是默认值），有的版本则干脆不返回这个字段。两种都算成功 —— 只认前者，换个 DSH
      // 版本就会把「写成功了」报成失败（见 client/device.js 里同一处判据）。
      (key) => (snap.value || {})[key] === undefined || sameJson((snap.value || {})[key], DSVI.OMKB_DEFAULTS[key])
    ))).then((ok) => {
      if (seq === writeSeq.current) showSaveStatus(ok ? 'saved' : 'error')
    })
  }

  // 轮询连接状态与电量（1s）
  useEffect(() => {
    if (typeof fetch !== 'function') return undefined
    const poll = () => {
      fetch('/omkb/state', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (!s || typeof s !== 'object') return
          // battery / charging 由宿主从设备的 device.status 上报里取（见 src/core/ble.js）。
          // 老宿主没有这两个字段 → undefined → batteryView 判成「不知道」，显示「—」。
          setConn({ open: !!s.open, product: s.product || null, battery: s.battery, charging: s.charging })
        })
        .catch(() => {})
    }
    poll()
    const timer = setInterval(poll, 1000)
    return () => clearInterval(timer)
  }, [])

  const reconnect = () => {
    if (typeof fetch === 'function') fetch('/omkb/reconnect', { method: 'POST' }).catch(() => {})
  }

  // 输入监控授权状态：浏览器问不到系统权限，得让宿主去问（见 src/core/monitor.js）。
  // 宿主那次查询要 spawn 一个 osascript，所以轮询放慢到 5 秒，另外给「重新检测」强制刷新。
  const [monitor, setMonitor] = useState(null)
  useEffect(() => {
    if (typeof fetch !== 'function') return undefined
    let alive = true
    const read = () => fetch(MONITOR_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (alive && s && typeof s === 'object') setMonitor(s) })
      .catch(() => {})
    read()
    const timer = setInterval(read, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  const recheckMonitor = () => {
    if (typeof fetch !== 'function') return
    fetch(MONITOR_URL + '?force=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s && typeof s === 'object') setMonitor(s) })
      .catch(() => {})
  }
  // 跳系统设置的隐私面板：浏览器不能启动进程，交给宿主 open（POST /omkb/open-privacy）。
  const openPrivacy = () => {
    if (typeof fetch !== 'function') return
    fetch(PRIVACY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pane: 'listen' })
    }).catch(() => {})
  }

  // 移除这台键盘：一句话交给控制器（清空全部偏好 → 立 removed 标记 → **回读确认**）。
  //
  // 为什么收界面的时机由控制器决定而不是这里：写盘没成就不该把界面收掉（否则会出现
  // 「界面没了、设置还在、一刷新又回来」）。这里只负责把「保存中 / 失败」如实反馈出来。
  // 成功之后界面会自己消失（本组件在 hidden 时返回 null），所以成功了不必再提示什么。
  const doRemove = () => {
    setRemoveOpen(false)
    const dev = DSVI.services ? DSVI.services.device : null
    if (!dev || typeof dev.remove !== 'function') { showSaveStatus('error'); return }
    showSaveStatus('saving')
    Promise.resolve(dev.remove()).then((ok) => {
      showSaveStatus(ok ? 'saved' : 'error')
      // 我们的导航行马上会被藏起来：若此刻正停在本分区，把用户送到别的分区去，
      // 否则他面对的是一块空白内容区（看着像坏了）。失败/找不到别的行就算了。
      if (ok) { try { leaveOurSection(tt('nav')) } catch (e) {} }
    })
  }

  // 打开本分区 → 让桥接层进入「只演示不执行」（见 hid-bridge 的 enterSim）。效果：
  // 这一页里的按键 / 旋钮 / 摇杆只演给用户看，不真的切会话、切规划模式、发消息、批准审批。
  // 一边一张：挂载进、卸载出 —— React 的清理函数就是那个释放函数（幂等），不必自己配对。
  // 判据就是「本组件挂在树上」= 用户正看着 OMKB 键盘这一页（设置弹窗停在别的分区时按钮照常生效）。
  // **智能体键（AG00..AG05）不在此列**：按下去仍然真的打开会话（用户 2026-09-25 明确要求）。
  // ⚠ 位置有讲究：必须在下面 `if (hidden) return null` **之前**（所有 hooks 都要在早返回前），
  // 否则「设备被移除」那条路径上 hooks 数量会变，React 直接报错。
  useEffect(() => {
    const hid = DSVI.services ? DSVI.services.hid : null
    if (!hid || typeof hid.enterSim !== 'function') return undefined
    return hid.enterSim()
  }, [])

  const brightnessPct = Math.round((prefs.brightness ?? DSVI.OMKB_DEFAULTS.brightness) * 100)
  const autoDim = prefs.autoDim ?? 0
  const agentKey = prefs.agentKey ?? 'recent'
  const knob = prefs.knob ?? 'navigate'
  const knobCustom = prefs.knobCustom || {}

  // ---------- 第三方插件依赖 ----------
  // 清单来自 **配置**（../config/default.js 的 PLUGIN_DEPS）：哪个按键功能需要额外安装哪个
  // DSH 插件，是**静态声明**，不查系统、也不看服务在不在 —— 用户 2026-09-26 明确要求
  // 「不用去检测系统了」（此前是「每条功能声明 requires + ctx.get(service) 现场判装没装」，
  // 那份模型已撤掉，见 actions/registry.js 的说明）。
  // 因此这张卡**常驻**（清单为空时给一行占位），用户随时看得见这个模块、加条目立刻生效。
  const plugins = PLUGIN_DEPS.map((d) => ({
    plugin: String(d.plugin),
    name: d.name || String(d.plugin),
    desc: d.desc || '',
    // 安装状态：**default.js 里手写的字段**，右侧徽标照它渲染（缺省 = 未安装）。
    installed: d.installed === true,
    usedBy: Array.isArray(d.usedBy) ? d.usedBy.filter((id) => typeof id === 'string' && id) : []
  }))
  // 电量：低电量阈值、「没读数」怎么显示，判据都在 utils/device.js 里（自检直接验它）。
  const batt = batteryView(conn)
  // 「点过移除 + 设备没连上」→ 整个分区收起。判据与侧边栏入口、设置页导航行**同一份**
  // （utils/device.js 的 isDeviceHidden），三处各写一个 if 迟早会漂移。
  // 正常路径下用户根本到不了这里（导航行被藏了）；它是「正开着这一页时点了移除」的兜底。
  const hidden = isDeviceHidden({ removed: prefs.removed === true, open: conn.open })

  if (hidden) return null

  return (
    <div className="omkb-wrap">
      {/* 保存提示：固定视口顶部（脱离文档流，出现/消失都不顶动下方布局） */}
      <OmkbSaveToast status={saveStatus} t={tt} />

      {/* 标题（保存反馈已移到页面顶部的悬浮提示，不再挤在这里顶动布局） */}
      <div className="omkb-heading">
        <h2 className="omkb-title">{tt('settings.title')}</h2>
        <p className="omkb-subtitle">{tt('settings.subtitle')}</p>
      </div>

      {/* 连接状态 + 电量。
          电量行**只在真的连上时展示**：没连上时设备报不出电量（宿主把读数清成 null），
          摆一行「—」只会让人以为坏了 —— 那时候该看的是下面那句「怎么让它连上」。 */}
      <div className="omkb-card">
        <div className="omkb-row" style={{ borderTop: 'none' }}>
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('conn.title')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <span className={conn.open ? 'omkb-dot omkb-dot--ok' : 'omkb-dot omkb-dot--err'} />
            <span className={conn.open ? 'omkb-status omkb-status--ok' : 'omkb-status omkb-status--err'}>
              {conn.open ? tt('conn.connected') : tt('conn.disconnected')}
            </span>
          </div>
        </div>
        {conn.open ? (
          <div className="omkb-row" data-omkb-battery={batt.known ? String(batt.pct) : 'unknown'}>
            <div className="omkb-row__label">
              <div className="omkb-row__title">{tt('conn.battery')}</div>
            </div>
            <div className="omkb-row__ctrl">
              <span className={'omkb-batt' + (batt.low ? ' omkb-batt--low' : '')}>
                <BatteryIcon pct={batt.pct} charging={batt.charging} />
              </span>
              <span className={'omkb-batt__val' + (batt.low ? ' omkb-batt__val--low' : '')}>
                {batt.known ? batt.pct + '%' : '—'}
              </span>
              {batt.charging ? <span className="omkb-batt__tag">{tt('conn.charging')}</span> : null}
            </div>
          </div>
        ) : null}
        {conn.open ? null : (
          <div className="omkb-row">
            <div className="omkb-row__label">
              <div className="omkb-hint" style={{ marginTop: 0 }}>{tt('conn.desc')}</div>
            </div>
            <div className="omkb-row__ctrl">
              <button type="button" className="omkb-ghost" onClick={reconnect}>{tt('conn.retry')}</button>
              {/* 移除：连不上时告诉用户「不用了就把这台键盘摘掉」。
                  它清空的是**这台键盘的全部设置**，所以先弹确认（见 OmkbRemoveModal）。 */}
              <button type="button" className="omkb-ghost omkb-ghost--danger" onClick={() => setRemoveOpen(true)}>
                {tt('conn.remove')}
              </button>
            </div>
          </div>
        )}
      </div>

      {removeOpen ? (
        <OmkbRemoveModal
          tt={tt}
          onCancel={() => setRemoveOpen(false)}
          onConfirm={doRemove}
        />
      ) : null}

      {/* 输入监控（**仅 macOS 展示**）：状态由宿主去问系统，见 src/core/monitor.js。
          三态：已授权 / 未授权 / 无法判定 —— 不知道就说不确定，不猜、也不写死一句「请授权」。 */}
      {monitorVisible(monitor) ? (
        <div className="omkb-card">
          <div className="omkb-row">
            <div className="omkb-row__label">
              <div className="omkb-row__title">{tt('monitor.title')}</div>
              <div className="omkb-row__desc">{tt('monitor.desc')}</div>
            </div>
            <div className="omkb-row__ctrl">
              <span className={'omkb-dot ' + monitorDot(monitor).cls} />
              <span className={'omkb-status ' + monitorDot(monitor).statusCls}>{tt(monitorDot(monitor).labelKey)}</span>
            </div>
          </div>
          <div className="omkb-row">
            <div className="omkb-row__label">
              <div className="omkb-hint" style={{ marginTop: 0 }}>
                {monitor.granted === false ? tt('monitor.hintDenied')
                  : monitor.granted === true ? (monitor.detail || '')
                    : tt('monitor.hintUnknown')}
              </div>
            </div>
            <div className="omkb-row__ctrl">
              {monitorNeedsSettings(monitor) ? (
                <button type="button" className="omkb-ghost" onClick={openPrivacy}>{tt('monitor.open')}</button>
              ) : null}
              <button type="button" className="omkb-ghost" onClick={recheckMonitor}>{tt('monitor.retry')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 亮度 */}
      <div className="omkb-card">
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('brightness.title')}</div>
            <div className="omkb-row__desc">{tt('brightness.desc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={brightnessPct}
              className="omkb-slider"
              aria-label={tt('brightness.title')}
              onChange={(e) => setBrightness(Number(e.target.value) / 100)}
            />
            <span className="omkb-val">{brightnessPct + '%'}</span>
          </div>
        </div>
        {/* 自动调暗 */}
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('autoDim.title')}</div>
            <div className="omkb-row__desc">{tt('autoDim.desc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <select
              className="omkb-select"
              value={String(autoDim)}
              aria-label={tt('autoDim.title')}
              onChange={(e) => setAutoDim(Number(e.target.value))}
            >
              {AUTO_DIM_OPTIONS.map(([v, key]) => (
                <option value={String(v)} key={String(v)}>{tt(key)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 布局 */}
      <div className="omkb-card">
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('layout.title')}</div>
            <div className="omkb-row__desc">{tt('layout.desc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <button
              type="button"
              className="omkb-ghost"
              onClick={() => setResetOpen(true)}
            >
              {tt('layout.reset')}
            </button>
          </div>
        </div>
        {/* 说明：这一页打开期间设备只做演示（见本组件顶部的 enterSim 与 hid-bridge 的闸门）。
            为什么必须写在界面上：用户在设置页里按设备、转旋钮、推摇杆，看到布局有反应却
            「什么都没发生」，第一反应是键盘坏了 —— 这行字是唯一的解释。
            data-omkb-simhint 是给探针/自检定位用的锚点（不靠文案）。 */}
        <div className="omkb-hint omkb-sim-hint" data-omkb-simhint="1">{tt('layout.simHint')}</div>
        <OmkbLayout prefs={prefs} update={update} clearField={clearField} />
      </div>

      {resetOpen ? (
        <OmkbResetModal
          onCancel={() => setResetOpen(false)}
          onConfirm={() => { setResetOpen(false); resetLayout() }}
        />
      ) : null}

      {/* 选项 */}
      <div className="omkb-card">
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('opts.agentKey')}</div>
            <div className="omkb-row__desc">{tt('opts.agentKeyDesc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <select
              className="omkb-select"
              value={agentKey}
              aria-label={tt('opts.agentKey')}
              onChange={(e) => update('agentKey', e.target.value)}
            >
              <option value="pinned">{tt('opts.agentKey.pinned')}</option>
              <option value="recent">{tt('opts.agentKey.recent')}</option>
              <option value="priority">{tt('opts.agentKey.priority')}</option>
              <option value="custom">{tt('opts.agentKey.custom')}</option>
            </select>
          </div>
        </div>
        {agentKey === 'custom' ? [0, 1, 2, 3, 4, 5].map((n) => (
          <div className="omkb-row" key={'agent-slot-' + n}>
            <div className="omkb-row__label">
              <div className="omkb-row__title">{tt('opts.agentAssign.slot') + ' ' + (n + 1)}</div>
            </div>
            <div className="omkb-row__ctrl">
              <select
                className="omkb-select"
                value={String(((prefs.agentAssign || {})[n]) || '')}
                aria-label={tt('opts.agentAssign.slot') + ' ' + (n + 1)}
                onChange={(e) => {
                  const assign = { ...(prefs.agentAssign || {}) }
                  if (e.target.value) assign[n] = e.target.value
                  else delete assign[n]
                  update('agentAssign', assign)
                }}
              >
                <option value="">{tt('opts.agentAssign.none')}</option>
                {sessionsList.map((s) => (
                  <option value={s.id} key={s.id}>{s.displayTitle || s.id}</option>
                ))}
              </select>
            </div>
          </div>
        )) : null}
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('opts.knob')}</div>
            <div className="omkb-row__desc">{tt('opts.knob.' + knob + '.desc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <select
              className="omkb-select"
              value={knob}
              aria-label={tt('opts.knob')}
              onChange={(e) => update('knob', e.target.value)}
            >
              <option value="navigate">{tt('opts.knob.navigate')}</option>
              <option value="reasoning">{tt('opts.knob.reasoning')}</option>
              <option value="scroll">{tt('opts.knob.scroll')}</option>
              <option value="custom">{tt('opts.knob.custom')}</option>
            </select>
          </div>
        </div>
        {knob === 'custom' ? (
          <div className="omkb-row">
            <div className="omkb-row__label">
              <div className="omkb-row__title">{tt('opts.knobCustom')}</div>
              <div className="omkb-row__desc">{tt('opts.knobCustomDesc')}</div>
            </div>
          </div>
        ) : null}
        {knob === 'custom' ? GESTURES.map(([g, labelKey]) => (
          <div className="omkb-row" key={'knob-gesture-' + g}>
            <div className="omkb-row__label">
              <div className="omkb-row__title">{tt(labelKey)}</div>
            </div>
            <div className="omkb-row__ctrl">
              <select
                className="omkb-select"
                value={String(knobCustom[g] || 'none')}
                aria-label={tt(labelKey)}
                onChange={(e) => update('knobCustom', { ...knobCustom, [g]: e.target.value })}
              >
                {KNOB_ACTION_OPTIONS.map(([v, key]) => (
                  <option value={v} key={v}>{tt(key)}</option>
                ))}
              </select>
            </div>
          </div>
        )) : null}
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('opts.micKey')}</div>
            <div className="omkb-row__desc">{tt('opts.micKeyDesc')}</div>
          </div>
          <div className="omkb-row__ctrl">
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs.micKey}
              aria-label={tt('opts.micKey')}
              className="omkb-switch"
              data-on={prefs.micKey || undefined}
              onClick={() => update('micKey', !prefs.micKey)}
            />
          </div>
        </div>
        {/* 首次连接引导：这里原本有一行「重新播放」（2026-09-24 按用户要求去掉）。
            引导本身照旧 —— 设备第一次连上时自动弹一次，判据在 utils/guide.js 的
            shouldShowGuide（`open && !seen`），弹过就写 guideSeen。要手验三屏就调
            `__dshOmkb.services.guide.replay()`（不写 guideSeen、不看设备在不在）。 */}
      </div>

      {/* 第三方插件依赖：**常驻卡片**（以前是「没有功能声明 requires 就整卡隐藏」，2026-09-26
          按用户要求改成常驻 —— 清单为空时给一行占位，模块始终看得见）。
          数据源 = config/default.js 的 PLUGIN_DEPS（静态配置，**不检测系统**）。
          每一行：左边插件名 + 说明（可选再带上「用于：」哪些按键功能），右边安装状态徽标
          （照配置里手写的 installed 字段渲染，见本组件顶部 plugins 的计算）。 */}
      <div className="omkb-card" data-omkb-plugins="1">
        <div className="omkb-row">
          <div className="omkb-row__label">
            <div className="omkb-row__title">{tt('plugins.title')}</div>
            <div className="omkb-row__desc">{tt('plugins.desc')}</div>
          </div>
        </div>
        {plugins.length ? plugins.map((p) => (
          <div className="omkb-row" key={p.plugin} data-omkb-plugin={p.plugin}>
            <div className="omkb-row__label">
              <div className="omkb-row__title">{p.name}</div>
              <div className="omkb-row__desc">
                {p.desc || null}
                {p.desc && p.usedBy.length ? ' · ' : null}
                {p.usedBy.length ? tt('plugins.usedBy') + p.usedBy.map((id) => pluginKeyLabel(id, tt)).join('、') : null}
              </div>
            </div>
            <div className="omkb-row__ctrl">
              <span className={'omkb-plugin-badge' + (p.installed ? ' omkb-plugin-badge--on' : ' omkb-plugin-badge--off')}>
                {p.installed ? tt('plugins.installed') : tt('plugins.missing')}
              </span>
            </div>
          </div>
        )) : (
          <div className="omkb-row" data-omkb-plugins-empty="1">
            <div className="omkb-row__label">
              <div className="omkb-row__desc">{tt('plugins.empty')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
