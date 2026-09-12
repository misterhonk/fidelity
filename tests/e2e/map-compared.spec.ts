import { expect, test } from '@playwright/test'

import { DB_NAME } from '~~/db/schema'

import { seed } from './seed'

/**
 * The map against the catalogue (M21.6): with a catalogue configured, every
 * bar the catalogue can put a denominator under gets its lift, and one
 * sentence under the bars says what the × means and which build it is
 * measured against. The catalogue is answered from here — chromium only,
 * as every spec that routes a worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('puts the catalogue’s lift on the bars and says which build it is', async ({
  page,
  context,
}) => {
  const decades = Array.from({ length: 14 }, (_, i) => [String(1900 + i * 10), 1000])
  await context.route('https://catalogue.test/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const cors = { 'access-control-allow-origin': '*' }
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(body),
      })
    if (path === '/v1/catalogue/health')
      return json({ ok: true, build: '2026-09-01', releases: 14000 })
    if (path === '/v1/catalogue/stats/decades')
      return json({ build: '2026-09-01', total: 14000, rows: decades })
    if (path === '/v1/catalogue/stats/styles' || path === '/v1/catalogue/stats/genres')
      return json({ build: '2026-09-01', total: 14000, rows: [] })
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await seed(page, 'en')
  await page.goto('/settings/hub')
  await expect(
    page
      .getByText(/Found one|None running on this machine|Not reachable|Cannot search/)
      .first(),
  ).toBeVisible({ timeout: 15_000 })
  const panel = page.locator('section').filter({ has: page.getByLabel('Catalogue URL') })
  await panel.getByLabel('Catalogue URL').fill('https://catalogue.test')
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('built 2026-09-01', { exact: false })).toBeVisible({
    timeout: 15_000,
  })

  // The seed carries no taste profile — the sync computes it — so one is
  // written by hand: two decades, one style, the shape the worker writes.
  await page.evaluate(
    ([name, profile]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name as string)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('meta', 'readwrite')
          tx.objectStore('meta').put({ key: 'tasteProfile', value: profile })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    [
      DB_NAME,
      {
        computedAt: Date.now(),
        releaseCount: 4,
        artists: {},
        labels: {},
        styles: { Techno: { name: 'Techno', n: 2, weight: 0.5, lift: null } },
        genres: {},
        decades: {
          1960: { name: '1960er', n: 3, weight: 0.75, lift: null },
          1990: { name: '1990er', n: 1, weight: 0.25, lift: null },
        },
        styleCentroid: {},
      },
    ] as const,
  )

  await page.goto('/map')
  await expect(
    page.getByText('as of the catalogue of 2026-09-01', { exact: false }),
  ).toBeVisible({
    timeout: 15_000,
  })
  // Every decade on the shelf has a denominator now, so at least one × stands.
  await expect(page.getByText(/\d×/).first()).toBeVisible()
})
