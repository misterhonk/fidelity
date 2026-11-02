import { expect, test } from './support/test'

import { putRows, readRows, seed, seedCollection } from './seed'

/**
 * The shelf as rows on a desk (#236): one record per line, edited in place,
 * narrowed by chips — and the whole view kept in the address, so a bookmark
 * is a saved view.
 */
test('edits rows in place, narrows by chips, and keeps the view in the address', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page, 'en')
  const first = seedCollection[0]!
  await putRows(page, {
    // A second copy of Speak No Evil: a double.
    collection: [{ ...first, instanceId: 811_002_777, addedAt: '2025-01-05T10:00:00-00:00' }],
    // The definitions, as the sync keeps them — so no request is needed for the options.
    meta: [
      {
        key: 'collectionFields',
        value: [
          {
            id: 1,
            name: 'Media Condition',
            type: 'dropdown',
            options: ['Mint (M)', 'Very Good Plus (VG+)', 'Very Good (VG)'],
          },
          {
            id: 2,
            name: 'Sleeve Condition',
            type: 'dropdown',
            options: ['Mint (M)', 'Very Good (VG)'],
          },
          { id: 3, name: 'Notes', type: 'text', options: [] },
        ],
      },
    ],
  })

  await page.goto('/collection')
  await page.getByRole('button', { name: 'Rows', exact: true }).click()
  await expect(page).toHaveURL(/[?&]as=rows/)

  const table = page.getByRole('table', { name: 'Your records, one per row' })
  await expect(table).toBeVisible({ timeout: 15_000 })
  for (const column of ['Record', 'Pressing', 'Rating', 'Media', 'Sleeve', 'Place', 'Folder'])
    await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(4)

  // The row of the older copy: one record per line, and its sync says it is in step.
  const row = table.getByRole('row').filter({ hasText: 'BST 84194' }).last()
  await expect(row.getByTestId('row-sync')).toHaveText('In step')

  const rating = row.getByRole('combobox', { name: /^Rating, Wayne Shorter/ })
  // Rated in the sheet: the row says so once the sheet closes.
  await row.getByRole('button').first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Rate 2 stars' }).click()
  await expect(sheet.getByRole('button', { name: 'Rate 2 stars' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(rating).toHaveValue('2')

  // Rated in place: written here at once, and queued for Discogs.
  await rating.selectOption('3')
  await expect
    .poll(async () =>
      (await readRows<{ instanceId: number; rating: number }>(page, 'collection')).some(
        (r) => r.rating === 3,
      ),
    )
    .toBe(true)

  // Graded in place, from Discogs' own options.
  await row
    .getByRole('combobox', { name: /^Media, Wayne Shorter/ })
    .selectOption('Very Good (VG)')
  await expect
    .poll(async () =>
      (await readRows<{ values: Record<string, string> }>(page, 'fieldValues')).some(
        (r) => r.values[1] === 'Very Good (VG)',
      ),
    )
    .toBe(true)

  // The copy without a Discogs entry offers nothing to change.
  const old = table.getByRole('row').filter({ hasText: 'Maiden Voyage' })
  await expect(old.getByRole('combobox')).toHaveCount(0)
  await expect(old.getByTestId('row-sync')).toHaveText('Only here')

  // Chips narrow, and combine.
  const chips = page.getByRole('group', { name: 'Show only' })
  await chips.getByRole('button', { name: 'Doubles' }).click()
  await expect(table.getByRole('row')).toHaveCount(3)
  await chips.getByRole('button', { name: 'Condition ≤ VG' }).click()
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(page).toHaveURL(/only=doubles%2Cworn|only=doubles,worn/)

  // The address is the saved view: a reload lands on the same rows.
  await page.reload()
  await expect(table).toBeVisible({ timeout: 15_000 })
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(chips.getByRole('button', { name: 'Doubles' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Back to the covers, keeping the chips.
  await page.getByRole('button', { name: 'Larger', exact: true }).click()
  await expect(table).toHaveCount(0)
  await expect(page.locator('main ul > li')).toHaveCount(1)
})
