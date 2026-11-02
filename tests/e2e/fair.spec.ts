import { expect, test, type Page } from './support/test'

import { DEFAULT_PREFERENCES } from '~~/db/meta'

import { putRows, seed } from './seed'

/**
 * A record fair (docs/06 M19 #4): two shops scanned this morning, one screen.
 *
 * The seed has one shop with two finds. A second one is written straight into
 * the database here, the way `arrival.spec.ts` writes its purchases — so the
 * in-store screen has two stands to offer, and "all of them" adds up.
 */
async function secondStand(page: Page, { expired = false } = {}) {
  const now = Date.now()
  // The morning's scan, walked in the afternoon: past its six hours.
  const startedAt = expired ? now - 8 * 60 * 60 * 1000 : now - 120_000
  const digId = '01J0000000000000000000DIG2'
  await putRows(page, {
    dealers: [
      {
        username: 'waxstand',
        displayName: 'Wax Stand',
        shipsFrom: 'Germany',
        sellerRating: 100,
        ratingCount: 10,
        numForSale: 500,
        minOrderTotal: 0,
        shippingNote: '',
        lastScannedAt: startedAt,
        newestListedAt: null,
        affinity: 1,
        fingerprint: null,
        shippingTiers: [],
      },
    ],
    digs: [
      {
        id: digId,
        dealer: 'waxstand',
        status: 'done',
        startedAt,
        finishedAt: startedAt + 30_000,
        expiresAt: startedAt + 6 * 60 * 60 * 1000,
        listingsTotal: 500,
        listingsScanned: 500,
        coverage: 1,
        truncated: false,
        matchCount: 2,
        apiRequests: 6,
        cursor: null,
      },
    ],
    matches: (
      [
        [4_100_000_001, 'Maiden Voyage', 88],
        [4_100_000_002, 'Empyrean Isles', 64],
      ] as const
    ).map(([listingId, title, score]) => ({
      digId,
      listingId,
      releaseId: listingId - 4_000_000_000,
      score,
      signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }],
      title,
      artist: 'Herbie Hancock',
      label: 'Blue Note',
      catno: 'BLP 4195',
      format: 'Vinyl, LP',
      year: 1965,
      condition: 'Very Good Plus (VG+)',
      sleeve: null,
      price: 18,
      currency: 'EUR',
      comments: null,
      thumbUrl: null,
      marketLowestPrice: null,
      marketNumForSale: null,
      expired: false,
    })),
  })
}

test('two stands, one screen — each on its own or all at once', async ({ page }) => {
  await seed(page, 'en')
  await secondStand(page)
  await page.goto('/in-store')

  // The newest stand first — the seed's shop, scanned a minute ago — and the chips to switch.
  await expect(page.getByText('plattenkiste · 2 finds').first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Point of Departure')).toBeVisible()
  await expect(page.getByText('Maiden Voyage')).toHaveCount(0)

  await page.getByRole('button', { name: 'All 2 stands' }).click()
  await expect(page.getByText('2 stands · 4 finds')).toBeVisible()
  await expect(page.getByText('Point of Departure')).toBeVisible()
  await expect(page.getByText('Maiden Voyage')).toBeVisible()

  await page.getByRole('button', { name: 'Wax Stand · 2 finds' }).click()
  await expect(page.getByText('waxstand · 2 finds')).toBeVisible()
  await expect(page.getByText('Point of Departure')).toHaveCount(0)
})

/**
 * Past six hours (#241): no price, no condition (rule 4). What the record is,
 * why it is a find, the link — and your own max price in the price's place.
 */
test('a stand past six hours shows the facts and your own max price, not the price', async ({
  page,
}) => {
  await seed(page, 'en')
  await secondStand(page, { expired: true })
  await putRows(page, {
    meta: [
      {
        key: 'preferences',
        value: { ...DEFAULT_PREFERENCES, shipsToCountry: 'Germany', maxPrice: 25 },
      },
    ],
  })
  await page.goto('/in-store')

  await page.getByRole('button', { name: 'Wax Stand · 2 finds' }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Maiden Voyage' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row.getByText('Blue Note · BLP 4195 · 1965')).toBeVisible()
  await expect(row.getByText('your max €25.00')).toBeVisible()
  await expect(row.getByText('€18.00')).toHaveCount(0)
  await expect(row.getByText(/VG\+/)).toHaveCount(0)
})
