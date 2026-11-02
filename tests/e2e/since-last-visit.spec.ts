import { expect, test } from './support/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * Since your last visit, on Start (#240).
 *
 * A watched shop whose total moved gets an "only what is new" dig when the app
 * opens, and the start page names what that dig found and why, rather than
 * only that the shop moved.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('a moved shop is dug for what is new and its finds show with a reason', async ({
  page,
  context,
}) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/plattenkiste') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ username: 'plattenkiste', num_for_sale: 2_882 }),
      })
    }

    if (url.pathname === '/users/plattenkiste/inventory') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          pagination: { page: 1, pages: 1, items: 1, per_page: 100 },
          listings: [
            {
              id: 70_001,
              status: 'For Sale',
              condition: 'Near Mint (NM or M-)',
              sleeve_condition: 'Near Mint (NM or M-)',
              price: { value: 18, currency: 'EUR' },
              // Newer than the seeded dig, so "only what is new" takes it.
              posted: '2099-01-01T00:00:00-07:00',
              ships_from: 'Germany',
              // The seeded wantlist's record, so the find is a sure one.
              release: {
                id: 3_299_477,
                title: 'Sound-Dust',
                artist: 'Stereolab',
                format: 'Vinyl, LP',
                label: 'Duophonic',
                catalog_number: 'DUHFCD25',
              },
            },
          ],
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  // Watched, with the count from last time one below what the shop has now.
  await putRows(page, {
    dealers: [{ ...seedDealer, watching: true, watchNumForSale: 2_881, watchCheckedAt: null }],
  })
  await page.goto('/')

  const banner = page.getByRole('status').filter({ hasText: 'Since your last visit' })
  await expect(banner).toBeVisible({ timeout: 15_000 })
  await expect(banner.getByText(/has 1 listing more/)).toBeVisible()

  // Only the new record, not the seeded finds of the earlier dig.
  const find = banner.getByRole('link', { name: 'Stereolab · Sound-Dust' })
  await expect(find).toBeVisible({ timeout: 30_000 })
  await expect(banner.getByText('Point of Departure')).toBeHidden()
  await expect(find.locator('xpath=following-sibling::span')).not.toBeEmpty()
})
