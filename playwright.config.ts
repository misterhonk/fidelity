import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3000)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // The smoke suite asks a live staging origin, not the built preview; it has
  // its own config (`playwright.smoke.config.ts`) and its own workflow.
  testIgnore: ['**/smoke/**'],
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
   * Four workers on a four-core runner, deliberately oversubscribed.
   *
   * Playwright's default is half the cores, which on GitHub's standard runner
   * is two — and measured on 2026-09-14 those two were busy 97 % of the span,
   * which sounds like a saturated machine and is not one: most of what a
   * browser test does is wait for a page to boot, for a transition to end, for
   * a locator to appear. The CPU is idle through all of it. Two more workers
   * fill those gaps with somebody else's work.
   *
   * Locally it stays at the default. A laptop is doing other things.
   */
  workers: process.env.CI ? 4 : undefined,

  /*
   * And a longer rope per test on CI, because of the line above.
   *
   * Four workers on four cores is deliberately oversubscribed, and the price
   * is that each individual test takes longer even though the suite as a whole
   * is faster: the average went from 2,1 s to 5,1 s while the throughput went
   * from two tests at a time to three and a quarter. `places.spec.ts` is a
   * thirteen-second test in WebKit, and thirteen times that factor walks into
   * a thirty-second limit — which it did, on 2026-09-14.
   *
   * The limit is a stop for a hang, not a measurement of speed. A minute is
   * still a minute for anything genuinely stuck, and locally it stays at
   * thirty seconds, where a slow test means something.
   */
  timeout: process.env.CI ? 60_000 : 30_000,

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
