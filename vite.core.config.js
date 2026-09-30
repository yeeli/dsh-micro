// dsh-micro · 宿主侧 bundle 的 Vite 配置
// library-ESM 模式，产物 host.js 由 src/core_build.js 写到 lib/index.js。
// Node 内置模块保持外部 import（node:module 等）；node-hid、ws、@deepseek-ai/dsh-*
// 都通过 createRequire/import 惰性加载，不加包，运行时从 DSH 宿主环境 resolve。
import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'

const builtins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]

// ---- 正式版标记（2026-09-26）----
// `src/core_build.js` 收到 `--release` 时把 DSH_MICRO_RELEASE 放进环境（**同一个进程**，
// vite 就是这么加载这个配置文件的）。define 把标识**字面替换**成 true/false，于是
// 「日志去哪」被烘死进产物 —— 运行期不读任何环境变量（宿主是别人启动的，它的环境我们管不着）。
// 源码那一侧用 `typeof __MICRO_RELEASE__ !== 'undefined'` 包着（见 src/core/log.js 的 RELEASE），
// 所以自检直接 import 源码（没经过 vite）时它是 undefined → 落到开发版，不会 ReferenceError。
const RELEASE = process.env.DSH_MICRO_RELEASE === '1'

export default defineConfig({
  define: { __MICRO_RELEASE__: JSON.stringify(RELEASE) },
  build: {
    // 不压缩：宿主产物是按文件加载的，体积无关紧要，可读性更值钱。
    // 注意压缩器**不是**下面那个陷阱的原因（关掉它陷阱依然复现），别再往这边找。
    minify: false,
    // 必须 esnext：src/core/settings.js 在最外层用 top-level await 解析宿主的
    // schemastery（Config 必须是现成的 schema 对象，见那边的注释）。默认 target
    // （es2020）会直接报「Top-level await is not available」。宿主是 Node ≥22，
    // esnext 不需要降级任何语法。
    target: 'esnext',
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
      // ws 与 node-hid 同理：由 DSH 宿主环境提供，运行时经 ./src/core/resolve.js 解析加载
      // （眼下是动态 import，rollup 本来也看不见它；列出来是防它哪天被写成静态 import 时
      // 被打进产物 —— 打进去就是「装着第二份 ws」，服务端与客户端不再是同一个实现）。
      external: [...builtins, 'node-hid', 'ws', '@deepseek-ai/dsh-settings', '@deepseek-ai/schemastery']
    }
  }
})
