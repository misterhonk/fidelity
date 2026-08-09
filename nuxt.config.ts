// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'

// Fidelity has no backend (ADR-007). Directory layout per CLAUDE.md:
//   app/     Nuxt — pages, components, composables. Presentation only.
//   worker/  discogs, match, horizon. All the actual work.
//   db/      IndexedDB schema and access via idb.
//   shared/  types and the main ↔ worker postMessage protocol.
export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',

  devtools: { enabled: true },

  // No server at runtime. `nuxt generate` writes .output/public and that is
  // the whole deployment: a docroot, Cloudflare Pages, GitHub Pages.
  ssr: false,

  nitro: {
    preset: 'static',
    prerender: {
      // The shell only. Every route is resolved client-side; unknown paths
      // fall back to 200.html.
      routes: ['/'],
    },
  },

  // Nuxt UI 4 brings Tailwind 4 and registers @tailwindcss/vite itself — the
  // Vite plugin route, not PostCSS (docs/01-ARCHITEKTUR.md §4.4).
  modules: ['@nuxt/ui', '@nuxt/eslint', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      // Nothing here is meant for a search index (docs/00 §9). robots.txt asks
      // politely; this is the part crawlers actually honour.
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    },
  },

  pwa: {
    // Never 'autoUpdate'. A silent skipWaiting would swap the code out from
    // under a running dig — four minutes of scanning, gone. The user gets
    // asked, and the answer can be "later".
    registerType: 'prompt',
    manifest: {
      name: 'Fidelity',
      short_name: 'Fidelity',
      description: 'Der Verkäufer hinter der Theke – für Discogs.',
      lang: 'de',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      // The neutral ramp's darkest step: the shell must not flash white while
      // the app boots on a phone.
      background_color: '#0a0908',
      theme_color: '#0a0908',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallback: '/200.html',

      runtimeCaching: [
        {
          /*
           * Covers.
           *
           * They come from i.discogs.com, which has its own Cloudflare limit
           * of roughly 30–40 requests a minute that has nothing to do with the
           * API budget (docs/02). Caching them is therefore not a nicety: a
           * second look at a dig would otherwise re-fetch every thumbnail and
           * run straight into a limit the app cannot even see.
           *
           * CacheFirst because a cover never changes — the URLs are signed and
           * content-addressed, so a new image is a new URL.
           *
           * ⚠️ docs/06 M6 asks for a 150 MB LRU cap and Workbox has no
           * byte-based one; ExpirationPlugin counts entries and age. 6.000
           * entries is that budget expressed in the unit available, at the
           * ~25 KB a 150px thumbnail actually weighs. purgeOnQuotaError is the
           * real safety net: if the estimate is wrong and the browser runs out,
           * the cache is dropped rather than writes failing silently.
           */
          urlPattern: ({ url }) => url.hostname === 'i.discogs.com',
          handler: 'CacheFirst',
          options: {
            cacheName: 'fidelity-covers',
            expiration: {
              maxEntries: 6000,
              maxAgeSeconds: 60 * 60 * 24 * 90,
              purgeOnQuotaError: true,
            },
            // 0 keeps opaque responses, which is what a cross-origin image
            // without CORS headers comes back as.
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    client: {
      // The install prompt is handled in the UI, not by the module: iOS has no
      // beforeinstallprompt at all and needs a coach mark instead (M6).
      installPrompt: false,
    },
    devOptions: {
      // A service worker in dev caches the very thing being edited.
      enabled: false,
    },
  },

  vite: {
    worker: {
      // Without this Vite bundles the whole worker into one file and the
      // dynamic imports in worker/handlers.ts split into nothing. The basket
      // and the detail sheet are not needed to run a dig, and a dig is the
      // thing somebody actually waits for (docs/12 §2).
      format: 'es',
    },
  },

  typescript: {
    strict: true,
    // Type checking runs as its own job (`pnpm typecheck`), not inside dev/build.
    typeCheck: false,
  },

  runtimeConfig: {
    public: {
      // Bumped by release-please, shown in the about screen.
      version: pkg.version,
    },
  },
})
