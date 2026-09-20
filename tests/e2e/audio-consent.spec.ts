import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The audio preview's consent, where the clips are (ADR-012, amended
 * 2026-09-20): one button on the sheet throws the switch, the clips become
 * play buttons, and Google has still heard nothing until one is tapped.
 */
test('asks on the sheet, and the switch lands in the settings', async ({ page }) => {
  const asked: string[] = []
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/, (route) => {
    asked.push(route.request().url())
    return route.abort()
  })

  await seed(page, 'en')
  await page.goto('/')
  await page
    .getByRole('button', { name: /Open .*Point of Departure/i })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })

  // Off: the clip is a link out, and the question stands beside it.
  await expect(sheet.getByRole('link', { name: 'Andrew Hill - Refuge' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(sheet.getByText('Play the clips right here?')).toBeVisible()

  await sheet.getByRole('button', { name: 'Play here' }).click()

  // On: the same clip is a play button, and nothing has gone to Google.
  await expect(sheet.getByRole('button', { name: 'Andrew Hill - Refuge' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(sheet.getByText('Play the clips right here?')).toBeHidden()
  expect(asked).toEqual([])

  // The switch is where the "listen at" picker is, and no longer under Your data.
  await page.goto('/settings/search')
  await expect(page.getByLabel('Play clips right here')).toBeChecked({ timeout: 15_000 })
  await page.goto('/settings/data')
  await expect(page.getByLabel('Play clips right here')).toHaveCount(0)
})
