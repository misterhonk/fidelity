import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The open find, in the address (M31.23).
 *
 * Three things follow from it, and the last is the one somebody notices every
 * day: a reload keeps the record open, a link can point at a find, and **Back
 * closes the sheet** instead of leaving the dig — which on a phone is the
 * gesture, and until now cost the list and its scroll position.
 */
test('keeps the open find in the address, and closes it on Back', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)

  await page
    .getByRole('button', { name: /Point of Departure/i })
    .first()
    .click()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/find=/)

  // A reload lands on the same record rather than on the bare list.
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Point of Departure' }),
  ).toBeVisible()

  // Back closes the sheet and stays on the dig.
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/dig/)
  await expect(page).not.toHaveURL(/find=/)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible()
})

/** And the ✕ leaves no entry behind either — pressing Back again must not reopen it. */
test('closing with the cross does not leave the find in the history', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)

  await page
    .getByRole('button', { name: /Point of Departure/i })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })

  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).not.toHaveURL(/find=/)
})
