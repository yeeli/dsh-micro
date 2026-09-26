// dsh-omkb · 宿主侧日志的去向（2026-09-26）
//
// 开发版（`npm run build`）与正式版（`npm run build:core:prod` / `npm run build:prod`）
// 的产物**只差一个构建常量** —— `__OMKB_RELEASE__`（见 vite.core.config.js 的 define）：
//
//   · 开发版（false）→ `[omkb]` 日志照旧打终端，**行为与改动前一字不差**
//     （既有自检里有靠捕获 `console.error` 判行为的用例，这个分支不许动）；
//   · 正式版（true） → 只写 `$DSH_HOME/logs/dsh-omkb.log`，终端**一行都不打**。
//
// 为什么做成**构建期**常量、而不是运行期环境变量：宿主（`dsh web`）是别人启动的，
// 它的环境我们管不着；把开关烘进产物才能保证「正式版就是安静的」。
// 想临时要终端日志 → 用开发版产物（不要临时改环境变量，那不在契约里）。
//
// 顺带说明**没做**的事：Cordis 的 `ctx.logger('omkb')` 照旧调用（见 ble.js 的 #log）。
// 那是宿主的日志通道，去向由宿主决定；我们只负责把自己往 stdout/stderr 的那份改道。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * 构建期注入的正式版标记。源码被**直接**跑（自检、`node -e`、产物还没 build）时这个标识
 * 不存在 —— `typeof` 守卫让它安全地落到 false（开发版），不会 ReferenceError。
 */
export const RELEASE = typeof __OMKB_RELEASE__ !== 'undefined' ? !!__OMKB_RELEASE__ : false

/** 单个日志文件的软上限；超过就在**每个进程第一次写之前**把它挪到 `.1`，重新开一个。 */
export const MAX_LOG_BYTES = 5 * 1024 * 1024

/**
 * 正式版日志落在哪 —— 纯函数，自检直接断它（不碰真实文件系统）。
 * `$DSH_HOME/logs/dsh-omkb.log`，`DSH_HOME` 缺省 `~/.dsh`（与 settings.js 的取法一致）。
 * @param {Record<string, string|undefined>} [env]
 * @param {string} [home]
 */
export const resolveLogPath = (env = process.env, home = os.homedir()) =>
  path.join(env && env.DSH_HOME ? env.DSH_HOME : path.join(home, '.dsh'), 'logs', 'dsh-omkb.log')

/** 一条日志里的单个参数怎么落成文本（对象给 JSON、Error 给 message；别落在 `[object Object]` 上）。 */
const render = (a) => {
  if (typeof a === 'string') return a
  // ⚠ 用 message 而**不是** stack：栈里带换行，会把「一条日志一行」这个结构打乱
  //   （文件里一半的行没有时间戳前缀，grep 起来全是噪声）。要看栈就让它自己进 console。
  if (a instanceof Error) return a.message || String(a)
  try { return JSON.stringify(a) } catch (e) { return String(a) }
}

/**
 * 造一个日志出口。
 *
 * **开发版分支必须与改动前逐字节一致**（`console.log('[omkb]', ...)` / `console.error('[omkb]', ...)`），
 * 否则既有自检里那几个「靠捕获 console 判行为」的用例会一起变红 —— 那是假的回归。
 *
 * `fs` / `now` 可注入：自检拿假 fs 断「写什么、写到哪、什么时候轮转」，不碰真实目录。
 *
 * @param {{ release?: boolean, file?: string, fs?: any, now?: () => Date }} [o]
 * @returns {{ info: Function, warn: Function, raw: Function }}
 */
export const createLogSink = ({ release = RELEASE, file, fs: io = fs, now = () => new Date() } = {}) => {
  let opened = false   // 目录/轮转只做一次
  let broken = false   // 落盘失败只报一次，之后闭嘴（否则每条日志都炸一遍）
  const target = () => file || resolveLogPath()

  const open = () => {
    opened = true
    const p = target()
    try {
      io.mkdirSync(path.dirname(p), { recursive: true })
    } catch (e) { /* 建不出来就让下面 append 去失败，那里有统一的兜底 */ }
    // 轮转只在**进程第一次写**的时候看一眼：够用，又不必给每条日志加一次 stat。
    try {
      if (io.statSync(p).size > MAX_LOG_BYTES) io.renameSync(p, p + '.1')
    } catch (e) { /* 文件还不存在（首跑）—— 正常路径，不是错误 */ }
  }

  /**
   * @param {string} level - 落进文件的级别标签（info / warn / rx）。
   * @param {any[]} args
   * @param {Function} dev - 开发版怎么打（把这个决定权交给调用方，好让 dev 行为一字不差）。
   */
  const emit = (level, args, dev) => {
    if (!release) { try { dev() } catch (e) {} ; return }
    if (broken) return
    if (!opened) open()
    try {
      io.appendFileSync(target(), `${now().toISOString()} [${level}] ${args.map(render).join(' ')}\n`, 'utf8')
    } catch (e) {
      broken = true
      // 不能变成「静默丢日志」：说一次，然后闭嘴。
      try { console.error('[omkb] 日志文件写入失败，后续日志将丢弃:', e && e.message ? e.message : e) } catch (e2) {}
    }
  }

  return {
    info: (...a) => emit('info', a, () => console.log('[omkb]', ...a)),
    warn: (...a) => emit('warn', a, () => console.error('[omkb]', ...a)),
    // 入站帧的**原样**回显：改动前就是 `console.log(line)`（**不带**前缀），这一条也得保持原样。
    raw: (line) => emit('rx', [line], () => console.log(line)),
  }
}

/** 进程内共享的一个出口（ble.js 与 index.js 都往这里写，保证同一个文件、同一份轮转状态）。 */
export const logSink = createLogSink()
