import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => {
  const base = process.env.VITE_BASE ?? (command === 'serve' ? '/' : '/projects/porter/')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(root, './src') },
    },
    base,
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
