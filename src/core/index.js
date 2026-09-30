// dsh-micro · 宿主侧（Host）入口
// 职责：
//   1. 加载 BLE/HID 读取器（src/host/core/ble.js）：用 node-hid 读 micro 小键盘，
//      按 name='micro' & manufacturer='OM' 匹配设备，解析按键（AG00..AG05 智能键、
//      ACT06..ACT12 动作键），并把触发计数器/按键码暴露到 GET /micro/state。
//   2. 注册 /micro/archive：归档当前会话（宿主 workspaceRegistry.archiveSession）。
//   3. 声明 `dsh-micro` 设置命名空间：由本模块导出的 Config 承载（见 ./settings.js），
//      落盘在 profile 的 patch 文件里；影响硬件的字段（亮度/自动调暗）回灌到 BLE。
//   4. 浏览器客户端订阅 /micro/state 的状态推送（ws，与 GET 同路径；宿主没带 ws 时
//      客户端自动退回 120ms HTTP 轮询），按键变化即切换会话/语音/发送等。
//   5. 订阅宿主总线的 agent/error（运行失败 → 红灯 + 状态码 3）、agent/turn-stopping（跑完一轮
//      → 状态码 2）与 agent/status（该会话重新开跑 → 收掉上面那个结果态）。前两者是**结果态、
//      不会自己变回去**（用户 2026-09-25 要求「错误后不变白」），只有第三个会解除它。
//   6. 退出安全网（见 ./guard.js）：设备句柄会持有事件循环，握上它之后要保证
//      Ctrl+C 依然能把进程带走 —— 宿主启动失败时也一样。**清理通道先于 open() 就位**。

import { createBleReader } from './ble.js'
import { Config, createSettingsProbe, readConfig, readHardwarePrefs } from './settings.js'
import { createMonitorProbe, openPrivacyPane } from './monitor.js'
import { registerServerRoutes } from './server/index.js'
import { logSink } from './log.js'

// 设置命名空间 = 插件在 profile 里那条 loader 条目的 Config（见 ./settings.js 顶部）。
// 导出即注册：loader 读 `entry.fiber.runtime.Config`，客户端用
// `ctx.configForms.get('dsh-micro')` 读写同一个命名空间。
export { Config }

export const name = 'dsh-micro'

// 设置诊断探针（只读，不改行为）：把「schema 建起来没有 / 字段都标 volatile 没有 /
// 宿主 describe() 里有没有我们这条命名空间」报给 /micro/state。
// 命名空间本身由上面导出的 Config 承载，这里没有注册动作可做。
const settingsProbe = createSettingsProbe()

/**
 * 插件主体。
 * @param ctx - 宿主插件上下文。
 * @param config - loader 按我们导出的 Config 解析好的插件配置。volatile 字段在这里是
 *   引用对象（`.get()` 取值），一律经 settings.js 的 readConfig 摊平后再用。
 */
export function apply(ctx, config) {
  const logger = ctx.logger('micro')
  logger.info('[micro] 蓝牙 HID 小键盘插件已加载（name=micro, manufacturer=OM）')
  // 同一件事也写进**我们自己的**出口（见 ./log.js）：正式版终端是安静的，日志文件里
  // 必须留下「这一轮是什么时候起的、跑的是哪个版本」，否则那份文件只剩中间过程。
  logSink.info('蓝牙 HID 小键盘插件已加载（name=micro, manufacturer=OM）')

  // 宿主把这份诊断挂到 GET /micro/state 上：settings.served === true 才代表宿主真的
  // 在服务我们这条命名空间（终端日志不一定会转发到 stdout，这里由 HTTP 说话）。
  const ble = createBleReader({ logger, diagnostics: () => settingsProbe.diagnose() })

  // ---- 清理通道：**必须先于 ble.open() 就位** ----
  // 打开着的 HID 设备会持有事件循环引用（见 ./guard.js）。宿主启动失败时往往还没
  // 走到「清理插件」这一步就停了，如果这份 dispose 是 open() 之后才挂上的，设备句柄就
  // 没人关 → 事件循环永远排不空 → 进程挂着不动、Ctrl+C 也没反应（用户看到的就是
  // 「整个 dsh 卡死杀不掉」）。所以顺序必须是：先挂清理，再握资源。
  // 连带地，这些 dispose* 变量都得先声明 —— 否则 dispose 提前触发会在闭包里踩 TDZ。
  let disposeRoute = null
  ctx.on('dispose', () => {
    // 原来是一句裸的 `console.log('dispose')`（连 [micro] 前缀都没有）：走日志出口，
    // 正式版才不至于在插件卸载时往终端漏一行。
    logSink.info('dispose')
    // ble.dispose() 不只是关句柄：它会**先关灯、再关句柄**（把键盘 LED 全熄，见 ble.js 的
    // blackout/#lightsOff）—— 设备不会因为 BLE 断开自己熄灭，不关的话就是
    // 「app 都关了、键盘还亮着」。这条只在应用关闭时发生，断开连接（掉线/重连）不关灯。
    // ⚠ 这只是灭灯的**两个落点之一**：Ctrl+C / SIGTERM 这类进程级退出走的是 exit-guard
    // （宿主可能来不及走到这里），见 ./guard.js 顶部「退出前必须灭灯」。
    ble.dispose()
    if (disposeRoute) { try { disposeRoute() } catch (e) {} }
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
        logger.info(`[micro] 会话 ${id} 运行失败，但它当前没有占键（不在侧边栏），不亮灯`)
      }
    } catch (e) {
      logger.warn('[micro] 失败红灯下发异常:', e && e.message ? e.message : e)
    }
  }), 'micro: agent error → LED')

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
      logger.warn('[micro] 成功状态下发异常:', e && e.message ? e.message : e)
    }
  }), 'micro: agent turn done → LED status')

  // ---- 该会话重新开跑 → 只收掉上面那个结果态，**不额外发报文** ----
  // 为什么订阅 agent/status 而不是等浏览器下发的 st=1：那是 agent loop 的**相位变化**
  // （setPhase → status 从 idle 变 running 才发，ds-agent-loop 里有「同值不许重发」的不变量），
  // 语义就是「这个会话又干活了」。而浏览器那份快照带 350ms 防抖，失败那一刻它手里往往还写着
  // 「这个会话在跑」——把它当判据会让红灯刚亮就被抹掉，正是这次要修的病。
  // 用户中断不会重新触发 running（相位已经回到 idle），所以中断过的会话结果态照旧保留。
  //
  // ⚠ **规则 2 暂时停用**（2026-09-27 用户要求：「clearOutcome 先不要，这个也会导致发送多条」）。
  //   原本这一跳还会让 `clearOutcome` 发一条「6 槽 st 全空闲」的清除报文，但 `running` 相位在
  //   「发一条消息」时也会来 → 那条清除报文 + 随后的浏览器那份（蓝·st=1）= 一次操作设备收到两条。
  //   现在 `clearOutcome` 只把结论从内部表里撤掉（红灯交由浏览器下一次推送重算时自然消失），
  //   设备画面由**浏览器那条推送**更正 —— 一场重试因此只剩一条。
  //
  // 只认 `running`：**idle 那一跳不发**（用户明确要求）。它是相位回落，紧跟在本轮的
  // turn-stopping/error 之后，刚写过的那份内容已经是最新的；再写一条只会让设备收到重复内容。
  // 只在真收掉了东西时打日志：多数 agent/status 与灯无关，不该刷屏。
  ctx.effect(() => ctx.on('agent/status', ({ agent, status }) => {
    try {
      if (status !== 'running') return
      const id = agent && agent.id
      if (ble.clearOutcome(id)) logger.info(`[micro] 会话 ${id} 重新开始运行 → 收掉结果灯（红/成功，不额外发报文）`)
    } catch (e) {
      logger.warn('[micro] 结果灯收尾异常:', e && e.message ? e.message : e)
    }
  }), 'micro: agent running → clear outcome LED')

  // ---- 设置持久化 ----
  // 命名空间与 schema 由本模块导出的 Config 承载（导出即注册，没有 installSection 可调）。
  // apply 收到的 config 就是宿主解析好的那份；volatile 字段是引用对象，readConfig 摊平。
  //
  // 偏好怎么回到硬件：**由 loader 就地提交**，不走「重新 apply」。
  // 标了 volatile 的字段改动时，loader 调 updateVolatile 写进同一个引用对象，再发
  // `loader/volatile-update`（见 cordis-plugin-loader 的 _commitVolatile）——所以这里只需
  // 订阅那个事件重扫一遍；ble.setPrefs 自己带变更检测，重复调用是安全的。
  // 反过来说：不订阅的话，在设置页拖亮度滑杆**设备不会有任何反应**（配置变了、插件不知道）。
  {
    const applyPrefs = () => {
      try {
        ble.setPrefs(readHardwarePrefs(readConfig(config)))
      } catch (e) {
        logger.warn('[micro] 应用持久化偏好失败:', e && e.message ? e.message : e)
      }
    }
    applyPrefs()
    ctx.effect(() => ctx.on('loader/volatile-update', applyPrefs), 'micro: 设置变更 → BLE')
  }

  // 让 DSH 不要为这条条目**再自动生成**一个设置页：本插件自带界面（settings.section
  // 分区的 'micro'），两份入口只会让人以为「改这份没用」。
  // 用官方写法：configure 的第二个参数是「哪条条目」，默认是调用者自己的 fiber —— 显式传
  // ctx.fiber 以免 ctx 经代理后指向别处；重复配置会抛，所以必须包在 ctx.effect 里（卸载时
  // 自动撤销），并吞掉异常（这只是界面政策，失败不该连累按键）。
  try {
    ctx.inject(['settings'], (child) => {
      try {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
      } catch (e) {
        logger.warn('[micro] 声明「自带设置页」失败（不影响功能，只影响设置里会不会多出一个自动页）:', e && e.message ? e.message : e)
      }
      try { settingsProbe.attach(child) } catch (e) {}
    })
  } catch (e) {
    logger.warn('[micro] 等待 settings 服务失败:', e && e.message ? e.message : e)
  }

  // 延后一次探测：describe() 只收已经 active 的条目，apply 期间自己还没 active。
  // 转成 unref 的定时器，绝不因为这条诊断把进程留住。
  {
    const timer = setTimeout(() => { try { settingsProbe.tick(ctx) } catch (e) {} }, 1500)
    timer.unref?.()
  }

  // ---- 全部 /micro/* 路由（7 条）都交给 server/ 汇总注册 ----
  // server/index.js 是「宿主与 webserver 通信」的唯一入口：它负责在 ctx.inject(['webServer'])
  // 的上下文里把 state/config/reconnect/agents/monitor/open-privacy/archive 七条路由挂上去，
  // **外加** ws `/micro/state` 那条状态推送（与 GET 同路径、占 upgrades 表），
  // 并返回一个统一 disposer。业务体（灯态、归档、权限检测）仍在各自模块里，这里只递材料。
  // 输入监控检测器要在 apply 期间建一次（带缓存），路由与后续调用共用同一个实例。
  const monitor = createMonitorProbe()
  {
    const server = registerServerRoutes(ctx, { ble, monitor, openPrivacy: openPrivacyPane, logger })
    disposeRoute = server.dispose
  }
}
