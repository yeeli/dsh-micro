// dsh-micro · watch_build.js
// 监听 src/ 的改动，自动重跑构建（等价于手动 `pnpm build`）。
//
//   pnpm watch              启动前先完整构建一次
//   pnpm watch --no-initial 只监听，启动时不构建
//   pnpm watch --release    按正式版口径构建（透传给两个 build 脚本）
//   pnpm watch --no-smoke   不跑构建后的冒烟自检（见下）
//
// ── 一轮 = 检查 + 构建 + 冒烟自检 ──────────────────────────────────────────
//   ① **语法检查**在构建脚本内部（`src/check_code.js`）—— 有语法错就不产出坏 lib/；
//   ② **构建**交给 core_build.js / client_build.js；
//   ③ **冒烟自检**（`src/smoke_check.js`）在构建之后：语法检查挡不住「变量名打错、
//      忘了 import、空指针」这类**只有真跑到那一行才会抛**的错误 —— 跑几套关键自检
//      把它们拽到明面上（本地约 5–8 秒）。**崩溃**会让那一轮标红，但**不退出监听**：
//      用户多半正改到一半，改好保存即自动重跑。
//
// ── 为什么不用 `vite build --watch` ────────────────────────────────────────
// 本项目的产物**不是 vite 直接写出来的**：core_build.js / client_build.js 各自在 vite 跑完之后
// 还有一段后处理（读 tmp-host/、tmp/ 里的中间产物 → 包成 lib/index.js 与 lib/client.js 的
// loader factory → 删掉临时目录）。`vite build --watch` 只会重建中间产物，那段后处理没人做，
// lib/ 不会更新 —— 而插件加载的正是 lib/。所以这里监听的是**文件事件**，构建仍然**整体交给
// 那两个脚本**：后处理只有一份实现，不会出现「watch 模式与手动 build 产出不一样」。
//
// ── 为什么按 core / client 分流 ────────────────────────────────────────────
// 两个 bundle 的源文件完全不相交（src/core/** 与 src/client/**），改一边没必要重打另一边。
// 全量构建约几秒，分流后改一个文件通常只跑一条，等待时间减半。
//
// ── 两个必须做对的地方 ────────────────────────────────────────────────────
//   · **防抖**：编辑器保存一次会连着来好几个事件（很多编辑器还是「写临时文件再 rename」），
//     不防抖就会同一份改动连打好几遍。
//   · **构建期间来的改动不许丢**：构建要跑几秒，这期间用户还在改。做法是攒进 pending，
//     当前这轮跑完立刻再跑一轮 —— 保证最后落盘的那份一定被打进产物。
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runSmoke } from './smoke_check.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const RELEASE = process.argv.includes('--release')
const NO_INITIAL = process.argv.includes('--no-initial')
const NO_SMOKE = process.argv.includes('--no-smoke')
const DEBOUNCE_MS = Number(process.env.MICRO_WATCH_DEBOUNCE ?? 250) || 250

// 关心哪些扩展名（其余一律不看：.DS_Store、编辑器交换文件、临时文件都在这里被挡掉）
const WATCHED_EXT = new Set(['.js', '.jsx', '.mjs', '.css', '.json'])
// 目录里可能混进的噪音（编辑器产物 / 系统文件）
const NOISE = /^\.|~$|^\.DS_Store$|^\.sw[a-z]$|^4913$/

// 每个产物的构建脚本 + 它依赖的源码范围（改到就重打）
const TARGETS = {
  core: {
    script: path.join(SRC, 'core_build.js'),
    label: 'core → lib/index.js',
    own: (rel) => rel === 'src/core_build.js' || rel.startsWith('src/core/'),
    config: 'vite.core.config.js'
  },
  client: {
    script: path.join(SRC, 'client_build.js'),
    label: 'client → lib/client.js',
    own: (rel) => rel === 'src/client_build.js' || rel.startsWith('src/client/'),
    config: 'vite.config.js'
  }
}

const watchers = []
const pending = new Set() // 待重打的产物
const touched = [] // 这一轮改动的文件（只用于展示）
let running = false
let timer = null

const stamp = () => new Date().toTimeString().slice(0, 8)
const log = (msg) => console.log(`[micro/watch] ${msg}`)

/** 相对仓库根的 POSIX 路径；不在 src 下（或就是本脚本）返回 null。 */
const relOf = (file) => {
  if (!file) return null
  const abs = path.resolve(SRC, file)
  return path.relative(ROOT, abs).split(path.sep).join('/')
}

/** 这个改动该重打谁。本脚本自己不进任何 bundle，改它不必构建。 */
const targetsOf = (rel) => {
  if (!rel || rel === 'src/watch_build.js') return []
  if (!WATCHED_EXT.has(path.extname(rel))) return []
  if (NOISE.test(path.basename(rel))) return []
  // 根目录的两个 vite 配置只影响各自那一条
  for (const [name, t] of Object.entries(TARGETS)) if (rel === t.config) return [name]
  return Object.entries(TARGETS).filter(([, t]) => t.own(rel)).map(([name]) => name)
}

/** 跑一条构建。失败只报错、不退出 —— 监听要继续（用户多半正在改到一半）。 */
const run = (name) => {
  const t = TARGETS[name]
  return new Promise((resolve) => {
    const args = [t.script, ...(RELEASE ? ['--release'] : [])]
    const child = spawn(process.execPath, args, { cwd: ROOT })
    const out = []
    const err = []
    child.stdout.on('data', (b) => out.push(b.toString()))
    child.stderr.on('data', (b) => err.push(b.toString()))
    child.on('close', (code) => {
      if (code === 0) {
        for (const line of out.join('').trim().split('\n')) log(`  ${line.trim()}`)
        resolve(true)
      } else {
        log(`✗ ${name} 构建失败（exit ${code}）`)
        const text = (err.join('') || out.join('')).trim()
        for (const line of text.split('\n').slice(0, 20)) if (line.trim()) log(`  ${line.trim()}`)
        resolve(false)
      }
    })
  })
}

/**
 * 跑一轮。running 期间进来的改动留在 pending 里，本轮结束后立刻再跑一轮 ——
 * 否则「用户边构建边改」的最后一次改动会被吞掉。
 */
async function tick() {
  if (running || pending.size === 0) return
  running = true
  const targets = [...pending]
  pending.clear()
  const files = [...touched]
  touched.length = 0

  const shown = files.slice(0, 6)
  const more = files.length - shown.length
  log(`${stamp()} 改动 ${files.length} 个文件${more > 0 ? `（列出前 6 个）` : ''} → 重打 ${targets.join(' + ')}`)
  for (const f of shown) log(`  · ${f}`)

  const t0 = Date.now()
  for (const name of targets) await run(name)
  const buildMs = Date.now() - t0

  // 构建后跑冒烟自检：语法检查（在构建脚本里）只能挡住语法错误，而「变量名打错 /
  // 忘了 import / 空指针」要到真跑那一行才抛（见 src/smoke_check.js 的真实事故）。
  // 失败**不退出监听** —— 用户多半正改到一半。
  if (!NO_SMOKE) {
    const strip = (m) => String(m).replace('[micro/smoke] ', 'smoke ')
    const ok = await runSmoke({ log: (m) => log(strip(m)), error: (m) => log(strip(m)) })
    if (!ok) log('  ⚠ 冒烟自检发现**崩溃**（代码跑不起来）—— 监听继续，改好保存即自动重跑')
  }

  log(`  完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s（构建 ${(buildMs / 1000).toFixed(1)}s）`)

  running = false
  if (pending.size > 0) tick() // 攒过一轮了，不用再等防抖
}

const schedule = (rel) => {
  const targets = targetsOf(rel)
  if (targets.length === 0) return
  for (const t of targets) pending.add(t)
  if (rel && !touched.includes(rel)) touched.push(rel)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; tick() }, DEBOUNCE_MS)
}

// ---------- 监听 ----------
// src/ 递归监听（macOS 的 FSEvents 覆盖整个子树，新建的子目录也在内）。
// 只报名字、不报内容，所以这里不需要关心文件有多大。
watchers.push(fs.watch(SRC, { recursive: true }, (_event, file) => schedule(relOf(file))))

// 根目录**不递归**地看一眼：只为捕捉两个 vite 配置的改动。
// 构建本身会在根目录创建/删除 tmp/ 与 tmp-host/，非递归看不到目录内部，
// 且 targetsOf 只认白名单文件名 —— 不会自己触发自己。
watchers.push(fs.watch(ROOT, { recursive: false }, (_event, file) => schedule(file ?? null)))

const stop = () => {
  for (const w of watchers) w.close()
  log('已停止监听')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

log(`监听 ${path.relative(ROOT, SRC)}/** 与两个 vite 配置（防抖 ${DEBOUNCE_MS}ms，Ctrl+C 退出）`)
log(NO_SMOKE
  ? '构建前查语法；冒烟自检已用 --no-smoke 关闭'
  : '构建前查语法，构建后跑冒烟自检（--no-smoke 可关）')
if (RELEASE) log('口径 = **正式版**（产物不打日志），与 pnpm build:prod 一致')

if (NO_INITIAL) {
  log('跳过启动构建（--no-initial），等待第一次改动…')
} else {
  pending.add('core')
  pending.add('client')
  touched.push('（启动构建）')
  tick()
}
