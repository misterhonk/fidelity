// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',

  devtools: { enabled: true },

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
      // Bumped by release-please.
      version: pkg.version,
    },
  },
})
