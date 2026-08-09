import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['tests/setup/indexeddb.ts'],
    // The matching engine is a pure function on purpose (CLAUDE.md), so most
    // of what matters here needs no DOM. Component tests get Vitest browser
    // mode once there are components worth testing (M3).
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['db/**', 'worker/**', 'shared/**', 'scripts/**'],
    },
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
