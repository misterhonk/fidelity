import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The open shop on a phone is a sheet, on a desk a second column (M31.14).
 *
 * Same markup either way — `SheetFrame` or a plain `<section>`, chosen at
 * 1023 px, which is Tailwind's `lg` minus one. What the two have to differ in
 * is what somebody can do: on a phone the profile opens over the list and
 * closes back onto the row that was tapped; on a desk it stands beside the
 * list and has nothing to close.
 */
test('opens the shop over the list on a phone, and beside it on a desk', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await seed(page, 'en')
  await page.goto('/dealers')

  const row = page
    .getByRole('list', { name: 'Your shops' })
    .getByRole('button', { name: 'plattenkiste' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()

  const sheet = page.getByRole('dialog', { name: /plattenkiste/i })
  await expect(sheet).toBeVisible()
  // The three things that used to sit three screens down.
  await expect(sheet.getByRole('button', { name: /Watch/ })).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Dig/ })).toBeVisible()

  // And closing puts the list back, with the shop gone from the address.
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(page).not.toHaveURL(/shop=/)
  await expect(row).toBeVisible()

  // Wide, the same profile is a column: the same controls, no dialog at all.
  await page.setViewportSize({ width: 1280, height: 800 })
  await row.click()
  await expect(page.getByRole('button', { name: /^Watch/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
