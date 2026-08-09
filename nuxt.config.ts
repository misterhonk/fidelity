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
  modules: ['@nuxt/ui', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

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
