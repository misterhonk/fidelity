// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'

// Directory layout is the Nuxt 4 default and matches docs/07-DEV-PIPELINE.md §1:
//   app/     pages, components, composables, layouts, assets
//   server/  api, lib/discogs, jobs, db
//   shared/  zod schemas and types, auto-imported on both sides
export default defineNuxtConfig({
  // Pins Nitro's behaviour to the day this project was scaffolded.
  compatibilityDate: '2026-08-09',

  devtools: { enabled: true },

  // Nuxt UI 4 brings Tailwind 4 and registers @tailwindcss/vite itself — the
  // Vite plugin route, not PostCSS (docs/01-ARCHITEKTUR.md §4.6).
  // @nuxt/eslint generates .nuxt/eslint.config.mjs, which knows about
  // auto-imports, route types and the component names in scope.
  modules: ['@nuxt/ui', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    // Type checking runs as its own job (`pnpm typecheck`), not inside dev/build.
    typeCheck: false,
  },

  runtimeConfig: {
    // NUXT_TOKEN_KEY — pgcrypto key for OAuth tokens at rest (M1).
    tokenKey: '',
    discogs: {
      // NUXT_DISCOGS_CONSUMER_KEY / NUXT_DISCOGS_CONSUMER_SECRET
      consumerKey: '',
      consumerSecret: '',
      // Mandatory on every Discogs request — without it the API answers 403 or
      // hands back an empty body (docs/02-DISCOGS-API.md).
      userAgent: 'Fidelity/0.1.0 +https://fidelity.example.de',
    },
    public: {
      // Bumped by release-please, surfaced through /api/health.
      version: pkg.version,
    },
  },
})
