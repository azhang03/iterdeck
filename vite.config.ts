import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const server = 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // PGlite loads its WebAssembly itself; pre-bundling breaks that.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  server: {
    proxy: {
      '/api': server,
      '/images': server,
      '/files': server,
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    // PGlite starts in a few seconds on a slow machine.
    testTimeout: 60000,
  },
})
