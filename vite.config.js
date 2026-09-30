// dsh-micro · vite.config.js
// 客户端 bundle 的 Vite 配置：library-CJS 模式，产物由 client_build.js 外包
// 成 DSH __ModuleLoader__ factory（CJS-in-factory）。react 等由 loader 提供，故 external。
import { defineConfig } from 'vite'
import path from 'node:path'

// ---- 正式版开关（2026-09-26）----
// `src/client_build.js --release` 把 DSH_MICRO_RELEASE 放进环境（同一个进程）。
// 正式版把产物里**所有 console 调用整条删掉**（esbuild 的 drop）：
// 客户端跑在浏览器里、写不了宿主文件，所以它这一侧的口径就是「不打 console」——
// 既满足「正式版不要在控制台刷屏」，也不必去改散落在 9 个文件里的日志调用点。
// 开发版（默认）原样保留，调试时行为与改动前一致。
const RELEASE = process.env.DSH_MICRO_RELEASE === '1'

export default defineConfig({
  define: { __MICRO_RELEASE__: JSON.stringify(RELEASE) },
  esbuild: { jsx: 'automatic', drop: RELEASE ? ['console'] : [] },
  build: {
    lib: {
      entry: path.resolve(process.cwd(), 'src/client/index.js'),
      formats: ['cjs'],
      fileName: () => 'client.cjs'
    },
    outDir: 'tmp',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'cordis'
      ],
      output: { inlineDynamicImports: true }
    }
  }
})