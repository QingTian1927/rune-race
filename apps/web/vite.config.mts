import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { buildRobotsTxt, buildSitemapXml } from './src/lib/sitemap.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const appRoot = path.resolve(repoRoot, 'apps/web')

function resolveSiteUrl(): string {
  return (process.env.VITE_SITE_URL ?? 'https://rune-race.onrender.com').replace(/\/$/, '')
}

function writePublicAndDist(relativePath: string, content: string) {
  fs.writeFileSync(path.resolve(appRoot, 'public', relativePath), content, 'utf8')
  fs.writeFileSync(path.resolve(appRoot, 'dist', relativePath), content, 'utf8')
}

function seoStaticFilesPlugin() {
  return {
    name: 'rune-race-seo-static-files',
    closeBundle() {
      const siteUrl = resolveSiteUrl()
      const lastmod = new Date().toISOString().slice(0, 10)
      writePublicAndDist('sitemap.xml', buildSitemapXml(siteUrl, lastmod))
      writePublicAndDist('robots.txt', buildRobotsTxt(siteUrl))
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
    seoStaticFilesPlugin(),
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
