import { defineConfig, devices } from '@playwright/test'

/**
 * The nightly smoke run against staging (docs/17 §4, M23).
 *
 * Nothing is built and nothing is served from here: `SMOKE_BASE_URL` is the
 * home lab's public name, and the specs under `tests/e2e/smoke/` ask it the
 * questions a person would — pages load, the hub answers, the catalogue
 * answers with a build, the shop identifies a barcode. Chromium only: the
 * shop spec routes the worker's Discogs requests, which WebKit cannot.
 *
 *   SMOKE_BASE_URL=https://fidelity.mrtnmlchr.de pnpm test:smoke
 */
const baseURL = process.env.SMOKE_BASE_URL
if (!baseURL) throw new Error('SMOKE_BASE_URL names the staging origin — nothing is built here')

export default defineConfig({
  testDir: './tests/e2e/smoke',
  fullyParallel: false,
  retries: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
