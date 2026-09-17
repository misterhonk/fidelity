import { expect, test } from '@playwright/test'

import { putRows, seed } from './seed'

/**
 * Postage as Discogs names it (M34.2): a basket line that carries the figure
 * Discogs gave for that one record, and the profile's postage plate that
 * leads with it.
 */
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

test('the basket and the shop say what Discogs named for one record', async ({ page }) => {
  await seed(page, 'en')
  const now = Date.now()
  await putRows(page, {
    dealers: [londonwax],
    basket: [
      {
        listingId: 4_156_697_547,
        dealer: 'londonwax',
        releaseId: 9_912_999,
        title: 'Larry Young – Unity',
        price: 5.87,
        currency: 'EUR',
        addedAt: now,
        note: null,
        soldAt: null,
        postage: {
          value: 14.11,
          currency: 'EUR',
          original: { value: 12, currency: 'GBP' },
          at: now,
        },
        shipsHere: true,
      },
    ],
  })

  await page.goto('/basket')
  const card = page
    .getByRole('region', { name: /London Wax/ })
    .or(page.locator('section, article').filter({ hasText: 'London Wax' }).first())
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await expect(card.first().getByText('(named by Discogs for this record)')).toBeVisible()
  await expect(card.first().getByText('€14.11', { exact: false }).first()).toBeVisible()

  await page.goto('/dealers?shop=londonwax')
  await expect(page.getByText('£12.00 (€14.11) for one record, says Discogs')).toBeVisible({
    timeout: 15_000,
  })
})
