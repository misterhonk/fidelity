import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A shop entered by hand, and why each shop is on the list (M30).
 *
 * "I want to enter dealers myself, so they are there for future digs" — and,
 * about nine shops in a Discogs friends list of which one showed up here:
 * "why don't my befriended shops appear?" A row without a reason is a row
 * nobody trusts.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('takes a shop by name and stands it beside the dug ones', async ({ page, context }) => {
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
          seller_rating: 99.1,
          seller_num_ratings: 812,
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dealers')

  /*
   * Pasted as an address, not typed as a username: nobody carries a Discogs
   * username around, and the same parser the dig field uses reads both.
   */
  await page
    .getByLabel('Add a shop')
    .fill('https://www.discogs.com/de/seller/spirax.records/profile')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  // It stands with the dug shop, and says how it got there.
  await expect(page.getByRole('button', { name: /spirax.records/ })).toBeVisible({
    timeout: 15_000,
  })
  // Exact, because the sentence above the form contains the same phrase.
  await expect(page.getByText('entered by hand', { exact: true })).toBeVisible()

  /*
   * And the same list is what the dig screen offers — one line away.
   *
   * With a result already on the screen the dig page folds the question into
   * a single disclosure (M31.13): the field, the shops you know and the digs
   * you have run. The seed leaves a result there, so this is that screen.
   */
  await page.getByRole('link', { name: 'Dig', exact: true }).click()
  await expect(page).toHaveURL(/dig/)
  await page.getByText('Another shop, or an earlier dig').click()
  await expect(page.getByRole('button', { name: /spirax.records/ })).toBeVisible({
    timeout: 15_000,
  })
})
