import { expect, test } from '@playwright/test'

import { seed } from '../seed'

/**
 * What a person would check on staging every morning (docs/17 §4). Each
 * test is one question and one answer; a red one is a page or a service
 * that is not there, not a nuance.
 */
/** The staging origin comes in as Playwright's `baseURL` (see the smoke config). */
const at = (baseURL: string | undefined, path: string) =>
  `${baseURL!.replace(/\/+$/, '')}${path}`

test('the app loads and names itself', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Fidelity/)
})

test('the hub answers, and says which doors it has', async ({ request, baseURL }) => {
  const response = await request.get(at(baseURL, '/hub/v1/health'))
  expect(response.status()).toBe(200)
  const health = (await response.json()) as { ok: boolean; doors: string[] }
  expect(health.ok).toBe(true)
  expect(Array.isArray(health.doors)).toBe(true)
})

test('the catalogue answers with a build that is not stale', async ({ request, baseURL }) => {
  const response = await request.get(at(baseURL, '/catalogue/v1/catalogue/health'))
  expect(response.status()).toBe(200)
  const health = (await response.json()) as { ok: boolean; build: string; stale?: boolean }
  expect(health.ok).toBe(true)
  expect(health.build).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(health.stale ?? false).toBe(false)
})

test('the catalogue knows a pressing family', async ({ request, baseURL }) => {
  // Release 1 of the dump, "Stockholm", master 1660109 — the first row of every build.
  const response = await request.get(
    at(baseURL, '/catalogue/v1/catalogue/master/1660109/family'),
  )
  expect(response.status()).toBe(200)
  const family = (await response.json()) as { masterId: number; siblings: unknown[] }
  expect(family.masterId).toBe(1660109)
  expect(family.siblings.length).toBeGreaterThan(0)
})

test('the settings pages are there, signed in', async ({ page }) => {
  await seed(page, 'en')
  for (const [path, title] of [['/settings/hub', 'Hub']] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  }
})

test('the shop screen identifies a barcode with Discogs answered from here', async ({
  page,
  context,
}) => {
  await context.route('https://api.discogs.com/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const cors = { 'access-control-allow-origin': '*' }
    if (path === '/database/search') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          results: [
            {
              id: 1,
              title: 'The Persuader - Stockholm',
              year: 1999,
              country: 'Sweden',
              format: ['Vinyl', '12"'],
              label: ['Svek'],
              catno: 'SK032',
              master_id: 1660109,
            },
          ],
        }),
      })
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })
  await seed(page, 'en')
  await page.goto('/in-store')
  await page.getByLabel('Barcode or run-out number').fill('724384561423')
  await page.getByRole('button', { name: 'Look it up' }).click()
  // The candidate's label line: the title itself is the cover's caption, not text.
  await expect(page.getByText('SK032', { exact: false })).toBeVisible({ timeout: 20_000 })
})

/**
 * The demo account, synced for real (docs/19-DEMO-ACCOUNT.md).
 *
 * The only test in the project that talks to Discogs with a token: the
 * second account's, from the secret, on a fresh device against the live
 * origin. Sixty records in, the shelf has to show them. Without the secret
 * the test skips — it is a check on the world, not on the code, and the
 * code is checked elsewhere without a request.
 */
test('the demo account syncs onto a fresh device', async ({ page }) => {
  // Read off the global: the app's tsconfig knows no `process`, and a type for it is not worth a dependency.
  const token = (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process?.env.DISCOGS_DEMO_TOKEN
  test.skip(!token, 'DISCOGS_DEMO_TOKEN is not set')

  await page.goto('/')
  await expect(page).toHaveURL(/welcome/)
  await page.getByRole('button', { name: 'Set it up — with your collection' }).click()
  await page.getByLabel('Personal access token').fill(token!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/Signed in as/)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Fetch the collection' }).click()
  // Sixty records at one request a second: the sync takes a while.
  await page.getByRole('button', { name: 'Carry on' }).click({ timeout: 180_000 })

  await page.goto('/shelf')
  await expect(page.locator('li[id^="record-"], main ul li').first()).toBeVisible({
    timeout: 30_000,
  })
  const shown = await page.locator('main ul li').count()
  expect(shown).toBeGreaterThanOrEqual(40)
})
