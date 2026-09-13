import { expect, test } from '@playwright/test'

import { DEFAULT_PREFERENCES } from '~~/db/meta'

import { putRows, seed } from './seed'

/**
 * One tap from a find to the music (M31).
 *
 * "I want to hear the music it suggests — Spotify, Apple Music, Tidal, Deezer,
 * and let me choose which." A link, not an integration: nothing is fetched and
 * nothing leaves the device until somebody taps it, which is the same standing
 * the "at Discogs" link beside it has always had.
 */
test('carries a record to the chosen service, and only once one is chosen', async ({
  page,
}) => {
  await seed(page, 'en')
  await page.goto('/')

  // Nothing chosen is the default, and then there is no button.
  await page
    .getByRole('button', { name: /Open .*Point of Departure/i })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByRole('link', { name: /Find it on/ })).toBeHidden()

  await putRows(page, {
    meta: [
      {
        key: 'preferences',
        value: { ...DEFAULT_PREFERENCES, shipsToCountry: 'Germany', listenService: 'tidal' },
      },
    ],
  })

  await page.goto('/')
  await page
    .getByRole('button', { name: /Open .*Point of Departure/i })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })

  const listen = page.getByRole('dialog').getByRole('link', { name: 'Find it on TIDAL' })
  await expect(listen).toBeVisible({ timeout: 15_000 })
  // The artist and the title, which is what somebody would type anyway.
  await expect(listen).toHaveAttribute(
    'href',
    'https://tidal.com/search?q=Andrew%20Hill%20Point%20of%20Departure',
  )
  // It leaves the app, and says so before it does.
  await expect(listen).toHaveAttribute('target', '_blank')
})
