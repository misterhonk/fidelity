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
  for (const [path, title] of [
    ['/settings/hub', 'Hub'],
    ['/settings/access', 'Access'],
    ['/settings/support', 'Support'],
  ] as const) {
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
