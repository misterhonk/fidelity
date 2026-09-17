import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A scan outlives the page that started it, and a page opened afterwards
 * attaches to it (2026-09-12): the shop's name over the bar, the buttons
 * waiting, the result when it is through. Discogs is answered from here,
 * slowly — chromium only, as every spec that routes a worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('names the shop being scanned when the page is opened mid-scan', async ({
  page,
  context,
}) => {
  const listings = (page: number) =>
    Array.from({ length: 100 }, (_, i) => ({
      id: page * 1000 + i,
      status: 'For Sale',
      condition: 'Near Mint (NM or M-)',
      sleeve_condition: 'Near Mint (NM or M-)',
      price: { value: 12, currency: 'EUR' },
      posted: '2026-09-01T00:00:00-07:00',
      ships_from: 'Germany',
      release: { id: page * 1000 + i, title: `Record ${i}`, artist: 'Unknown', format: '12"' },
      seller: { username: 'slowshop' },
    }))
  // After the seed: its default answer for Discogs is a 401, and later routes win.
  await seed(page, 'en')
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())
    const cors = { 'access-control-allow-origin': '*' }
    if (url.pathname === '/users/slowshop') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ username: 'slowshop', num_for_sale: 300, location: 'Berlin' }),
      })
    }
    if (url.pathname === '/users/slowshop/inventory') {
      const pageNo = Number(url.searchParams.get('page') ?? '1')
      // Slow enough to leave the page and come back while it is still going.
      await new Promise((done) => setTimeout(done, 2000))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          pagination: { page: pageNo, pages: 3, items: 300, per_page: 100 },
          listings: listings(pageNo),
        }),
      })
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dig')
  // The seed leaves a result on this screen, and a screen with a result folds
  // the field away (M31.13).
  await page.getByText('Another shop, or an earlier dig').click()
  await page.getByLabel('Shop name or link').fill('slowshop')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Start the dig' }).click()
  await expect(page.getByText('Digging through slowshop')).toBeVisible({ timeout: 15_000 })

  // Away, and back — through the app's own navigation, the way a person
  // leaves a page. A full reload would take the worker with it, and that
  // is the "interrupted" case, which is a different screen.
  await page.getByRole('link', { name: 'Collection', exact: true }).click()
  await expect(page).toHaveURL(/shelf/)
  await page.getByRole('link', { name: 'Dig', exact: true }).click()
  await expect(page).toHaveURL(/dig/)
  await expect(page.getByText('Digging through slowshop')).toBeVisible({ timeout: 15_000 })
  await page.getByText('Another shop, or an earlier dig').click()
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()

  /*
   * And no result list for the dig that is still running.
   *
   * Reported on 2026-09-13 as one screenshot: "0 Treffer bei Vinylvoorelkaar ·
   * 0 von 5.551 gescannt (0 %)" and the acquittal "nothing here for you at
   * this shop" — directly under a bar reading "443 von 5.551 · 45 Treffer".
   * The running dig is the newest row in the database, so `dig.latest` handed
   * it over at whatever it happened to say, which at the start is noughts.
   */
  await expect(page.getByText('0 finds at slowshop')).toBeHidden()
  await expect(page.getByText(/That is a result, not a fault/)).toBeHidden()

  // And when it is through, the result is here as if this page had started it.
  await expect(page.getByText('Digging through slowshop')).toBeHidden({ timeout: 60_000 })
  await expect(page.getByText(/finds/)).toBeVisible({ timeout: 15_000 })
})
