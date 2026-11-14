import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const DEFAULT_SITE = 'https://rahel.hermesbackend.xyz'

/** Sustituye el dominio por defecto por VITE_SITE_URL en index.html, robots.txt y sitemap.xml. */
function siteUrlPlugin(site: string): Plugin {
  const swap = (s: string) => s.split(DEFAULT_SITE).join(site)
  let outDir = 'dist'
  return {
    name: 'rahel-site-url',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir)
    },
    transformIndexHtml: { order: 'pre', handler: swap },
    writeBundle() {
      if (site === DEFAULT_SITE) return
      for (const f of ['robots.txt', 'sitemap.xml']) {
        const p = path.join(outDir, f)
        if (fs.existsSync(p)) fs.writeFileSync(p, swap(fs.readFileSync(p, 'utf8')))
      }
    },
  }
}

/** Deja solo el subset latin de las fuentes fontsource: quita @font-face y archivos cyrillic/greek/vietnamese/latin-ext del bundle. */
const NON_LATIN = /(cyrillic-ext|cyrillic|greek-ext|greek|vietnamese|latin-ext|hebrew|math|symbols)/
function latinFontsOnly(): Plugin {
  return {
    name: 'rahel-latin-fonts-only',
    apply: 'build',
    generateBundle(_o, bundle) {
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !name.endsWith('.css') || typeof asset.source !== 'string') continue
        asset.source = asset.source.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
          const m = block.match(/url\(([^)]*)\)/)
          return m && NON_LATIN.test(m[1].split('/').pop() ?? '') ? '' : block
        })
      }
      for (const name of Object.keys(bundle)) {
        if (/\.(woff2?|ttf)$/.test(name) && NON_LATIN.test(name.split('/').pop() ?? '')) delete bundle[name]
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const site = (env.VITE_SITE_URL || DEFAULT_SITE).replace(/\/+$/, '')
  return {
    plugins: [latinFontsOnly(), react(), tailwindcss(), siteUrlPlugin(site)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          advancedChunks: {
            groups: [
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 50 },
              { name: 'vendor-router', test: /node_modules[\\/](react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/, priority: 40 },
              { name: 'vendor-charts', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|es-toolkit|immer|reselect|redux|@reduxjs|react-redux|use-sync-external-store|react-is|tiny-invariant|clsx)[\\/]/, priority: 30 },
              { name: 'vendor-gsap', test: /node_modules[\\/](gsap|@gsap)[\\/]/, priority: 30 },
              { name: 'vendor-motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 30 },
            ],
          },
        },
      },
    },
  }
})
