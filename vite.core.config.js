// dsh-omkb · 宿主侧 bundle 的 Vite 配置
// library-ESM 模式，产物 host.js 由 src/core_build.js 写到 lib/index.js。
// Node 内置模块保持外部 import（node:module 等）；node-hid、@deepseek-ai/dsh-*
// 都通过 createRequire/import 惰性加载，不加包，运行时从 DSH 宿主环境 resolve。
import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'

const builtins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]

export default defineConfig({
  build: {
    // 不压缩：宿主产物是按文件加载的，体积无关紧要，可读性更值钱。
    // 注意压缩器**不是**下面那个陷阱的原因（关掉它陷阱依然复现），别再往这边找。
    minify: false,
    lib: {
      entry: path.resolve(process.cwd(), 'src/core/index.js'),
      formats: ['es'],
      fileName: () => 'host.js'
    },
    outDir: 'tmp-host',
    emptyOutDir: true,
    rollupOptions: {
      // 必须关掉 tree-shaking。它会做一件极其隐蔽的事：按**被调用方的解构形参**裁剪
      // 对象字面量实参——`createBleReader({ logger, diagnostics })` 遇上
      // `({ logger } = {})` 会被打包成 `createBleReader({ logger })`，多出来的选项
      // **静默消失**（源码里明明传了、产物里没有、不报错、不告警）。
      // 宿主产物只有几十 KB，没有需要摇掉的死代码，用可预测性换这点体积完全值得。
      // 若哪天重新打开它：工厂函数要么改成不透明形参 `(options = {}) => new X(options)`，
      // 要么务必跑一遍 npm run verify:led / verify:settings 看产物。
      treeshake: false,
      external: [...builtins, 'node-hid', '@deepseek-ai/dsh-settings', '@deepseek-ai/schemastery']
    }
  }
})
