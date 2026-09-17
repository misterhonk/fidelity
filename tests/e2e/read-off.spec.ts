import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The read-off field (M34.3): the postage figure Discogs' own cart shows for
 * exactly this basket, typed in once, kept as the tier for this count.
 */
test('takes the figure off the Discogs cart for exactly this basket', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/basket')

  const field = page.getByLabel('What Discogs shows for 2 records')
  await expect(field).toBeVisible({ timeout: 15_000 })
  await field.fill('7.5')
  await page.getByRole('button', { name: 'Take it' }).click()

  const card = page.locator('section, article').filter({ hasText: 'Plattenkiste' }).first()
  await expect(card.getByText('€7.50')).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('(entered by you)')).toBeVisible()
})
