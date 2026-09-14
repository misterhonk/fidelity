import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The round: every watched shop, asked what is new since the last visit (M29).
 *
 * Asked for as a question against 0.70.1: "so I can build a kind of
 * favourite-shop list and scan it weekly for new items?" Almost — the shops
 * were remembered and could be watched, but watching only says *that*
 * something moved, and finding out what meant tapping each shop by hand.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('watches a shop, walks the round, and says what it found', async ({ page, context }) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/plattenkiste/inventory') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          pagination: { page: 1, pages: 1, items: 2, per_page: 100 },
          listings: [
            {
              id: 70_001,
              status: 'For Sale',
              condition: 'Near Mint (NM or M-)',
              sleeve_condition: 'Near Mint (NM or M-)',
              price: { value: 18, currency: 'EUR' },
              // Newer than the seeded scan, so "only what is new" takes it.
              posted: '2099-01-01T00:00:00-07:00',
              ships_from: 'Germany',
              release: {
                id: 70_001,
                title: 'Speak No Evil',
                artist: 'Wayne Shorter',
                format: 'Vinyl, LP',
                label: 'Blue Note',
              },
            },
          ],
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dealers')

  // Nothing to walk yet: no shop is watched, so there is no round.
  await expect(page.getByRole('heading', { name: 'The round' })).toBeHidden()

  await page.getByRole('button', { name: 'Plattenkiste' }).click()
  await page.getByRole('button', { name: 'Watch this shop' }).click()

  /*
   * And it appears without a reload. Until the toggle re-read the plan it did
   * not: somebody watched their first shop, nothing happened on screen, and
   * the feature was invisible until they navigated away and back.
   */
  const round = page.getByRole('heading', { name: 'The round' })
  await expect(round).toBeVisible({ timeout: 15_000 })
  /*
   * The price is still stated before the button is pressed — it moved behind
   * "Why?" when the round came back above the list (M31.8). One click, and it
   * is the same sentence: a screen that spends somebody's rate limit says what
   * it costs, it just no longer says it in a paragraph nobody reads twice.
   */
  const why = page.getByText('Why?', { exact: true })
  await expect(why).toBeVisible()
  await why.click()
  await expect(page.getByText(/Visits your one watched shop/)).toBeVisible()

  await page.getByRole('button', { name: 'Walk the round' }).click()

  // One shop, one new listing, and the record is by somebody on the shelf.
  await expect(page.getByText(/Last round/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/among 1 new/)).toBeVisible()
})
