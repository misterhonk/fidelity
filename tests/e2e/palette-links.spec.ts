import { expect, test, type Page } from '@playwright/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * The palette's data rows go where they name (#195): a shop opens that shop,
 * a find opens its sheet. Both used to land on the screen's top instead.
 */
// Sorts ahead of the seeded shop either way, so the desk would not open the chosen one by itself.
const first = {
  ...seedDealer,
  username: 'aardvark',
  displayName: 'Aardvark Records',
  affinity: 9,
}

async function choose(page: Page, text: string) {
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await expect(palette).toBeVisible()
  await page.keyboard.type(text)
  // In the palette: the rows load after it opens, and the start page has its own buttons.
  await expect(palette.getByRole('button', { name: new RegExp(text) }).first()).toBeVisible()
  await page.keyboard.press('Enter')
}

test('a shop in the palette opens that shop', async ({ page }) => {
  await seed(page, 'en')
  await putRows(page, { dealers: [first] })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()

  await choose(page, 'Plattenkiste')
  await expect(page).toHaveURL(/\/dealers\?shop=plattenkiste/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Plattenkiste' })).toBeVisible()
})

test('a find in the palette opens its sheet', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()

  await choose(page, 'Point of Departure')
  await expect(page).toHaveURL(new RegExp(`/dig\\?.*find=${dig.id}(~|%7E)3204119887`), {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Point of Departure' }),
  ).toBeVisible({ timeout: 15_000 })
})
