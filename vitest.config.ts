import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    // The scoring engine is a pure function on purpose (docs/04, CLAUDE.md).
    // Nothing under test here needs a DOM; component tests get Vitest browser
    // mode when there are components worth testing (M3).
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/lib/**', 'shared/**', 'scripts/**'],
    },
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
