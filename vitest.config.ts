import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        '**/*.d.ts',
        'test/',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    },
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    exclude: ['node_modules/', 'dist/', 'build/']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})