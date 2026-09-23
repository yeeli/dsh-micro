// dsh-omkb · host_build.js
// 用 Vite 把 src/host/ 打包成 ESM，写出到 lib/index.js，构建后清理 tmp-host。
// 用法：node src/host_build.js   （或 npm run build:host）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'tmp-host')
const outFile = path.join(root, 'lib', 'index.js')
const configFile = path.join(root, 'vite.core.config.js')

async function main() {
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
  console.log(`[omkb/build] 已生成 ${outFile}`)
}

main().catch((e) => {
  console.error('[omkb/build] 构建失败:', e)
  process.exitCode = 1
})
