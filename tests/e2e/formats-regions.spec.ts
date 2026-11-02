import { expect, test } from './support/test'

import { putRows, readRows, seed } from './seed'

/**
 * Formats by size, catalogue numbers, regions (#246).
 *
 * Three small filters a collector reaches for: 7" or LP in a shop's finds,
 * the number on the spine on the shelf, and the UK, North America and Japan
 * beside home and Europe on the shops.
 */

test('narrows the finds to one size', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })

  // The seed's two finds sit on the wall; six more make a list below it, alternating sizes.
  const [first] = await readRows(page, 'matches')
  await putRows(page, {
    matches: Array.from({ length: 6 }, (_, i) => ({
      ...first,
      digId: dig.id,
      listingId: 900_000 + i,
      releaseId: 910_000 + i,
      artist: `Probe ${i}`,
      title: `Record ${i}`,
      format: i % 2 ? '7", Single' : 'LP, Album',
      score: 40 - i,
    })),
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: '8 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  const sizes = page.getByRole('group', { name: 'Size' })
  await sizes.getByRole('button', { name: /^7"/ }).click()
  await expect(page).toHaveURL(/[?&]size=7/)
  await expect(page.getByText('2 of 4 finds')).toBeVisible()
  await expect(sizes.getByRole('button', { name: /^7"/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Reset the filters' }).click()
  await expect(page).not.toHaveURL(/size=/)
})

test('sorts and finds the shelf by catalogue number', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/collection?as=rows')
  const table = page.getByRole('table', { name: 'Your records, one per row' })
  await expect(table).toBeVisible({ timeout: 15_000 })

  await page
    .getByRole('navigation', { name: 'Sorting' })
    .getByRole('button', { name: 'Cat. no.' })
    .click()
  await expect(page).toHaveURL(/[?&]sort=catno/)
  const rows = table.getByRole('row').filter({ hasText: /BST 8419/ })
  await expect(rows.first()).toContainText('BST 84194')
  await expect(rows.last()).toContainText('BST 84195')

  await page.getByRole('searchbox', { name: 'Search the shelf' }).fill('bst84195')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Maiden Voyage')
})

test('keeps only the shops in the UK when asked', async ({ page }) => {
  await seed(page, 'en')
  const [shop] = await readRows<Record<string, unknown>>(page, 'dealers')
  await putRows(page, {
    dealers: [
      {
        ...shop,
        username: 'londonwax',
        displayName: 'London Wax',
        shipsFrom: 'United Kingdom',
      },
    ],
  })
  await page.goto('/shops')

  const shops = page.getByRole('list', { name: 'Your shops' })
  await expect(shops.getByRole('button', { name: /London Wax/ })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /^From the UK/ }).click()
  await expect(page).toHaveURL(/from=uk/)
  await expect(shops.getByRole('button', { name: /London Wax/ })).toBeVisible()
  await expect(shops.getByRole('button', { name: /Plattenkiste/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^From Japan/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^From North America/ })).toBeVisible()
})
