// dsh-omkb · check_code.js
// **构建前的源码检查** —— 语法错误绝不许进产物（2026-09-27）。
//
// ── 为什么要有它 ──────────────────────────────────────────────────────────
// `vite build` 只编译**被入口 import 到**的文件。一个写坏了的模块，只要此刻没被引用，
// 构建照样「成功」并写出 lib/，直到某天有人 import 它才在运行时炸 —— 而那时现场已经不在
// 「刚改完」的地方了。这里做的是**全量**解析：src/ 下每个 .js/.jsx 都过一遍。
//
// ── 为什么用 esbuild 而不是 `node --check` ────────────────────────────────
//   · `node --check` 每个文件起一个 node 进程，本项目 46 个 .js 实测 **~17s** ——
//     放进 watch 的每次改动里不可用（改一行等 17 秒检查）；
//   · esbuild 是 vite 自带的依赖（devDependencies 里的 vite 依赖它，无需新增包），
//     同一进程内 transform，全量毫秒级；更关键的是**它的解析器与真正打包时是同一个**，
//     检查口径与构建口径天然一致，不会出现「检查过了、打包却报错」。
//
// ── 口径 ──────────────────────────────────────────────────────────────────
//   · `.js` 用 `loader: 'js'`（**更严格**：能抓出「.js 里混进了 JSX」这种会被打包器
//     静默宽容掉的写法）；`.jsx` 用 `loader: 'jsx'`。
//   · 只解析、不执行：抓的是**语法错误**（括号不配对、字符串未闭合、非法 token…）。
//     未定义变量、拼错的属性名属于运行期问题，不在这一层，由 test/verify_* 覆盖。
//
// ── 用法 ──────────────────────────────────────────────────────────────────
//   node src/check_code.js                  默认范围（src/** + lib/*.js）
//   node src/check_code.js src/core         只检查指定目录/文件
// 作为模块：`runCheck({ targets, label })` → `{ ok, errors, files, label }`
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CHECKABLE = new Set(['.js', '.jsx', '.mjs'])
// 一次最多报这么多行，避免一个文件写崩了把终端刷满（末尾会提示还剩多少）
const MAX_REPORT = 24

/** 递归收集目录下的可检查文件（跳过隐藏条目与 node_modules）。 */
export const collect = (target, out = []) => {
  const abs = path.resolve(ROOT, target)
  let st
  try {
    st = fs.statSync(abs)
  } catch {
    throw new Error(`检查目标不存在：${target}`)
  }
  if (st.isFile()) {
    if (CHECKABLE.has(path.extname(abs))) out.push(abs)
    return out
  }
  for (const name of fs.readdirSync(abs).sort()) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const child = path.join(abs, name)
    if (fs.statSync(child).isDirectory()) collect(path.relative(ROOT, child), out)
    else if (CHECKABLE.has(path.extname(name))) out.push(child)
  }
  return out
}

/** 扩展名 → esbuild loader。`.jsx` 走 jsx，其余走严格 js。 */
const loaderOf = (file) => (path.extname(file) === '.jsx' ? 'jsx' : 'js')

/**
 * 检查一组目录/文件。**不抛异常** —— 调用方（构建脚本 / CLI）自己决定怎么反应。
 *
 * ⚠ **必须用异步的 `transform()`，不能用 `transformSync()`**：同步版每次调用都要
 * spawn 一个 esbuild 子进程（本项目 60 个文件实测 14s，CPU 只占 1s，全耗在起进程上）；
 * 异步版共享同一个常驻 service，全量降到百毫秒级。这是性能与「可用」的分界线 ——
 * watch 每次改动都要跑它。
 *
 * @param {{targets?: string[], label?: string}} opts
 * @returns {Promise<{ok: boolean, errors: string[], files: number, label: string}>}
 */
export const runCheck = async ({ targets = ['src'], label = 'src' } = {}) => {
  const files = []
  for (const t of targets) collect(t, files)

  // 按文件各自收集、最后按文件顺序摊平：并发跑完的顺序不定，直接 push 会让
  // 同一份代码每次报错的**排列**都不一样（排查时最烦这种「上次明明是这行」）。
  const perFile = await Promise.all(files.map(async (file) => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/')
    let code
    try {
      code = fs.readFileSync(file, 'utf8')
    } catch (e) {
      return [`${rel}: 读不到（${e.message}）`]
    }
    try {
      await transform(code, { loader: loaderOf(file), format: 'esm', sourcefile: rel })
      return []
    } catch (e) {
      const list = e.errors
      if (!list?.length) return [`${rel}: ${e.message}`]
      const lines = []
      for (const m of list) {
        const loc = m.location
        const at = loc ? `${rel}:${loc.line}:${loc.column + 1}` : rel
        lines.push(`${at}  ${m.text}`)
        if (loc?.lineText) lines.push(`      ${loc.lineText.trim()}`)
      }
      return lines
    }
  }))

  const errors = perFile.flat()
  return { ok: errors.length === 0, errors, files: files.length, label }
}

/** 统一的报告格式：构建脚本与 CLI 都用它，终端里的样子只有一种。 */
export const report = (r, { log = console.log, error = console.error } = {}) => {
  if (r.ok) {
    log(`[omkb/check] ✓ ${r.label}：${r.files} 个文件语法检查通过`)
    return true
  }
  error(`[omkb/check] ✗ ${r.label}：${r.errors.length} 处错误`)
  for (const line of r.errors.slice(0, MAX_REPORT)) error(`  ${line}`)
  const rest = r.errors.length - MAX_REPORT
  if (rest > 0) error(`  …还有 ${rest} 行错误未列出`)
  return false
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const targets = args.length ? args : ['src', 'lib']
  const r = await runCheck({ targets, label: targets.join(' + ') })
  report(r)
  if (!r.ok) process.exitCode = 1
  // esbuild 的常驻 service 会让进程不自己退出 —— 检查完主动收尾（对 CLI 是必须的，
  // 对构建脚本无害：那边本来就还有别的活要干）。
  process.exit(process.exitCode ?? 0)
}
