// dsh-micro · 宿主侧「输入监控」授权检测（仅 macOS）
//
// 目标：如实回答「DeepSeek Harness 这条进程链有没有拿到系统授权」，而不是在界面上写死
// 一句「请在系统设置授权」。
//
// ── 为什么是这么实现的（踩过的路，别再走回去）────────────────────────────────
// 1. **读 TCC 数据库**（`~/Library/Application Support/com.apple.TCC/TCC.db`）最直观，
//    但实测 `sqlite3` 打开它直接 `authorization denied`（要「完全磁盘访问」才行）。
//    宿主的运行环境通常没有，所以这条路不可用。
// 2. **在 Node 里直接调** `CGPreflightListenEventAccess()` 不行：它是 CoreGraphics 的 C
//    函数，没有 native addon 就够不着，`process.dlopen` 也只能加载 N-API addon。
// 3. **实测可行**：macOS 自带 `osascript` 的 JXA（JavaScript for Automation）可以
//    `ObjC.import('CoreGraphics')` + `ObjC.bindFunction(...)` 绑定并调用这个 C 函数：
//        osascript -l JavaScript -e 'ObjC.import("CoreGraphics");
//            ObjC.bindFunction("CGPreflightListenEventAccess",["bool",[]]);
//            $.CGPreflightListenEventAccess()'   →   true / false
//    （注意：直接 `$.CGPreflightListenEventAccess` 是 undefined，**必须**先 bindFunction。）
// 4. TCC 的判据是 **responsible process**：从宿主 spawn 出去的子进程，问的就是宿主这条
//    进程链的授权 —— 正是我们想展示的那个答案。若 DSH 是从终端起的，那条链上的授权者
//    就是终端 / DSH 自己，这也正是它实际受影响的对象。
// 5. 用的是 **preflight**（只查询，绝不触发系统弹窗）；请求授权的 `CGRequestListenEventAccess`
//    我们**不调**，免得插件一加载就弹窗。
// 6. 辅助功能（Accessibility）顺带查一下（`AXIsProcessTrusted`），它和输入监控是两个
//    独立权限，界面上可以分别说明。
//
// 三态：granted=true 已授权 / granted=false 未授权 / granted=null 无法判定（非 mac、
// 没有 osascript、执行超时、输出解析不了）。**不知道就说不确定**，别猜。

import { spawn } from 'node:child_process'

/** 平台判定：只有 macOS 有「输入监控」这个权限概念。 */
export const isSupportedPlatform = (platform = process.platform) => platform === 'darwin'

/** 系统设置里「输入监控」面板的深链（`open` 命令用）。 */
export const PRIVACY_PANE_URLS = {
  listen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

/**
 * JXA 脚本：查询输入监控 + 辅助功能授权。
 * 写成一行直接用 `osascript -e` 传（参数走 argv 数组，不需要 shell 转义）。
 */
export const MONITOR_JXA = [
  "ObjC.import('CoreGraphics')",
  'ObjC.bindFunction("CGPreflightListenEventAccess",["bool",[]])',
  'var r={}',
  'try{r.listen=$.CGPreflightListenEventAccess()}catch(e){r.errListen=String(e)}',
  "try{ObjC.import('ApplicationServices');r.ax=$.AXIsProcessTrusted()}catch(e){r.errAx=String(e)}",
  'JSON.stringify(r)'
].join(';')

/**
 * 解析 osascript 的输出（纯函数，自检直接喂样本）。
 * @param stdout - osascript 的 stdout。
 * @returns {{granted: boolean|null, accessibility: boolean|null, detail: string}}
 */
export const parseMonitorOutput = (stdout) => {
  const text = String(stdout == null ? '' : stdout).trim()
  if (!text) return { granted: null, accessibility: null, detail: '查询没有返回内容' }
  let obj = null
  // osascript 可能把警告也打到 stdout，所以取最后一行花括号内容来解析。
  const line = text.split('\n').map((s) => s.trim()).filter(Boolean).pop() || ''
  try { obj = JSON.parse(line) } catch (e) { return { granted: null, accessibility: null, detail: '无法解析查询结果：' + line.slice(0, 120) } }
  if (!obj || typeof obj !== 'object') return { granted: null, accessibility: null, detail: '查询结果不是对象' }
  const asBool = (v) => (v === true ? true : v === false ? false : (typeof v === 'number' ? v !== 0 : null))
  const granted = asBool(obj.listen)
  const accessibility = asBool(obj.ax)
  const detail = granted === null
    ? ('查询失败：' + (obj.errListen || 'CoreGraphics 未返回结果'))
    : (granted ? '系统已授权输入监控' : '系统未授权输入监控')
  return { granted, accessibility, detail }
}

/**
 * 执行一次授权检测。
 * @param opts.spawnFn - 可注入的 spawn（自检用假进程）。
 * @param opts.timeoutMs - 超时（默认 2500ms：osascript 正常几十毫秒就回来）。
 * @param opts.platform - 可注入平台（自检用）。
 * @returns {Promise<{supported: boolean, granted: boolean|null, accessibility: boolean|null,
 *   method: string, detail: string}>}
 */
export const probeInputMonitor = async (opts = {}) => {
  const platform = opts.platform || process.platform
  const supported = isSupportedPlatform(platform)
  if (!supported) {
    return { supported: false, granted: null, accessibility: null, method: 'unsupported', detail: `当前系统是 ${platform}，只有 macOS 有输入监控权限` }
  }
  const spawnFn = opts.spawnFn || spawn
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 2500
  return new Promise((resolve) => {
    let child = null
    let settled = false
    const done = (result) => { if (!settled) { settled = true; resolve(result) } }
    const timer = setTimeout(() => {
      try { if (child) child.kill() } catch (e) {}
      done({ supported: true, granted: null, accessibility: null, method: 'timeout', detail: `查询超时（${timeoutMs}ms）` })
    }, timeoutMs)
    timer.unref?.()

    try {
      child = spawnFn('/usr/bin/osascript', ['-l', 'JavaScript', '-e', MONITOR_JXA], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      clearTimeout(timer)
      done({ supported: true, granted: null, accessibility: null, method: 'unavailable', detail: '无法执行 osascript：' + ((e && e.message) || e) })
      return
    }

    let out = ''
    let err = ''
    if (child.stdout && child.stdout.on) child.stdout.on('data', (c) => { out += c })
    if (child.stderr && child.stderr.on) child.stderr.on('data', (c) => { err += c })
    child.on('error', (e) => {
      clearTimeout(timer)
      done({ supported: true, granted: null, accessibility: null, method: 'unavailable', detail: 'osascript 启动失败：' + ((e && e.message) || e) })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out.trim()) {
        done({ supported: true, granted: null, accessibility: null, method: 'failed', detail: `osascript 退出码 ${code}` + (err.trim() ? '：' + err.trim().slice(0, 160) : '') })
        return
      }
      const parsed = parseMonitorOutput(out)
      done({ supported: true, ...parsed, method: 'jxa' })
    })
  })
}

/** 打开系统设置的隐私面板（`open` 命令，argv 数组传参，无 shell 转义问题）。 */
export const openPrivacyPane = (pane = 'listen', spawnFn = spawn) => {
  const url = PRIVACY_PANE_URLS[pane] || PRIVACY_PANE_URLS.listen
  return new Promise((resolve) => {
    try {
      const child = spawnFn('open', [url], { stdio: 'ignore' })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    } catch (e) { resolve(false) }
  })
}

/**
 * 带缓存的检测器：设置页会按几秒的间隔轮询，没必要每次都 spawn 一个 osascript。
 * @param opts.ttlMs - 缓存有效期（默认 4000ms）。
 */
export const createMonitorProbe = (opts = {}) => {
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 4000
  let cached = null
  let at = 0
  let inflight = null
  return {
    /** 读一次（命缓存直接返回）。@param force - 忽略缓存强制重测。 */
    read: (force = false) => {
      const now = Date.now()
      if (!force && cached && now - at < ttl) return Promise.resolve(cached)
      if (inflight) return inflight
      inflight = probeInputMonitor(opts).then((r) => {
        cached = r
        at = Date.now()
        inflight = null
        return r
      }, (e) => {
        inflight = null
        const r = { supported: isSupportedPlatform(opts.platform || process.platform), granted: null, accessibility: null, method: 'error', detail: (e && e.message) || String(e) }
        cached = r
        at = Date.now()
        return r
      })
      return inflight
    }
  }
}
