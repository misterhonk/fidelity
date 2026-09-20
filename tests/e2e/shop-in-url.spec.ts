import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * Which shop is open belongs in the address (M30).
 *
 * Found by a test that asserted straight through a reload and failed against a
 * screen showing a different shop: the page opened whichever shop ranked
 * highest, not the one somebody was reading, and the screen could not be
 * linked to at all. The dig screen has carried its `?id=` since M3 for exactly
 * this reason.
 */
test('keeps the open shop across a reload, and in a link', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/dealers')

  // The seeded device knows one shop, so opening it is what the page does.
  await expect(page.getByRole('button', { name: /Plattenkiste/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page).toHaveURL(/shop=plattenkiste/)

  // And the address is enough on its own: no click, no memory.
  await page.goto('/dealers?shop=plattenkiste')
  await expect(page.getByText('2,881 listings', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
  // The row says what one record costs to post from here (M34.3), off the seed's table.
  await expect(page.getByText('from €4.50 postage, up to 3 records')).toBeVisible()

  // A name nobody knows falls back rather than showing an empty profile.
  await page.goto('/dealers?shop=nobody-of-that-name')
  await expect(page).toHaveURL(/shop=plattenkiste/)
})
