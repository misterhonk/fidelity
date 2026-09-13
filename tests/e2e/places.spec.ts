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
  const sheet = page.getByRole('dialog', { name: 'Living room · Kallax · B1' })
  await expect(sheet.getByRole('heading', { level: 2, name: 'B1' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Maiden Voyage/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Arrow keys walk the wall.
  await page.getByRole('grid', { name: 'Kallax' }).getByRole('button').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: /^B1, 1 records/ })).toBeFocused()

  // And the rest of the pile goes in from the wall: "not placed yet" lists
  // the other record, a tick and one button put it here.
  await cube.click()
  const again = page.getByRole('dialog', { name: 'Living room · Kallax · B1' })
  await again.getByRole('button', { name: 'Fill' }).click()
  await expect(again.getByRole('checkbox', { name: /Speak No Evil/ })).toBeVisible()
  await expect(again.getByRole('checkbox', { name: /Maiden Voyage/ })).toBeHidden()
  await again.getByRole('checkbox', { name: /Speak No Evil/ }).check()
  await again.getByRole('button', { name: 'Put 1 in B1' }).click()
  await expect(again.getByText('Everything has a place.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^B1, 2 records/ })).toBeVisible()
  await expect(page.getByText('2 placed', { exact: false })).toBeVisible()

  // The rule proposes, "apply" deals: two records by artist across four
  // compartments — Hancock to A1, Shorter stays in B1 — and the dividers
  // are written on the wall.
  await page.getByRole('button', { name: 'Sort in' }).click()
  await expect(page.getByText('1 would move · 0 from the pile')).toBeVisible()
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(
    page.getByRole('button', { name: /^A1 · H, 1 records|^A1, 1 records/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('grid', { name: 'Kallax' }).getByText('H', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('grid', { name: 'Kallax' }).getByText('W', { exact: true }),
  ).toBeVisible()

  // Re-sorting: select in the compartment, pick a compartment on the small
  // wall, and a line with a way back.
  await page.getByRole('button', { name: /^B1, 1 records/ }).click()
  const b1 = page.getByRole('dialog', { name: 'Living room · Kallax · B1' })
  await b1.getByRole('button', { name: 'Select' }).click()
  await b1.getByRole('checkbox', { name: /Speak No Evil/ }).check()
  await b1.getByRole('button', { name: 'Move 1 to …' }).click()
  await b1.getByRole('group', { name: 'Kallax' }).getByRole('button', { name: 'A2' }).click()
  await expect(b1.getByText('1 moved to A2')).toBeVisible()
  await b1.getByRole('button', { name: 'Undo' }).click()
  await expect(b1.getByRole('button', { name: /Speak No Evil/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(b1).toBeHidden()

  // Drag: the whole compartment B1 onto A2 with the mouse, and the way back.
  // Both cubes have to be on screen: a pointer cannot drop below the fold.
  await page.setViewportSize({ width: 1280, height: 1400 })
  await page.getByRole('grid', { name: 'Kallax' }).scrollIntoViewIfNeeded()
  const from = await page.getByRole('button', { name: /^B1, 1 records/ }).boundingBox()
  const onto = await page.getByRole('button', { name: /^A2, 0 records/ }).boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 4 })
  await page.mouse.move(onto!.x + onto!.width / 2, onto!.y + onto!.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByText('1 moved to A2')).toBeVisible()
  await expect(page.getByRole('button', { name: /^A2, 1 records/ })).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: /^B1, 1 records/ })).toBeVisible()

  // Keyboard: a letter jumps to the compartment whose divider covers it; M
  // opens the sheet on "move all".
  await page.getByRole('button', { name: /^A1/ }).focus()
  await page.keyboard.press('w')
  await expect(page.getByRole('button', { name: /^B1, 1 records/ })).toBeFocused()
  await page.keyboard.press('m')
  const moving = page.getByRole('dialog', { name: 'Living room · Kallax · B1' })
  await expect(moving.getByLabel('Everything goes to')).toBeVisible()
  await page.keyboard.press('Escape')

  // From the shelf: tick a record, put it in B2 on the small wall, and undo.
  await page.goto('/shelf')
  await page.getByRole('button', { name: 'Select' }).click()
  await page.getByRole('checkbox', { name: /Maiden Voyage/ }).check()
  await page.getByRole('button', { name: 'Put 1 in …' }).click()
  await page.getByRole('group', { name: 'Kallax' }).getByRole('button', { name: 'B2' }).click()
  await expect(page.getByText('1 now in B2')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.goto('/places')
  await expect(page.getByRole('button', { name: /^A1( · H)?, 1 records/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^B2, 0 records/ })).toBeVisible()
})
