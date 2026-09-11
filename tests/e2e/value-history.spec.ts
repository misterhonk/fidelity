import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The estimate over time, on the map (docs/06 M19 #3).
 *
 * The seed carries three days. The chart is an SVG with an accessible name
 * that says where the line starts and where it ends — that name is what a
 * screen reader gets and what this test reads, because the picture itself
 * cannot be asserted on.
 */
test('the map draws the estimate day by day', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/map')

  await expect(page.getByRole('heading', { name: 'Over time' })).toBeVisible({
    timeout: 15_000,
  })
  const chart = page.getByRole('img', { name: /Middle estimate from €600\.00 .* to €610\.00/ })
  await expect(chart).toBeVisible()
  await expect(page.getByText('€610.00 today')).toBeVisible()
})
