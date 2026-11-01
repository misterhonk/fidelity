import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

const bench = 'tests/unit/scoring-bench.spec.ts'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup/indexeddb.ts'],
    // The matching engine is a pure function on purpose (CLAUDE.md), so most
    // of what matters here needs no DOM. Component tests get Vitest browser
    // mode once there are components worth testing (M3).
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['db/**', 'worker/**', 'shared/**', 'scripts/**', 'app/utils/**'],
    },
    // The scoring benchmark runs after every other file, alone, so it times
    // the engine and not the test files competing for the runner's CPU.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, bench],
        },
      },
      { extends: true, test: { name: 'bench', include: [bench], sequence: { groupOrder: 1 } } },
    ],
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
