import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vitest/config'

const server = 'http://localhost:3001'

// Pyodide's runtime (the interpreter and the standard library) is served from
// /pyodide/, so Python works offline. Packages (.whl) are not copied.
const pyodideDir = dirname(fileURLToPath(import.meta.resolve('pyodide')))
const pyodideCopy = viteStaticCopy({
  targets: [
    {
      src: [join(pyodideDir, '*'), '!**/*.{md,html}', '!**/*.d.ts', '!**/*.whl', '!**/pyodide/node_modules'],
      dest: 'pyodide',
      rename: { stripBase: true },
    },
  ],
})

export default defineConfig({
  plugins: [react(), tailwindcss(), pyodideCopy],
  // PGlite and Pyodide load their WebAssembly themselves; pre-bundling breaks that.
  optimizeDeps: { exclude: ['@electric-sql/pglite', 'pyodide'] },
  worker: { format: 'es' },
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
