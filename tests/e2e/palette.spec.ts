import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from './support/test'

import { seed } from './seed'

/** The palette is a lazy chunk: keys typed before its field has focus are lost. */
async function open(page: Page) {
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await expect(palette.getByRole('combobox')).toBeFocused()
  return palette
}

/**
 * ⌘K finds records (#215): shelf, wantlist and the last dig, by artist, title,
 * label or catalogue number — searched in the worker — and offers actions.
 */

test('"blue" finds the Blue Note records, grouped', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()

  const palette = await open(page)
  await page.keyboard.type('blue')

  const shelf = palette.getByRole('group', { name: 'On your shelf' })
  await expect(shelf.getByRole('option', { name: /Speak No Evil/ })).toBeVisible()
  await expect(shelf.getByRole('option', { name: /Maiden Voyage/ })).toBeVisible()
  const dig = palette.getByRole('group', { name: 'In the last dig' })
  await expect(dig.getByRole('option', { name: /Point of Departure/ })).toBeVisible()
  await expect(dig.getByRole('option', { name: /Unity/ })).toBeVisible()

  // A catalogue number works too, and the combobox names the active option.
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('BST 84195')
  await expect(palette.getByRole('option')).toHaveCount(1)
  const field = palette.getByRole('combobox', { name: 'Search' })
  const active = await field.getAttribute('aria-activedescendant')
  await expect(page.locator(`#${active}`)).toHaveText(/Maiden Voyage/)

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/shelf\?q=Maiden/)
  await expect(page.getByText('Maiden Voyage').first()).toBeVisible()
})

test('the palette has no axe violations, with records in it', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()

  const palette = await open(page)
  await page.keyboard.type('blue')
  await expect(palette.getByRole('option', { name: /Speak No Evil/ })).toBeVisible()

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
})

test('the start page opens it by touch, and focus comes back', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')

  const door = page.getByRole('button', { name: 'Search records, shops, actions' })
  await door.click()
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await expect(palette.getByRole('combobox')).toBeFocused()

  // Tab stays in the dialog.
  await page.keyboard.press('Tab')
  await expect(palette.getByRole('combobox')).toBeFocused()

  // An action, not a record.
  await page.keyboard.type('basket')
  await expect(palette.getByRole('group', { name: 'Actions' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await expect(door).toBeFocused()
})
