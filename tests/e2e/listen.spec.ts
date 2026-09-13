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

/**
 * And hearing it without leaving the screen (ADR-012, amended 2026-09-13).
 *
 * The sharpest condition of that ADR is the one a running app cannot show:
 * **before the first deliberate tap, no byte goes to Google** — not even with
 * the switch long since thrown. This is the only place that can prove it, by
 * counting what the browser actually asked for.
 */
test('plays a clip in place, and reaches Google only when told to', async ({ page }) => {
  /** Every request to Google, counted and stopped before it leaves. */
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

  /*
   * Without the switch the clip is an ordinary link out — which is what
   * ADR-012 says happens when nobody has asked for an embed. It names the
   * clip, so nothing pretends the record itself is playing.
   */
  const asLink = sheet.getByRole('link', { name: 'Andrew Hill - Refuge' })
  await expect(asLink).toBeVisible({ timeout: 15_000 })
  await expect(asLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=MpmbntGDyNE')
  await expect(sheet.getByRole('button', { name: 'Andrew Hill - Refuge' })).toBeHidden()
  expect(asked).toEqual([])

  // The switch, thrown the way the settings throw it.
  await putRows(page, {
    meta: [
      {
        key: 'preferences',
        value: { ...DEFAULT_PREFERENCES, shipsToCountry: 'Germany', audioPreview: true },
      },
    ],
  })

  await page.goto('/')
  await page
    .getByRole('button', { name: /Open .*Point of Departure/i })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })

  const play = page.getByRole('dialog').getByRole('button', { name: 'Andrew Hill - Refuge' })
  await expect(play).toBeVisible({ timeout: 15_000 })

  /* The switch is on, the button is drawn — and Google has still heard nothing. */
  expect(asked).toEqual([])

  await play.click()
  await expect.poll(() => asked.length, { timeout: 15_000 }).toBeGreaterThan(0)
})
