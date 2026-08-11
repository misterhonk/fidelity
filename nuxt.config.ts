// https://nuxt.com/docs/api/configuration/nuxt-config
import { execSync } from 'node:child_process'

import pkg from './package.json'

// Fidelity has no backend (ADR-007). Directory layout per CLAUDE.md:
//   app/     Nuxt — pages, components, composables. Presentation only.
//   worker/  discogs, match, horizon. All the actual work.
//   db/      IndexedDB schema and access via idb.
//   shared/  types and the main ↔ worker postMessage protocol.
/**
 * The one description that reaches a link preview.
 *
 * English and one string, for the same reason the manifest is: this is read
 * before any of the app's code runs, so it cannot follow the language switch.
 * It says what the app does rather than what it is called — "Fidelity" alone
 * tells a person nothing about why the link is worth opening.
 */
/**
 * Wurzel oder Unterverzeichnis — eine Zahl, fünf Wirkungen.
 *
 * Nuxt liest `NUXT_APP_BASE_URL` von sich aus für `app.baseURL`. Was es *nicht*
 * von sich aus tut, ist das Manifest und den Service Worker mitzuziehen: deren
 * `start_url`, `scope` und `navigateFallback` blieben bei "/" stehen, und eine
 * PWA mit falschem Scope installiert sich auf die falsche Adresse.
 *
 * Gemessen am 2026-08-11 gegen einen Build für martinmelcher.de/fidelity: ohne
 * das hier sucht die fertige Seite ihre eigenen Dateien unter /_nuxt/ — also im
 * Wurzelverzeichnis einer fremden Website — und bleibt weiß.
 *
 * Leer gelassen ist "/", also genau das, was Docker und das Release-Zip
 * erwarten. Der Unterpfad ist die Ausnahme, nicht die Regel.
 */
const base = process.env.NUXT_APP_BASE_URL ?? '/'

const SHARE = {
  title: 'Fidelity — the clerk behind the counter, for Discogs',
  description:
    'Scan a Discogs shop and get back a scored list of the records in it that fit your collection — each one with a sentence saying why. Runs entirely in your browser.',
} as const

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

  /*
   * Three type sets, all self-hosted.
   *
   * @nuxt/fonts downloads at build time and serves from /_fonts/, so nothing
   * is fetched from a third party while somebody uses the app — which is the
   * same promise docs/09 makes about everything else here.
   *
   * All three are declared rather than only the chosen one: the point is to
   * look at them on real data before deciding, and a preview that needs a
   * rebuild per candidate is not a preview.
   */
  fonts: {
    /*
     * The three sets live in `--fid-font-*` custom properties, because that is
     * where the tokens put typography and no component should name a face.
     * The scanner looks at `font-family` declarations by default and would see
     * nothing but `var(...)` — so it is told to read the variables too.
     */
    processCSSVariables: true,
    families: [
      { name: 'General Sans', provider: 'fontshare', weights: [400, 500, 600, 700] },
      { name: 'Switzer', provider: 'fontshare', weights: [400, 500, 600, 700] },
      { name: 'Clash Display', provider: 'fontshare', weights: [500, 600, 700] },
      { name: 'Array', provider: 'fontshare', weights: [400, 700] },
      { name: 'Chivo Mono', provider: 'google', weights: [400, 500, 600] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 600] },
    ],
  },

  app: {
    baseURL: base,

    head: {
      meta: [
        // Nothing here is meant for a search index (docs/00 §9). robots.txt
        // asks politely; this is the part crawlers actually honour.
        { name: 'robots', content: 'noindex, nofollow' },

        /*
         * The card a link turns into when somebody pastes it.
         *
         * On the shell rather than per page, and that is not laziness: with
         * `ssr: false` every address serves this one index.html. Whatever a
         * chat client, a messenger or a link preview fetches, it gets exactly
         * these tags — the per-page titles below are written by the app after
         * the page has already been fetched, which no unfurler waits for.
         *
         * So this describes the app, and the document title describes the
         * screen. Two different jobs that look like one.
         */
        { name: 'description', content: SHARE.description },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Fidelity' },
        { property: 'og:title', content: SHARE.title },
        { property: 'og:description', content: SHARE.description },
        { property: 'og:image', content: '/icons/icon-512.png' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: SHARE.title },
        { name: 'twitter:description', content: SHARE.description },

        /*
         * Ohne diese zwei bleibt die Adressleiste stehen.
         *
         * Gemessen am 2026-08-11 gegen die ausgelieferte Seite: das HTML trug
         * *keinen* Verweis auf das Manifest — @vite-pwa erzeugt die Datei, aber
         * der `<link>` landet bei `ssr: false` nicht im vorgerenderten HTML.
         * Damit findet iOS das Manifest nie, fällt auf sein altes Verhalten
         * zurück, und `display: standalone` wird nie gelesen.
         *
         * `apple-mobile-web-app-capable` ist der alte Name und der, auf den
         * iOS bis heute hört; `mobile-web-app-capable` ist der heutige.
         * Beide, weil der eine ohne den anderen auf je einer Plattform nichts
         * tut.
         */
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },

        // Die Statusleiste über der App: durchscheinend, damit der dunkle
        // Hintergrund der App bis unter die Uhr läuft statt an einem weißen
        // Balken zu enden.
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],

      /*
       * Alles, was „Zum Home-Bildschirm" liest, muss **hier** stehen.
       *
       * Diese Verweise standen in app.vue, also in einem `useHead` — das läuft
       * beim Hydrieren und landet nie im vorgerenderten HTML. Safari liest für
       * das Hinzufügen aber genau dieses statische HTML: es fand kein Manifest
       * und kein Icon, nahm den Seitentitel („Willkommen · Fidelity") und malte
       * ein W in ein schwarzes Quadrat.
       *
       * Und alle drei mit Basispfad. Ohne ihn zeigt `/icons/…` unter
       * /fidelity/ auf die Domainwurzel — gemessen: 404 dort, 200 mit Pfad.
       */
      link: [
        { rel: 'manifest', href: `${base}manifest.webmanifest` },
        { rel: 'icon', type: 'image/svg+xml', href: `${base}icon.svg` },
        { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` },
      ],
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
      /*
       * The manifest is read once at install time, by the operating system,
       * before any of the app's own code runs. It cannot follow the language
       * switch, so it says English — the base language (ADR-010) — and stays
       * one string in one language on purpose.
       */
      description: 'The clerk behind the counter — for Discogs.',
      lang: 'en',
      start_url: base,
      scope: base,
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
      navigateFallback: `${base}200.html`,

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
      /*
       * Ausdrücklich `true`, und das ist kein Zierrat.
       *
       * Das Modul setzt seine Vorgaben so:
       *
       *     const client = options.client ?? { registerPlugin: true, … }
       *     if (client.registerPlugin) addPlugin(…)
       *
       * Das Vorgabe-Objekt greift also nur, wenn `client` **ganz** fehlt. Steht
       * hier auch nur ein einziger anderer Schlüssel — wie `installPrompt` —,
       * ist `registerPlugin` `undefined`, und das Plugin, das den Service
       * Worker registriert, wird nie hinzugefügt.
       *
       * Mit `generateSW` fällt das nicht auf: dort spritzt vite-plugin-pwa die
       * Registrierung zusätzlich ins HTML, und die greift. Beim Versuch, auf
       * `injectManifest` zu wechseln, blieb nur dieser Weg übrig — und die App
       * war ohne Service Worker: gebaut, ausgeliefert, von niemandem
       * registriert. Gemessen: vorher eine Registrierung, nachher null.
       */
      registerPlugin: true,
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
    server: {
      /*
       * Vite rejects requests whose Host header it does not recognise, which is
       * right — it stops DNS rebinding against a dev server. A Cloudflare quick
       * tunnel arrives as `<something>.trycloudflare.com`, so that one suffix is
       * allowed explicitly rather than the check being switched off.
       *
       * Dev only: `nuxt generate` produces static files and has no server.
       */
      allowedHosts: ['.trycloudflare.com'],
    },

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
      // Bumped by release-please, shown in the footer.
      version: pkg.version,
      /*
       * Which build exactly, next to the version.
       *
       * The version alone cannot answer "is this the code I just deployed" —
       * it only moves when a release is cut, and a service worker can serve a
       * shell from before that for as long as somebody taps "Später". Seven
       * characters settle it.
       *
       * Falls back to empty rather than failing: `git` is not there in every
       * build environment, and a missing commit hash is not worth a broken
       * build.
       */
      commit: buildCommit(),
    },
  },
})

function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}
