// dsh-omkb · client_build.js
// 用 Vite 把 src/client/ 打包成 CJS，再包成 DSH __ModuleLoader__ factory bundle，
// 写出到 lib/client.js。
// 用法：node src/client_build.js   （或 npm run build:client）
//
// CJS-in-factory：Vite CJS 产物使用 require/module/exports；把它放进 factory 函数体
// 执行，则 factory 的 require 形参与局部 module/exports 恰好覆盖这些名字，
// CJS 里的 require('react') 会解析到 loader 注入的 react（react 不打包）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'tmp')
const outFile = path.join(root, 'lib', 'client.js')
const configFile = path.join(root, 'vite.config.js')

async function main() {
  await build({
    configFile,
    logLevel: 'error'
  })

  const cjsPath = path.join(outDir, 'client.cjs')
  const cjs = fs.readFileSync(cjsPath, 'utf8')

  // 移除 Vite 可能写入的源码映射注释，避免污染 loader wrapper
  const body = cjs.replace(/\n?\/\/# sourceMappingURL=.*$/m, '')

  const bundle = `// dsh-omkb · 客户端（Client）· 由 Vite + client_build.js 生成，勿手改。
// 源码在 src/client/，改后执行：npm run build:client
window.__ModuleLoader__.load({
  id: 'dsh-omkb',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
${body}
    return module.exports;
  }
});
`

  fs.writeFileSync(outFile, bundle, 'utf8')
  fs.rmSync(outDir, { recursive: true, force: true })
  console.log(`[omkb/build] 已生成 ${outFile}`)
}

main().catch((e) => {
  console.error('[omkb/build] 构建失败:', e)
  process.exitCode = 1
})