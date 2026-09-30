// dsh-micro · core/resolve.js
// **DSH 运行时依赖的解析器** —— 插件自己不声明、只能从宿主环境里找的那些包。
//
// ── 为什么需要它 ──────────────────────────────────────────────────────────
// schemastery（设置 schema）与 ws（状态推送的 WebSocket 服务端）都由 DSH 运行时提供。
// 麻烦在「从哪个位置解析」：Node 默认把符号链接解析成**真实路径**，所以开发态以 `link:`
// 挂进 profile 的插件，其 import.meta.url 指向项目目录 —— 那里没有 node_modules/@deepseek-ai，
// 也没有 ws，`createRequire(import.meta.url)` 一上来就 MODULE_NOT_FOUND。
//
// 因此按「最近 → 最远」依次尝试多个解析根，并把每个根的错误码收集起来：全部失败时日志能
// 直接指出是哪一环断的，而不是只报一句「用不了」。
//
// ── 为什么单独一个文件（2026-10-01）────────────────────────────────────────
// 这段逻辑原本长在 settings.js 里（只服务 schemastery）。状态推送要用 ws，也需要同一套
// 解析根；若复制一份，两处会各自漂移 —— 将来加一个根（比如 DSH 改了目录布局）只改了一边，
// 就会表现成「设置能读、推送起不来」这种极难排查的半死状态。抽出来共用一份。
//
// ⚠ 解析到的路径由调用方决定怎么加载：settings.js 用**顶层 await import()**（Config 必须是
// 现成的 schema 对象，不能延后），state-socket.js 用 loadDep()（异步、失败可降级）。

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 解析根候选：插件的真实路径、宿主进程入口、cwd、DSH_DEPS_DIR、DSH_HOME。 */
export const resolverRoots = () => {
  const roots = []
  const push = (label, base) => {
    if (typeof base === 'string' && base.length > 0) roots.push({ label, base })
  }
  push('插件自身', import.meta.url)
  push('宿主进程入口', process.argv[1])
  push('工作目录', path.join(process.cwd(), 'package.json'))
  const depsDir = process.env.DSH_DEPS_DIR
  push('DSH_DEPS_DIR', depsDir ? path.join(depsDir, 'package.json') : null)
  const dshHome = process.env.DSH_HOME || path.join(homedir(), '.dsh')
  push('DSH_HOME/profile', path.join(dshHome, 'profiles', 'node_modules', 'package.json'))
  return roots
}

/**
 * 按 {@link resolverRoots} 的顺序解析一个包。
 * @param pkg - 包名。
 * @returns {{ok: true, path: string, root: string} | {ok: false, failures: string[]}}
 */
export const resolveDep = (pkg) => {
  const failures = []
  for (const root of resolverRoots()) {
    try {
      const req = createRequire(root.base)
      return { ok: true, path: req.resolve(pkg), root: root.label }
    } catch (e) {
      failures.push(`${root.label}(${e && e.code ? e.code : (e && e.message) || e})`)
    }
  }
  return { ok: false, failures }
}

/**
 * 解析**并加载**一个包。失败不抛 —— 调用方自己决定降级还是报错。
 *
 * 用 import() 而不是 require()：宿主用 Promise.all 并发加载插件，那一刻 ESM 依赖可能还没
 * 求值完，同步 require 会抛 ERR_REQUIRE_ESM_RACE_CONDITION（而且发生在模块求值期，同步
 * 路径上无法重试）。await 会等它求值完。
 *
 * @param pkg - 包名。
 * @returns {Promise<{ok: true, mod: any, path: string, root: string} | {ok: false, reason: string}>}
 */
export const loadDep = async (pkg) => {
  const resolved = resolveDep(pkg)
  if (!resolved.ok) {
    return { ok: false, reason: `解析失败：${pkg} ← ${resolved.failures.join(' / ')}` }
  }
  try {
    const mod = await import(pathToFileURL(resolved.path).href)
    return { ok: true, mod, path: resolved.path, root: resolved.root }
  } catch (e) {
    const code = e && e.code ? e.code + ': ' : ''
    return { ok: false, reason: `已解析到 ${resolved.path}（经 ${resolved.root}），但加载失败：${code}${(e && e.message) || e}` }
  }
}