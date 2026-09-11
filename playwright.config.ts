import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3000)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /*
   * No retries locally, on purpose.
   *
   * A retry turns a failure into the word "flaky" and a green run. On WebKit
   * that is almost always the wrong reading: half the failures there are a race
   * between two navigations that Chromium wins, which is a missing wait and not
   * noise (CLAUDE.md). Locally the first answer is the honest one. CI retries
   * once so a genuinely unstable machine does not block a release — and marks
   * the test flaky rather than passing it silently.
   */
  retries: process.env.CI ? 1 : 0,

  /*
   * Every local run leaves a record, because one did not.
   *
   * On 2026-09-11 a run came back 309 of 310 and the next three came back
   * clean. Which test it was is unknowable now: `list` writes to the terminal
   * and nowhere else, and Playwright's own `.last-run.json` holds only the most
   * recent result — the reruns that proved it green also erased what had been
   * red. A flake nobody can name is a flake nobody can fix.
   *
   * `test-results/` is git-ignored, so this costs a file and nothing else.
   */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['json', { outputFile: 'test-results/report.json' }]],

  use: {
    baseURL,
    /*
     * A trace for anything that fails, not only for a retry.
     *
     * With `retries: 0` locally there is no first retry, so `on-first-retry`
     * meant no trace was ever kept here — the setting quietly did nothing on
     * the machine where somebody is actually looking.
     */
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The app is a PWA whose weakest target is iOS Safari. Testing only
    // Chromium means not testing the browser that matters.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    // The generated static output, served the way a docroot would serve it —
    // that is what actually ships.
    command: 'pnpm build && pnpm preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PORT: String(PORT) },
  },
})
