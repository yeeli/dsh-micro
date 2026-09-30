// dsh-micro · smoke_check.js
// **构建后的冒烟自检** —— 把「改完跑不起来」挡在构建这一步（2026-09-27）。
//
// ── 为什么需要它（真实事故）──────────────────────────────────────────────
// 有人在 `#composeAgents` 里把 `mine` 打成了 `mime`。这一行**完全合法**：
//   · `vite build` 成功；
//   · `src/check_code.js` 的语法检查通过（未定义引用不是语法错误）；
//   · 产物照写不误 —— 直到设备触发一次 `reportError`，运行时才抛 ReferenceError。
// 「未定义变量 / 忘了 import / 空指针」这类错误**只有真正跑到那一行才存在**，
// 静态检查（不引 ESLint 的前提下）看不见它。
//
// ── 所以做法是「跑起来」而不是「再查一遍」────────────────────────────────
// 挑几套**覆盖宿主核心链路、本身又够快**的自检，构建后跑一遍：
// 它们会把灯态、灭灯、agents 桥真的走一遍，任何 ReferenceError / TypeError 当场现形。
// 本地合计约 5–8 秒（实测 CPU 每套都在 1s 内），足够便宜到放进每次构建。
//
// ⚠ **它不是全量自检的替代品**：这里只有 5 套（全量 23 套见 `npm run verify`）。
//   冒烟的意义是「拦住明显崩坏」，不是「保证行为全对」—— 后者仍然要跑全量。
//
// 用法：
//   node src/smoke_check.js        跑全部冒烟套件
//   npm run smoke                  同上
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// 选套件的标准：① 覆盖宿主核心链路 ② 单套够快。顺序按「从共性到具体」，
// 前面的挂了后面的通常也会挂，读日志时先看第一条就够。
const SUITES = [
  ['verify_structure.js', '目录结构契约'],
  ['verify_logging.js', '日志去向'],
  ['verify_agents.js', 'agents 桥'],
  ['verify_led_error.js', '灯态 / 结果态'],
  ['verify_blackout.js', '灭灯 / 合并 / 内容去重']
]

const SUITE_TIMEOUT_MS = 120000
// 失败时每套最多回显这么多行 —— 够看清第一处崩溃，又不把终端刷满
const MAX_LINES = 12

/**
 * 「代码跑不起来」的指纹 —— 只有这些才算**严重**。
 *
 * ⚠ 这个分级是本模块的关键判断，别把它抹平成「exit≠0 就是失败」：
 *   · **崩溃**（ReferenceError / TypeError / 模块找不到…）= 代码坏了，构建必须挡住；
 *   · **断言未通过** = 行为与预期不符，可能是真回归，也可能是「断言还没跟上刚改的口径」
 *     （本项目常态：改口径时断言与实现会短暂不同步）。
 *   前者构成构建失败，后者只警告 —— 否则只要有人改了口径，构建就会一直红，
 *   而红的理由与这次改动无关，很快就没人再看它了。
 */
const CRASH_RE = /(ReferenceError|TypeError|SyntaxError|RangeError|EvalError|URIError):|ERR_MODULE_NOT_FOUND|is not a function|Cannot read propert|Cannot set propert|Cannot destructure/

/** 跑一套，返回 { ok, code, lines, crashed, failed }。 */
const runSuite = (file) => new Promise((resolve) => {
  const child = spawn(process.execPath, [path.join('test', file)], { cwd: ROOT })
  const out = []
  const err = []
  const timer = setTimeout(() => child.kill('SIGKILL'), SUITE_TIMEOUT_MS)
  child.stdout.on('data', (b) => out.push(b.toString()))
  child.stderr.on('data', (b) => err.push(b.toString()))
  child.on('close', (code) => {
    clearTimeout(timer)
    const text = out.join('') + err.join('')
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    const crashed = CRASH_RE.test(text)
    // 只回显「能说明问题」的行：异常、断言失败、npm 错误
    const bad = lines.filter((l) => /^✗|✗\s|Error|error:|失败$|存在失败/.test(l))
    // 断言失败的条数（本项目断言失败统一落成 `✗ 断言 — 原因`）
    const failed = lines.filter((l) => /^✗/.test(l)).length
    resolve({
      ok: code === 0,
      code,
      crashed,
      failed,
      lines: bad.length ? bad : lines.slice(-4)
    })
  })
})

/**
 * 跑冒烟自检。
 * @param {{ log?: Function, error?: Function, quiet?: boolean }} opts
 * @returns {Promise<boolean>} 是否有**崩溃**（false = 构建应当中止）
 */
export const runSmoke = async ({ log = console.log, error = console.error, quiet = false } = {}) => {
  const crashes = []
  const asserts = []
  for (const [file, label] of SUITES) {
    const r = await runSuite(file)
    if (r.crashed) crashes.push([file, label, r])
    else if (!r.ok) asserts.push([file, label, r])
  }

  if (crashes.length === 0 && asserts.length === 0) {
    if (!quiet) log(`[micro/smoke] ✓ ${SUITES.length} 套冒烟自检通过（${SUITES.map(([, l]) => l).join(' / ')}）`)
    return true
  }
  if (asserts.length > 0) {
    error(`[micro/smoke] ⚠ ${asserts.length} 套的行为断言未通过（**不阻断构建**，详见 npm run verify）：`)
    for (const [file, label, r] of asserts) {
      error(`  · ${label}（test/${file}，${r.failed} 条 ✗）`)
      for (const line of r.lines.slice(-MAX_LINES)) error(`      ${line}`)
    }
  }
  if (crashes.length > 0) {
    error(`[micro/smoke] ✗ ${crashes.length} 套自检**崩溃**（代码根本跑不起来）：`)
    for (const [file, label, r] of crashes) {
      error(`  · ${label}（test/${file}，exit ${r.code}）`)
      for (const line of r.lines.slice(-MAX_LINES)) error(`      ${line}`)
    }
    error(`  完整输出：node test/${crashes[0][0]}`)
    return false
  }
  return true
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const ok = await runSmoke({})
  if (!ok) process.exitCode = 1
}
