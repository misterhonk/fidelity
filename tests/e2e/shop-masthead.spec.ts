import { expect, test } from '@playwright/test'

import { putRows, seed } from './seed'

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

/**
 * The masthead (M34.1): count before percentage, the year off the profile.
 *
 * The first open of a shop from before starts one `/users/{u}` request in
 * the background and the row learns the year, the rating and its count from
 * it; the next open shows them. So this opens, reloads, and reads.
 */
test('says the count before the percentage, and learns the year from the profile', async ({
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
        body: JSON.stringify({
          username: 'plattenkiste',
          num_for_sale: 2_881,
          seller_rating: 99.6,
          seller_num_ratings: 1_234,
          registered: '2009-03-02T10:00:00-07:00',
          marketplace_suspended: false,
        }),
      })
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dealers')
  const line = page.locator('[data-prose="data"]').first()
  await expect(line).toContainText('2,881 listings', { timeout: 15_000 })

  await expect
    .poll(
      async () => {
        await page.reload()
        await expect(line).toBeVisible({ timeout: 15_000 })
        return (await line.textContent()) ?? ''
      },
      { timeout: 30_000, intervals: [1_500, 2_000, 3_000] },
    )
    .toContain('since 2009')

  await expect(line).toContainText('1,234 ratings · 99.6 %')
  const text = (await line.textContent()) ?? ''
  expect(text.indexOf('ratings')).toBeLessThan(text.indexOf('%'))
  expect(text.indexOf('ratings')).toBeLessThan(text.indexOf('listings'))
})

const londonwax = {
  username: 'londonwax',
  displayName: 'London Wax',
  shipsFrom: 'United Kingdom',
  sellerRating: 100,
  ratingCount: 10,
  numForSale: 500,
  minOrderTotal: 0,
  shippingNote: '',
  lastScannedAt: null,
  newestListedAt: null,
  affinity: null,
  fingerprint: null,
  shippingTiers: [],
  registeredAt: null,
}

/** j and k walk the list on a desk; on a phone the sheet has the neighbours. */
test('walks from shop to shop with j and k, and with the arrows in the sheet', async ({
  page,
}) => {
  await seed(page, 'en')
  await putRows(page, { dealers: [londonwax] })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/dealers')
  await expect(page).toHaveURL(/shop=plattenkiste/, { timeout: 15_000 })

  await page.keyboard.press('j')
  await expect(page).toHaveURL(/shop=londonwax/)
  await expect(page.getByRole('heading', { name: 'London Wax' })).toBeVisible()
  await page.keyboard.press('k')
  await expect(page).toHaveURL(/shop=plattenkiste/)

  // Not in a field: a name typed into the search box must stay a name.
  await page.getByRole('button', { name: 'Put this shop away' }).focus()
  await page.getByLabel('Add a shop').fill('jjk')
  await expect(page).toHaveURL(/shop=plattenkiste/)

  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/dealers?shop=plattenkiste')
  const sheet = page.getByRole('dialog', { name: /plattenkiste/i })
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByText('1 of 2')).toBeVisible()
  await sheet.getByRole('button', { name: 'Next shop' }).click()
  await expect(page).toHaveURL(/shop=londonwax/)
  await expect(
    page.getByRole('dialog', { name: /London Wax/ }).getByText('2 of 2'),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Next shop' }),
  ).toBeDisabled()
})
