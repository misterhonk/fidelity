import { expect, test } from '@playwright/test'

import { putRows, seed } from './seed'

/**
 * The postage of your own order (ADR-017): read the order by its number, and
 * what the parcel cost to post becomes the shop's tier for that many
 * records. The import says so in one sentence.
 */
const ORDER = {
  id: '259022-32308',
  created: '2026-09-11T00:33:31-07:00',
  seller: { username: 'plattenkiste', email: 'shop@example.invalid' },
  total: { value: 48.97, currency: 'EUR' },
  shipping: { value: 6.5, currency: 'EUR' },
  items: [
    {
      id: 4240795662,
      price: { value: 14.99, currency: 'EUR' },
      release: { id: 201068, title: 'Something For Your Mind', artist: 'W.B.*' },
    },
    {
      id: 4240795728,
      price: { value: 16.99, currency: 'EUR' },
      release: { id: 259733, title: 'Somewhere Over The Slippybergün', artist: 'W.B.*' },
    },
  ],
}

test('keeps what the order paid for postage, for the shop', async ({ page, context }) => {
  await seed(page, 'en')
  // The saved screen only shows the import once something is marked.
  await putRows(page, {
    feedback: [
      {
        listingId: 3_204_119_887,
        releaseId: 9_912_999,
        signals: [],
        score: 80,
        title: 'Unity',
        artist: 'Larry Young',
        dealer: 'plattenkiste',
        verdict: 'interesting',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  })

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/marketplace/orders/259022-32308') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(ORDER),
      })
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/saved')
  const field = page.getByLabel('Discogs order number')
  await expect(field).toBeVisible({ timeout: 15_000 })
  await field.fill('259022-32308')
  await page.getByRole('button', { name: 'Read the order' }).click()

  await expect(
    page.getByText('Postage was €6.50 for 2 records, noted for the shop.'),
  ).toBeVisible({ timeout: 15_000 })

  // And the basket adds up with it, labelled as off the order.
  await page.goto('/basket')
  const card = page.locator('section, article').filter({ hasText: 'Plattenkiste' }).first()
  await expect(card.getByText('€6.50')).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('(from your order)')).toBeVisible()
})
