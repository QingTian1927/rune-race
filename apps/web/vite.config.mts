import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { buildSitemapXml } from './src/lib/sitemap.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const appRoot = path.resolve(repoRoot, 'apps/web')

function resolveSiteUrl(): string {
  return (process.env.VITE_SITE_URL ?? 'https://rune-race.onrender.com').replace(/\/$/, '')
}

function sitemapPlugin() {
  return {
    name: 'rune-race-sitemap',
    closeBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      const xml = buildSitemapXml(resolveSiteUrl(), lastmod)
      const publicPath = path.resolve(appRoot, 'public/sitemap.xml')
      const distPath = path.resolve(appRoot, 'dist/sitemap.xml')
      fs.writeFileSync(publicPath, xml, 'utf8')
      fs.writeFileSync(distPath, xml, 'utf8')
    },
  }
}

export default defineConfig({
  // Load VITE_* from repo-root `.env` (see `.env.example`)
  envDir: repoRoot,
  ssr: {
    // Bundle for prerender so pnpm workspace symlinks do not break source-map resolution.
    noExternal: ['react-helmet-async'],
  },
  plugins: [
    react(),
    sitemapPlugin(),
    vitePrerenderPlugin({
      renderTarget: '#root',
      prerenderScript: path.resolve(appRoot, 'src/prerender.tsx'),
      additionalPrerenderRoutes: ['/about', '/guide', '/privacy', '/privacy/en', '/terms', '/terms/en'],
    }),
  ],
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
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ready': {
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
