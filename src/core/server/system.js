// dsh-omkb · server/system.js
//
// 与「系统 / 宿主能力」相关的三条路由（与设备无关，浏览器自己做不到、只能宿主代劳）：
//   GET|POST /omkb/monitor        —— 输入监控授权状态（仅 macOS，读系统权限）。
//   POST      /omkb/open-privacy  —— 打开系统设置的隐私面板（浏览器不能 spawn）。
//   POST      /omkb/archive       —— 归档当前会话（宿主 workspaceRegistry.archiveSession）。
//
// 业务体（probeInputMonitor / openPrivacyPane / workspaceRegistry）都在别处，这里只做 HTTP 壳。
// 三条都「不强依赖」：宿主缺对应能力时静默不注册（archive），注册失败也只告警、不连累按键。

import { PATHS } from './paths.js'
import { JSON_HEAD, json } from './http.js'

/**
 * 注册 monitor / open-privacy / archive 三条路由。
 * @param {object} webServer
 * @param {object} deps
 * @param {{ read: (force: boolean) => Promise<object> }} deps.monitor - 带缓存的检测器。
 * @param {(pane: string) => Promise<boolean>} deps.openPrivacy - 打开隐私面板。
 * @param {{ archiveSession: (id: string) => Promise<unknown> }|null} deps.workspaceRegistry
 *   归档服务；宿主版本缺失时为 null（不注册 archive 路由）。
 * @param {{ warn: (msg: string) => void }} [log]
 * @returns {() => void} disposer（一次注销全部三条）。
 */
export const registerSystemRoutes = (webServer, deps, log = null) => {
  const disposers = []

  // ---- 输入监控授权状态（仅 macOS）----
  // 走独立路由而不是塞进 /omkb/state：检测要 spawn 一个 osascript，而 state 是每秒被
  // 轮询的同步快照（塞进去会把每次轮询都变成一次进程启动）。
  try {
    disposers.push(webServer.register({
      kind: 'exact',
      path: PATHS.monitor,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'POST') {
          json(res, 405, { error: 'method not allowed' })
          return
        }
        const force = /[?&]force=1/.test(String(req.url || ''))
        deps.monitor.read(force).then(
          (r) => json(res, 200, r),
          (e) => json(res, 500, { supported: false, granted: null, detail: (e && e.message) || String(e) })
        )
      }
    }))
  } catch (e) {
    log && log.warn && log.warn(`[omkb] 输入监控路由注册失败: ${e && e.message}`)
  }

  // ---- 打开系统设置的隐私面板 ----
  try {
    disposers.push(webServer.register({
      kind: 'exact',
      path: PATHS.openPrivacy,
      handler: (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'method not allowed' })
          return
        }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          let pane = 'listen'
          try { pane = (JSON.parse(body || '{}').pane) || 'listen' } catch (e) {}
          deps.openPrivacy(pane).then((ok) => {
            res.writeHead(ok ? 200 : 500, JSON_HEAD)
            res.end(JSON.stringify({ ok }))
          })
        })
      }
    }))
  } catch (e) {
    log && log.warn && log.warn(`[omkb] 系统设置跳转路由注册失败: ${e && e.message}`)
  }

  // ---- 归档当前会话 ----
  // 走宿主的 workspaceRegistry（官方「已归档聊天」机制）。服务可能因宿主版本缺失，
  // 这里不强依赖——可用才注册路由。
  const ws = deps.workspaceRegistry
  if (ws && typeof ws.archiveSession === 'function') {
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: PATHS.archive,
        handler(req, res) {
          if (req.method !== 'POST') {
            json(res, 405, { error: 'method not allowed' })
            return
          }
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            try {
              const { sessionId } = JSON.parse(body || '{}')
              if (!sessionId) {
                json(res, 400, { error: 'missing sessionId' })
                return
              }
              Promise.resolve(ws.archiveSession(sessionId)).then(
                () => json(res, 200, { ok: true }),
                (e) => json(res, 500, { error: e && e.message ? e.message : String(e) })
              )
            } catch (e) {
              json(res, 400, { error: e && e.message ? e.message : String(e) })
            }
          })
        }
      }))
    } catch (e) {
      log && log.warn && log.warn(`[omkb] 归档路由注册失败: ${e && e.message}`)
    }
  }

  return () => {
    for (const d of disposers) {
      try { d && d() } catch (e) { log && log.warn && log.warn(`[omkb] 系统路由注销失败: ${e && e.message}`) }
    }
  }
}
