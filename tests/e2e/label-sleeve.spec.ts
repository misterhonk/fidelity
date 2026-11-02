import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * A find without a cover wears its label (#220).
 *
 * Inventory rows carry no picture (docs/02), so this is the normal case on the
 * dig screen, not an edge: both seeded finds have none. The sleeve shows the
 * label and its number, and the same label is the same colour on every card.
 */
test('finds without a cover show a sleeve in their label colour', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })

  const departure = page
    .locator('article', { hasText: 'Point of Departure' })
    .first()
    .getByTestId('label-sleeve')
  const unity = page
    .locator('article', { hasText: 'Unity' })
    .first()
    .getByTestId('label-sleeve')
  await expect(departure).toContainText('Blue Note')
  await expect(departure).toContainText('BST 84167')
  await expect(unity).toContainText('BST 84221')

  const paper = (sleeve: typeof departure) =>
    sleeve
      .locator('div')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await paper(departure)).toBe(await paper(unity))

  const broken = await page.evaluate(
    () => [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length,
  )
  expect(broken).toBe(0)
})

/**
 * And a cover that fails to load is a sleeve too, on every screen that shows
 * one, not the browser's broken-image glyph (#220). The seeded wantlist entry
 * has a cover URL; here i.discogs.com refuses it, as a Cloudflare 429 would.
 */
test('a cover that fails to load falls back to the sleeve', async ({ page, context }) => {
  await context.route('https://i.discogs.com/**', (route) => route.abort())
  await seed(page, 'en')
  await page.goto('/wantlist')
  await expect(page.getByText('Sound-Dust')).toBeVisible()

  await expect(page.getByTestId('label-sleeve').first()).toBeVisible()
  const broken = await page.evaluate(
    () => [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length,
  )
  expect(broken).toBe(0)
})
