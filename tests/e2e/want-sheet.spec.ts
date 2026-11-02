import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * A record you want opens like a record, not like a link (M31.21).
 *
 * The wantlist was the one screen where a sleeve led out of the app. What it
 * carries that no other sheet does is the note — "only the German press" is
 * the difference between a find and a mistake — and how badly you want it.
 */
test('opens a wanted record in the app, with the note and the stars', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/wantlist')

  const cover = page.locator('main ul li button').first()
  await expect(cover).toBeVisible({ timeout: 15_000 })
  await cover.click()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByRole('heading', { name: 'Sound-Dust' })).toBeVisible()
  await expect(sheet.getByText('Stereolab')).toBeVisible()
  await expect(sheet.getByText(/Duophonic press/)).toBeVisible()
  await expect(sheet.getByRole('group', { name: 'How much you want it' })).toBeVisible()

  // Discogs is a destination now, not the only thing the screen can do.
  await expect(sheet.getByRole('link', { name: /View at Discogs/ })).toHaveAttribute(
    'href',
    /discogs\.com\/release\//,
  )

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
})

/**
 * Which pressing will do (#242): "first pressing only", "anything but the 2016
 * reissue". Kept on this device, so it is still there when the sheet reopens.
 */
test('keeps a pressing rule for the album', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/wantlist')

  const cover = page.locator('main ul li button').first()
  await expect(cover).toBeVisible({ timeout: 15_000 })
  await cover.click()

  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Which pressing will do' })).toBeVisible({
    timeout: 15_000,
  })
  await sheet.getByRole('checkbox', { name: /First pressing only/ }).check()
  await sheet
    .getByLabel('Any pressing except')
    .fill('https://www.discogs.com/release/9101-Dummy')
  await sheet.getByRole('button', { name: 'Exclude' }).click()
  await expect(sheet.getByRole('link', { name: /Not release 9101/ })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await cover.click()
  await expect(sheet.getByRole('checkbox', { name: /First pressing only/ })).toBeChecked({
    timeout: 15_000,
  })
  await expect(sheet.getByRole('link', { name: /Not release 9101/ })).toBeVisible()

  await sheet.getByRole('button', { name: 'Allow release 9101 again' }).click()
  await expect(sheet.getByRole('link', { name: /Not release 9101/ })).toBeHidden()
})
