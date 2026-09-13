import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A shop can be watched before it has ever been dug (M30 #4).
 *
 * The watch asks `num_for_sale` off the profile — one lookup, no scan
 * (`worker/watch/check.ts`) — so it has always worked for a shop known only by
 * name. The screen implied otherwise: beside a "Watch this shop" button it
 * said "I only know this shop by name", which reads as a dead end.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('watches a shop that has never been dug', async ({ page, context }) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/spirax.records') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          username: 'spirax.records',
          num_for_sale: 1_204,
          location: 'Germany',
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dealers')
  await page.getByLabel('Add a shop').fill('spirax.records')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await expect(page.getByRole('button', { name: /spirax.records/ })).toBeVisible({
    timeout: 15_000,
  })

  // What it says about a shop it knows only by name — and what it can do anyway.
  await expect(page.getByText('Known by name so far')).toBeVisible()

  const watch = page.getByRole('button', { name: 'Watch this shop' })
  await expect(watch).toBeVisible()
  await watch.click()

  await expect(page.getByRole('button', { name: 'Being watched' })).toBeVisible({
    timeout: 15_000,
  })

  /*
   * And it sticks: this is a row in the database, not a screen state.
   *
   * The shop has to be picked again after the reload. Which shop is open is
   * not in the address — the page opens on the best one it has, and that is
   * Plattenkiste here, not the one entered a moment ago. The first version of
   * this test asserted straight through the reload and failed on a screen that
   * was showing a different shop.
   */
  await page.reload()
  await page.getByRole('button', { name: /spirax.records/ }).click()
  await expect(page.getByRole('button', { name: 'Being watched' })).toBeVisible({
    timeout: 15_000,
  })
})
