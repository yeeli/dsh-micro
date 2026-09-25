// dsh-omkb · 宿主侧（Host）入口
// 职责：
//   1. 加载 BLE/HID 读取器（src/host/core/ble.js）：用 node-hid 读 omkb 小键盘，
//      按 name='omkb' & manufacturer='OM' 匹配设备，解析按键（AG00..AG05 智能键、
//      ACT06..ACT12 动作键），并把触发计数器/按键码暴露到 GET /omkb/state。
//   2. 注册 /omkb/archive：归档当前会话（宿主 workspaceRegistry.archiveSession）。
//   3. 注册 `dsh-omkb` 设置命名空间（见 ./settings.js）：设置页的每一行都写在这里，
//      落盘到 $DSH_HOME/settings.yaml；影响硬件的字段（亮度/自动调暗）回灌到 BLE。
//   4. 浏览器客户端轮询 /omkb/state，按键变化即切换会话/语音/发送等。
//   5. 订阅宿主总线的 agent/error（运行失败 → 红灯 + 状态码 3）、agent/turn-stopping（跑完一轮
//      → 状态码 2）与 agent/status（该会话重新开跑 → 收掉上面那个结果态）。前两者是**结果态、
//      不会自己变回去**（用户 2026-09-25 要求「错误后不变白」），只有第三个会解除它。
//   6. 退出安全网（见 ./exit-guard.js）：设备句柄会持有事件循环，握上它之后要保证
//      Ctrl+C 依然能把进程带走 —— 宿主启动失败时也一样。**清理通道先于 open() 就位**。

import { createBleReader } from './ble.js'
import { createSettingsBridge, readHardwarePrefs, OMKB_NAMESPACE } from './settings.js'
import { createMonitorProbe, openPrivacyPane } from './monitor.js'

const ARCHIVE_PATH = '/omkb/archive'
/** 输入监控授权检测（仅 macOS；见 ./monitor.js 顶部注释里「为什么这么做」）。 */
const MONITOR_PATH = '/omkb/monitor'
/** 打开系统设置的隐私面板（浏览器不能 spawn，只能由宿主代劳）。 */
const PRIVACY_PATH = '/omkb/open-privacy'
const JSON_HEAD = { 'content-type': 'application/json; charset=utf-8' }

/** 兜底重扫间隔：覆盖「设置提交早于路由就绪」的启动竞态。 */
const PREFS_RESCAN_MS = 10000

export const name = 'dsh-omkb'

// 设置命名空间接线。
//
// 为什么必须在宿主侧注册：浏览器端 ctx.settingsScope.bind({ namespace }) 只是从
// settings.describe 的镜像里「派生」一个视图；命名空间没在宿主注册时镜像里就没有
// 这一段，scope 恒为 unavailable / writable:false，scope.set() 的写入被静默丢弃
// ——这正是「设置页改了不生效、重启即丢」的根因。
// 注册动作在 apply() 内调用（installSettingsSection 是静态 import 语义）。
const settingsBridge = createSettingsBridge()

export function apply(ctx) {
  const logger = ctx.logger('omkb')
  logger.info('[omkb] 蓝牙 HID 小键盘插件已加载（name=omkb, manufacturer=OM）')

  // 宿主把这份诊断挂到 GET /omkb/state 上：settings.registered === true 才代表
  // 设置页的写入真的能落盘（终端日志不一定会转发到 stdout，这里由 HTTP 说话）。
  const ble = createBleReader({ logger, diagnostics: () => settingsBridge.diagnose() })

  // ---- 清理通道：**必须先于 ble.open() 就位** ----
  // 打开着的 HID 设备会持有事件循环引用（见 ./exit-guard.js）。宿主启动失败时往往还没
  // 走到「清理插件」这一步就停了，如果这份 dispose 是 open() 之后才挂上的，设备句柄就
  // 没人关 → 事件循环永远排不空 → 进程挂着不动、Ctrl+C 也没反应（用户看到的就是
  // 「整个 dsh 卡死杀不掉」）。所以顺序必须是：先挂清理，再握资源。
  // 连带地，这些 dispose* 变量都得先声明 —— 否则 dispose 提前触发会在闭包里踩 TDZ。
  let disposeSettings = null
  let disposeRoute = null
  let disposeArchive = null
  let disposeMonitor = null
  let disposePrivacy = null
  ctx.on('dispose', () => {
    console.log('dispose')
    if (disposeSettings) { try { disposeSettings() } catch (e) {} }
    // ble.dispose() 不只是关句柄：它会**先关灯、再关句柄**（把键盘 LED 全熄，见 ble.js 的
    // blackout/#lightsOff）—— 设备不会因为 BLE 断开自己熄灭，不关的话就是
    // 「app 都关了、键盘还亮着」。这条只在应用关闭时发生，断开连接（掉线/重连）不关灯。
    // ⚠ 这只是灭灯的**两个落点之一**：Ctrl+C / SIGTERM 这类进程级退出走的是 exit-guard
    // （宿主可能来不及走到这里），见 ./exit-guard.js 顶部「退出前必须灭灯」。
    ble.dispose()
    if (disposeRoute) { try { disposeRoute() } catch (e) {} }
    if (disposeArchive) { try { disposeArchive() } catch (e) {} }
    if (disposeMonitor) { try { disposeMonitor() } catch (e) {} }
    if (disposePrivacy) { try { disposePrivacy() } catch (e) {} }
  })

  ble.open()

  // ---- 运行失败 → 对应键转红灯（结果态，一直亮着）----
  // 为什么订阅在这个事件上：宿主总线的 agent/error 是「真正的失败」的唯一出口。
  // dsh-agent-loop 的 turn() catch 里分了两条路——用户主动中断走 signal.aborted
  // 分支（只记 turn/end reason=aborted 后直接 throw），**不**发 agent/error；
  // 只有真失败才 throwError() → emit('agent/error')。所以按停止键不会转红。
  // 事件里的 agent.id 就是会话 id（DSH 里 agent 身份与会话 id 是同一根轴，
  // 宿主 apiproxy 也是拿 agent.id 当 sessionId 转发给浏览器的）。
  // 亮哪颗键由宿主自己定位：浏览器下发灯态时带了每槽的会话 id（见 ble.js #slotSessions）。
  ctx.effect(() => ctx.on('agent/error', ({ agent, error }) => {
    try {
      const id = agent && agent.id
      if (!ble.reportError(id)) {
        logger.info(`[omkb] 会话 ${id} 运行失败，但它当前没有占键（不在侧边栏），不亮灯`)
      }
    } catch (e) {
      logger.warn('[omkb] 失败红灯下发异常:', e && e.message ? e.message : e)
    }
  }), 'omkb: agent error → LED')

  // ---- 跑完一轮 → 对应键报「成功」状态（同样是结果态）----
  // agent/turn-stopping 是「这一轮要收尾了」的钩子：dsh-agent-loop 在 turn 正常结束时
  // 用 `dispatch.serial` 发它。它天然就是「成功」的信号，**不需要再去比对 reason** ——
  // 用户主动中断（signal.aborted）与真正的失败（上面那条 agent/error）都在它**之前**就
  // throw 掉了，根本走不到这一步。所以拿它当「成功」是准的，不会把中断说成完成。
  //
  // 与失败一样，只报状态不改行为的边界都在宿主侧：浏览器只管「谁占哪颗键、平时什么状态」。
  // 返回 false（该会话没占键，比如后台跑的）是常事，不告警、也不刷日志。
  ctx.effect(() => ctx.on('agent/turn-stopping', ({ agent }) => {
    try {
      ble.reportSuccess(agent && agent.id)
    } catch (e) {
      logger.warn('[omkb] 成功状态下发异常:', e && e.message ? e.message : e)
    }
  }), 'omkb: agent turn done → LED status')

  // ---- 该会话重新开跑 → 收掉上面那个结果态 ----
  // 为什么订阅 agent/status 而不是等浏览器下发的 st=1：那是 agent loop 的**相位变化**
  // （setPhase → status 从 idle 变 running 才发，ds-agent-loop 里有「同值不许重发」的不变量），
  // 语义就是「这个会话又干活了」。而浏览器那份快照带 350ms 防抖，失败那一刻它手里往往还写着
  // 「这个会话在跑」——把它当判据会让红灯刚亮就被抹掉，正是这次要修的病。
  // 用户中断不会重新触发 running（相位已经回到 idle），所以中断过的会话结果态照旧保留。
  // 只在真收掉了东西时打日志：多数 agent/status 与灯无关，不该刷屏。
  ctx.effect(() => ctx.on('agent/status', ({ agent, status }) => {
    try {
      if (status !== 'running') return
      const id = agent && agent.id
      if (ble.clearOutcome(id)) logger.info(`[omkb] 会话 ${id} 重新开始运行 → 收掉结果灯（红/成功）`)
    } catch (e) {
      logger.warn('[omkb] 结果灯收尾异常:', e && e.message ? e.message : e)
    }
  }), 'omkb: agent running → clear outcome LED')

  // ---- 设置持久化 ----
  // 注册命名空间 + 把持久化的硬件偏好应用到 BLE。读取值在宿主侧做变更检测
  // （只有亮度/自动调暗真的变了才写 HID），因此可以安全地反复调用。
  //
  // install() 是异步接线的：它要先动态 import 运行时依赖（宿主可能正在并发加载
  // dsh-settings，同步 require 会撞 ERR_REQUIRE_ESM_RACE_CONDITION），再通过
  // ctx.inject(['settings']) 注册命名空间。返回值只表示「已发起」。
  // 是否真的注册上了，看 GET /omkb/state 的 settings 诊断字段（phase === 'ready'
  // 且 registered === true）；终端里的 logger 不一定会转发到 stdout。
  if (settingsBridge.install(ctx)) {
    let lastApplied = null
    const applyPrefs = () => {
      try {
        const prefs = readHardwarePrefs(settingsBridge.read())
        if (lastApplied && lastApplied.brightness === prefs.brightness && lastApplied.autoDim === prefs.autoDim) return
        lastApplied = prefs
        ble.setPrefs(prefs)
      } catch (e) {
        logger.warn('[omkb] 应用持久化偏好失败:', e && e.message ? e.message : e)
      }
    }
    // attach 会立刻补发一次当前值；settings 服务未挂载时 source 为 null，
    // 此时 applyPrefs 退化为 schema 默认值，仍是安全且幂等的。命名空间接好之后
    // hooks.onChange 会再触发一次，把真实偏好补上。
    settingsBridge.attach(applyPrefs)
    // 路由注册晚于设置到达时，早期提交会错过监听；按固定间隔重扫兜底。
    const rescan = setInterval(() => { if (settingsBridge.consume()) applyPrefs() }, PREFS_RESCAN_MS)
    rescan.unref?.()
    disposeSettings = () => clearInterval(rescan)
  } else {
    // 发起接线这一步就失败了（宿主上下文不支持 ctx.inject）= 设置页的写入无处落盘，
    // 必须显式告警而不是静默失败。依赖解析/服务缺失这类失败由 diagnose() 承载。
    const why = settingsBridge.diagnose().error || '未知原因'
    logger.warn(`[omkb] 设置命名空间 ${OMKB_NAMESPACE} 未接线：${why}；设置页的改动将无法落盘`)
  }

  // webServer 是依赖注入服务，必须通过 ctx.inject 声明后才能访问。
  ctx.inject(['webServer'], (wctx) => {
    disposeRoute = ble.registerRoute(wctx.webServer)

    // ---- 输入监控授权状态（仅 macOS）----
    // 浏览器侧读不到系统权限，必须由宿主去问系统；检测方式与三态语义见 ./monitor.js。
    // 走独立路由而不是塞进 /omkb/state：检测要 spawn 一个 osascript，而 state 是每秒被
    // 轮询的同步快照（塞进去会把每次轮询都变成一次进程启动）。
    const monitor = createMonitorProbe()
    try {
      disposeMonitor = wctx.webServer.register({
        kind: 'exact',
        path: MONITOR_PATH,
        handler: (req, res) => {
          if (req.method !== 'GET' && req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD)
            res.end(JSON.stringify({ error: 'method not allowed' }))
            return
          }
          const force = /[?&]force=1/.test(String(req.url || ''))
          monitor.read(force).then(
            (r) => { res.writeHead(200, JSON_HEAD); res.end(JSON.stringify(r)) },
            (e) => { res.writeHead(500, JSON_HEAD); res.end(JSON.stringify({ supported: false, granted: null, detail: (e && e.message) || String(e) })) }
          )
        }
      })
    } catch (e) {
      logger.warn('[omkb] 输入监控路由注册失败:', e && e.message ? e.message : e)
    }

    // 「打开系统设置」按钮：浏览器不能启动进程，由宿主执行 open。
    try {
      disposePrivacy = wctx.webServer.register({
        kind: 'exact',
        path: PRIVACY_PATH,
        handler: (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD)
            res.end(JSON.stringify({ error: 'method not allowed' }))
            return
          }
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            let pane = 'listen'
            try { pane = (JSON.parse(body || '{}').pane) || 'listen' } catch (e) {}
            openPrivacyPane(pane).then((ok) => {
              res.writeHead(ok ? 200 : 500, JSON_HEAD)
              res.end(JSON.stringify({ ok }))
            })
          })
        }
      })
    } catch (e) {
      logger.warn('[omkb] 系统设置跳转路由注册失败:', e && e.message ? e.message : e)
    }

    // 归档：走宿主的 workspaceRegistry（官方「已归档聊天」机制，见 dsh-tauri-session）。
    // 服务可能因宿主版本缺失，这里不强依赖——可用才注册路由。
    let ws = null
    try {
      ws = (typeof wctx.get === 'function' && wctx.get('workspaceRegistry')) || wctx.workspaceRegistry || null
    } catch (e) {
      ws = null
    }
    if (ws && typeof ws.archiveSession === 'function') {
      disposeArchive = wctx.webServer.register({
        kind: 'exact',
        path: ARCHIVE_PATH,
        handler(req, res) {
          if (req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD)
            res.end(JSON.stringify({ error: 'method not allowed' }))
            return
          }
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            try {
              const { sessionId } = JSON.parse(body || '{}')
              if (!sessionId) {
                res.writeHead(400, JSON_HEAD)
                res.end(JSON.stringify({ error: 'missing sessionId' }))
                return
              }
              Promise.resolve(ws.archiveSession(sessionId)).then(
                () => { res.writeHead(200, JSON_HEAD); res.end(JSON.stringify({ ok: true })) },
                (e) => { res.writeHead(500, JSON_HEAD); res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) })) }
              )
            } catch (e) {
              res.writeHead(400, JSON_HEAD)
              res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }))
            }
          })
        }
      })
    } else {
      logger.warn('[omkb] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用')
    }
  })
}
