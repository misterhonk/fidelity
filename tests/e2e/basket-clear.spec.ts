import { expect, test } from '@playwright/test'

import { putRows, seed } from './seed'

/**
 * Emptying every basket takes two taps (2026-10-21). There is no undo, so the
 * first tap only asks; a regression back to one tap would pass every other test.
 */
test('empties all baskets only on the second tap', async ({ page }) => {
  await seed(page, 'en')
  // A second shop, because the button only shows with more than one basket.
  await putRows(page, {
    basket: [
      {
        listingId: 3_300_000_001,
        dealer: 'zweitplatten',
        releaseId: 9_913_000,
        title: 'Grant Green — Idle Moments',
        price: 28,
        currency: 'EUR',
        addedAt: Date.now(),
        note: null,
      },
    ],
  })
  await page.goto('/basket')

  await page.getByRole('button', { name: 'Empty all of them' }).click()
  await expect(page.getByRole('button', { name: 'Tap again to empty all' })).toBeVisible()
  await expect(page.getByText('Nothing in the basket yet')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap again to empty all' }).click()
  await expect(page.getByText('Nothing in the basket yet')).toBeVisible()
})
