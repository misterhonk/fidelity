import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The wall (M27.1, docs/18).
 *
 * A room, a Kallax in it, a record in one of its compartments — and the
 * address of that record reading back the same on the wall and on the
 * record's own sheet. Walked in a browser because the wall is a grid with
 * roving focus and a picker, and because the sheet's select is where the
 * coordinate first appears.
 */
test('a room, a Kallax, and a record in B1', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/places')

  // A room first, then furniture in it.
  await page.getByLabel('Add a place').fill('Living room')
  await page.getByRole('button', { name: 'Add a place' }).click()
  const room = page.getByRole('region', { name: 'Living room' })
  await expect(room.getByRole('heading', { level: 2, name: 'Living room' })).toBeVisible()

  await room.getByRole('button', { name: 'Add furniture' }).first().click()
  await room.getByRole('button', { name: 'Kallax 2×2' }).click()
  await room.getByLabel('Name of the furniture').fill('Kallax')
  await room.getByRole('button', { name: 'Add furniture' }).last().click()

  // Four compartments, read like a spreadsheet.
  const wall = page.getByRole('grid', { name: 'Kallax' })
  await expect(wall.getByRole('gridcell')).toHaveCount(4)
  await expect(wall.getByRole('button', { name: /^A1, 0 records/ })).toBeVisible()
  await expect(wall.getByRole('button', { name: /^B2, 0 records/ })).toBeVisible()

  // A record goes into B1 from its own sheet, and the sheet reads the address back.
  await page.goto('/shelf')
  await page
    .getByRole('button', { name: /Maiden Voyage/ })
    .first()
    .click()
  const where = page.getByRole('dialog').getByLabel('Where it is')
  await where.selectOption({ label: '— — B1' })
  await expect(page.getByRole('dialog').getByText('Living room · Kallax · B1')).toBeVisible()
  await page.keyboard.press('Escape')

  // The wall counts it, and opening the compartment shows the sleeve.
  await page.goto('/places')
  await expect(page.getByText('1 placed', { exact: false })).toBeVisible()
  const cube = page
    .getByRole('grid', { name: 'Kallax' })
    .getByRole('button', { name: /^B1, 1 records/ })
  await expect(cube).toBeVisible()
  await cube.click()
  await expect(page.getByRole('heading', { level: 4, name: 'B1' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Maiden Voyage/ })).toBeVisible()

  // Arrow keys walk the wall.
  await page.getByRole('grid', { name: 'Kallax' }).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: /^B1, 1 records/ })).toBeFocused()
})
