import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const server = 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': server,
      '/images': server,
      '/files': server,
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
