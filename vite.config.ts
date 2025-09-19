import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: 'src/renderer',
  base: './', // 使用相对路径，适用于Electron应用
  build: {
    outDir: '../../dist/renderer',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  server: {
    port: 3000
  }
})