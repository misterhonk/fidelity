import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3000)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The app is a PWA whose weakest target is iOS Safari. Testing only
    // Chromium means not testing the browser that matters.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    // The production build, not the dev server — that is what actually ships.
    command: 'pnpm build && node .output/server/index.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NITRO_PORT: String(PORT),
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://fidelity:dev@127.0.0.1:5432/fidelity',
    },
  },
})
