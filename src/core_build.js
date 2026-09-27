// dsh-omkb · core_build.js
// 用 Vite 把 src/core/ 打包成 ESM，写出到 lib/index.js，构建后清理 tmp-host。
// 用法：node src/core_build.js   （或 npm run build:core）
//
// ⚠ **构建前会先做一次全量源码检查**（见 src/check_code.js，2026-09-27）：
//   语法错误绝不进产物，检查不过就中止，lib/ 里留着上一份能用的产物。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { runCheck, report } from './check_code.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'tmp-host')
const outFile = path.join(root, 'lib', 'index.js')
const configFile = path.join(root, 'vite.core.config.js')

// ---- 正式版开关（2026-09-26）----
// `node src/core_build.js --release`（= `npm run build:core:prod`）产出**正式版**产物：
// `[omkb]` 日志只写 `$DSH_HOME/logs/dsh-omkb.log`，终端一行都不打（见 src/core/log.js）。
// 不传 = 开发版，日志照旧打终端（调试用）。
//
// 往下传的方式是**环境变量**：vite 把本项目的 vite.core.config.js 加载在**同一个进程**里，
// 那边读 `process.env.DSH_OMKB_RELEASE` 决定 `define`（见那个文件）。用 `--release` 而不是
// 在 npm script 里写 `DSH_OMKB_RELEASE=1 node …`，是为了不依赖 shell 的赋值语法，
// 也让「这次构建是哪一种」在 package.json 里一眼可见。
const RELEASE = process.argv.includes('--release')
if (RELEASE) process.env.DSH_OMKB_RELEASE = '1'

async function main() {
  // ---- 构建前检查（2026-09-27）----
  // 放在最前面是有意的：**检查不过就不该动 lib/**。若先打包再检查，坏产物已经写出去了，
  // 而插件加载的正是 lib/ —— 那就成了「构建报错、设备上却已经是坏的」。
  // ⚠ 这一层只抓语法。未定义变量、拼错的属性名之类属于运行期问题，由 test/verify_* 覆盖。
  const checked = await runCheck({ targets: ['src/core', 'src/core_build.js'], label: 'core' })
  if (!report(checked)) {
    console.error('[omkb/build] 已中止构建（core 源码检查未通过，lib/index.js 保持上一份）')
    process.exitCode = 1
    return
  }

  await build({
    configFile,
    logLevel: 'error'
  })

  // Vite ESM 产物通常是 host.js（fileName 固定），但兜底：读 tmp-host/ 下唯一的
  // .js/.mjs 文件，保证无论文件名如何都能工作。
  const candidates = fs.readdirSync(outDir).filter((f) => /\.(js|mjs)$/.test(f))
  if (candidates.length !== 1) {
    throw new Error(`tmp-host 下应只有一个 JS/MJS 产物，实际 ${candidates.length}: ${candidates.join(', ')}`)
  }
  const esm = fs.readFileSync(path.join(outDir, candidates[0]), 'utf8')

  fs.writeFileSync(outFile, esm, 'utf8')
  fs.rmSync(outDir, { recursive: true, force: true })
  console.log(`[omkb/build] 已生成 ${outFile}（${RELEASE ? '正式版：日志写文件，终端安静' : '开发版：日志打终端'}）`)
}

main().catch((e) => {
  console.error('[omkb/build] 构建失败:', e)
  process.exitCode = 1
})
