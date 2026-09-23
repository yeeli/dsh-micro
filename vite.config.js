// dsh-omkb · vite.config.js
// 客户端 bundle 的 Vite 配置：library-CJS 模式，产物由 client_build.js 外包
// 成 DSH __ModuleLoader__ factory（CJS-in-factory）。react 等由 loader 提供，故 external。
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
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