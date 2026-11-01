import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * The basket as a receipt (#224): per shop the lines, the total and one
 * filled button. The tools that work on a basket — postage table, budget,
 * other shops, paste — are folded away until asked for.
 */
test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('shows the primary action without scrolling', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/basket')

    const total = page.getByText('€60.00')
    await expect(total).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Put these in at Discogs' })).toBeInViewport({
      ratio: 1,
    })
  })
})

test('folds the tools away until asked for', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/basket')

  const compare = page.getByRole('button', { name: 'Cheaper at another shop?' })
  const paste = page.getByLabel('Links to records, or the cart page')
  await expect(page.getByRole('button', { name: 'Put these in at Discogs' })).toBeVisible()
  await expect(compare).toBeHidden()
  await expect(paste).toBeHidden()

  await page.getByText('Tools: postage table, budget, other shops').click()
  await expect(compare).toBeVisible()
  await expect(page.getByText('What would fit a budget?', { exact: false })).toBeVisible()

  await page.getByText('Tools: paste from Discogs').click()
  await expect(paste).toBeVisible()
})

test('keeps the sum in view beside the lines on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await seed(page, 'en')
  await page.goto('/basket')

  const button = page.getByRole('button', { name: 'Put these in at Discogs' })
  await expect(button).toBeVisible()
  const column = button.locator('xpath=ancestor::div[contains(@class, "sticky")][1]')
  await expect(column).toHaveCSS('position', 'sticky')
})
