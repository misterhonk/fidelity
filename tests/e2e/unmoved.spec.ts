import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The dig nobody has to run (M32.4).
 *
 * The preflight already asks Discogs how many a shop has for sale, and the
 * shop's row has held the number from the last dig all along. So "still 2.881
 * for sale — the same number as at your last dig" costs no request at all, and
 * it is the only answer on that screen that saves the whole four minutes
 * rather than shortening them.
 *
 * Chromium only, like every spec that answers Discogs from a worker.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('says when a shop has not moved since the last dig', async ({ context, page }) => {
  await seed(page, 'en')

  // The seeded shop was last dug with 2.881 for sale; Discogs says the same.
  await context.route('https://api.discogs.com/users/plattenkiste', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ username: 'plattenkiste', num_for_sale: 2881 }),
    }),
  )

  await page.goto('/dig')
  await page.getByText('Another shop, or an earlier dig').click()
  await page.getByLabel('Shop — name or link').fill('plattenkiste')
  await page.getByRole('button', { name: 'Check' }).click()

  await expect(page.getByText(/the same number as at your last dig/)).toBeVisible({
    timeout: 15_000,
  })
  // A reason to skip, never a refusal to run.
  await expect(page.getByRole('button', { name: 'Fetch only what is new' })).toBeVisible()
})
