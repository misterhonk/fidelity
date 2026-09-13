import { expect, test } from '@playwright/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * The same basket, at the other shops (M29).
 *
 * "Five records clicked together at one shop for €100 — could another shop
 * have the same five for €80? And if one has only four of them, but far
 * cheaper?" There is no documented way to ask Discogs who else sells a
 * release, so the answer is a join over the stock rows the digs already wrote
 * — free, and limited to the six hours those rows may live.
 *
 * No Discogs here at all: the whole feature reads the device.
 */
const NOW = Date.now()
const HOUR = 60 * 60 * 1000

/** The two releases the seeded basket holds, at 34,00 € and 21,50 €. */
const RELEASES = [9_912_345, 9_912_999]

const stockRow = (digId: string, releaseId: number, price: number, condition: string) => ({
  digId,
  listingId: releaseId * 10 + Math.round(price),
  releaseId,
  label: 'Blue Note',
  decade: 1960,
  title: `Record ${releaseId}`,
  artist: 'Andrew Hill',
  catno: null,
  format: 'Vinyl, LP',
  year: 1964,
  condition,
  price,
  currency: 'EUR',
})

test('names a shop that has the same basket for less', async ({ page }) => {
  await seed(page, 'en')

  await putRows(page, {
    // The shop the basket came from, so the comparison knows what is in it and
    // in what condition.
    stock: [
      {
        ...stockRow('01J0000000000000000000DIG1', RELEASES[0]!, 34, 'Very Good Plus (VG+)'),
        listingId: 3_204_119_887,
      },
      {
        ...stockRow('01J0000000000000000000DIG1', RELEASES[1]!, 21.5, 'Very Good Plus (VG+)'),
        listingId: 3_204_119_912,
      },
      // And a second shop, dug within the window, cheaper and in better nick.
      stockRow('01J0000000000000000000DIG2', RELEASES[0]!, 24, 'Near Mint (NM or M-)'),
      stockRow('01J0000000000000000000DIG2', RELEASES[1]!, 16, 'Near Mint (NM or M-)'),
    ],
    digs: [
      {
        id: '01J0000000000000000000DIG2',
        dealer: 'zweitplatten',
        status: 'done',
        startedAt: NOW - 2 * HOUR,
        finishedAt: NOW - 2 * HOUR,
        expiresAt: NOW + 4 * HOUR,
        listingsTotal: 900,
        listingsScanned: 900,
        uniqueSeen: 900,
        coverage: 1,
        depth: 'normal',
        truncated: false,
        matchCount: 0,
        apiRequests: 9,
        cursor: null,
      },
    ],
    dealers: [
      {
        ...seedDealer,
        username: 'zweitplatten',
        displayName: 'Zweitplatten',
        shippingTiers: [
          { minItems: 1, maxItems: 12, price: 5, currency: 'EUR', source: 'user' },
        ],
      },
    ],
  })

  await page.goto('/basket')

  // On demand: a page with four shops would otherwise run four joins before
  // anybody asked a question.
  const ask = page.getByRole('button', { name: 'Cheaper at another shop?' })
  await expect(ask).toBeVisible({ timeout: 15_000 })
  await ask.click()

  await expect(page.getByText('Zweitplatten')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('has 2 of your 2')).toBeVisible()
  // 24 + 16 + 5 postage = 45, against 34 + 21.50 + 4.50 = 60 — 15 less.
  // The separator follows the language, so the assertion does not insist on one.
  await expect(page.getByText(/15[.,]00.*less/)).toBeVisible()
  await expect(page.getByText('2 in better condition')).toBeVisible()

  /*
   * And the denominator, always. An empty answer means "not cheaper at your
   * shops" — letting it read as "not cheaper anywhere" would be the same
   * mistake as an acquittal without a horizon.
   */
  await expect(page.getByText(/Nothing about the rest of the market/)).toBeVisible()
})
