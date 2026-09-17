import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The dig screen once it has an answer on it (M31.13).
 *
 * Two things that only matter after a dig has run: the question folds away,
 * and the list can be walked from inside the sheet. Both are about the same
 * complaint — a find means something next to its neighbours, and everything
 * that stands between the two of them is in the way.
 */
test('folds the question away and walks the list from inside the sheet', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)

  const result = page.getByRole('heading', { name: /finds at/ })
  await expect(result).toBeVisible({ timeout: 15_000 })

  // The field, the shops and the earlier digs are one line now, and they come
  // back with one click.
  const field = page.getByLabel('Shop name or link')
  await expect(field).toBeHidden()
  await page.getByText('Another shop, or an earlier dig').click()
  await expect(field).toBeVisible()

  // And the sheet says where in the list it is standing.
  await page
    .getByRole('button', { name: /Point of Departure/i })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByText('1 of 2')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'The find before this one' })).toBeDisabled()

  await sheet.getByRole('button', { name: 'The next find' }).click()
  await expect(sheet.getByRole('heading', { name: /Unity/ })).toBeVisible()
  await expect(sheet.getByText('2 of 2')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'The next find' })).toBeDisabled()

  // The keyboard does the same thing, which is where the arrows come from.
  await page.keyboard.press('ArrowLeft')
  await expect(sheet.getByRole('heading', { name: /Point of Departure/ })).toBeVisible()
})
