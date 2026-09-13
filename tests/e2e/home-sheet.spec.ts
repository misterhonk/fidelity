import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A find on the start page opens its sheet.
 *
 * Reported: on "Last found", clicking a record did nothing, while a record on
 * "New on the shelf" opened its detail. Both rails are `CoverTile`s and both
 * pass an `open` handler, so the tile was never the difference.
 */
test('opens the detail of a find from the start page', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Found last time' })).toBeVisible({
    timeout: 15_000,
  })

  // The first tile of the finds rail, by the name the seed gives it.
  await page
    .getByRole('button', { name: /Open .*Speak No Evil/i })
    .first()
    .click()

  // The sheet itself, by the role it declares — not by a word that also
  // appears in the folded "why these?" list further down the page.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('dialog')).toContainText('Speak No Evil')
})
