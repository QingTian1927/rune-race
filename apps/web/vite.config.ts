import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  // Load VITE_* from repo-root `.env` (see `.env.example`)
  envDir: repoRoot,
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: ['..', '../../'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
})
