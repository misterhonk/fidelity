import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The shelf walks too (M31.16).
 *
 * The arrows a find has had since M31.13, on the list somebody spends the most
 * time in — their own. Same shape, same keys, and the same rule about what
 * "the list" means: what is on the screen, in the order it is on the screen.
 */
test('walks the shelf from inside the sheet', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/shelf')

  // Whatever sorts first — the point is the order, not the record.
  const items = page.locator('main ul > li')
  await expect(items.first()).toBeVisible({ timeout: 15_000 })
  await items.first().getByRole('button').first().click()

  const sheet = page.getByRole('dialog')
  const title = sheet.getByRole('heading', { level: 2 }).first()
  await expect(sheet).toBeVisible({ timeout: 15_000 })

  // First in the list: nothing before it, something after it.
  await expect(sheet.getByRole('button', { name: 'The record before this one' })).toBeDisabled()
  const wasFirst = await title.innerText()

  await sheet.getByRole('button', { name: 'The next record' }).click()
  await expect(title).not.toHaveText(wasFirst)
  await expect(sheet.getByRole('button', { name: 'The record before this one' })).toBeEnabled()

  // And back with the keyboard, which is where the arrows come from.
  await page.keyboard.press('ArrowLeft')
  await expect(title).toHaveText(wasFirst)
})
