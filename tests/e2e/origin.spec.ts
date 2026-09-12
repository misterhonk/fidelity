import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * "Only from Germany / the EU" (docs/06 M20 #2), on the plan and on the shops.
 *
 * The seed's shop ships from Germany. A second one from the United Kingdom is
 * written into the database with a fresh dig and one want — EU customs is
 * exactly the line the filter is asked to draw.
 */
async function britishShop(page: Page) {
  await page.evaluate(
    async (input) => {
      const open = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const tx = db.transaction(['wantlist', 'dealers', 'digs', 'matches'], 'readwrite')
      tx.objectStore('wantlist').put({
        releaseId: 9_912_999,
        masterId: 0,
        title: 'Unity',
        artistIds: [2],
        artistNorms: ['larry young'],
        artistNames: ['Larry Young'],
        labelIds: [],
        labelNorms: [],
        labelNames: [],
        catnos: [],
        genres: [],
        styles: [],
        formats: ['Vinyl'],
        year: 1966,
        thumbUrl: '',
        coverUrl: '',
        addedAt: '2021-01-01T00:00:00-00:00',
        note: '',
        want: 0,
      })
      tx.objectStore('dealers').put({
        username: 'londonwax',
        displayName: 'London Wax',
        shipsFrom: 'United Kingdom',
        sellerRating: 100,
        ratingCount: 10,
        numForSale: 500,
        minOrderTotal: 0,
        shippingNote: '',
        lastScannedAt: input.now - 120_000,
        newestListedAt: null,
        affinity: 1,
        fingerprint: null,
        shippingTiers: [
          { minItems: 1, maxItems: null, price: 9, currency: 'EUR', source: 'user' },
        ],
      })
      tx.objectStore('digs').put({
        id: '01J0000000000000000000DIG3',
        dealer: 'londonwax',
        status: 'done',
        startedAt: input.now - 120_000,
        finishedAt: input.now - 90_000,
        expiresAt: input.now + 5 * 60 * 60 * 1000,
        listingsTotal: 500,
        listingsScanned: 500,
        coverage: 1,
        truncated: false,
        matchCount: 1,
        apiRequests: 6,
        cursor: null,
      })
      tx.objectStore('matches').put({
        digId: '01J0000000000000000000DIG3',
        listingId: 4_200_000_001,
        releaseId: 9_912_999,
        score: 90,
        signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
        title: 'Unity',
        artist: 'Larry Young',
        label: 'Blue Note',
        catno: null,
        format: 'Vinyl, LP',
        year: 1966,
        condition: 'Very Good Plus (VG+)',
        sleeve: null,
        price: 15,
        currency: 'EUR',
        comments: null,
        thumbUrl: null,
        marketLowestPrice: null,
        marketNumForSale: null,
        expired: false,
      })
      await new Promise((done) => (tx.oncomplete = () => done(null)))
      db.close()
    },
    { now: Date.now() },
  )
}

test('the plan drops the shop across the Channel when asked, and says so', async ({ page }) => {
  await seed(page, 'en')
  await britishShop(page)
  await page.goto('/wantlist')

  const box = page.getByTestId('want-plan')
  // Anywhere: London Wax has Unity cheaper than Plattenkiste (15 + 9 vs 21.50 + 4.50).
  await expect(box).toContainText(
    'Cheapest: 1 shop, €15.00 for the records plus €9.00 postage — €24.00.',
    {
      timeout: 15_000,
    },
  )
  await expect(box.getByRole('button', { name: 'From Germany' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await box.getByRole('button', { name: 'From the EU' }).click()
  await expect(page).toHaveURL(/from=eu/)
  await expect(box).toContainText(
    'Cheapest: 1 shop, €21.50 for the records plus €4.50 postage — €26.00.',
  )
  await expect(box).toContainText('1 shop elsewhere, or with no origin on record, left out.')
  await expect(box.getByRole('link', { name: 'Plattenkiste' })).toBeVisible()

  await box.getByRole('button', { name: 'Anywhere' }).click()
  await expect(page).not.toHaveURL(/from=/)
  await expect(box).toContainText('€24.00.')
})

test('the shops screen keeps only the chips from home', async ({ page }) => {
  await seed(page, 'en')
  await britishShop(page)
  await page.goto('/dealers')

  const shops = page.getByRole('navigation', { name: 'Scanned shops' })
  await expect(shops.getByRole('button', { name: /London Wax/ })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'From Germany' }).click()
  await expect(page).toHaveURL(/from=home/)
  await expect(shops.getByRole('button', { name: /London Wax/ })).toHaveCount(0)
  await expect(shops.getByRole('button', { name: /Plattenkiste/ })).toBeVisible()
})

test('sagt es auf Deutsch', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/dealers?from=eu')
  await expect(page.getByRole('button', { name: 'Aus der EU' })).toHaveAttribute(
    'aria-pressed',
    'true',
    {
      timeout: 15_000,
    },
  )
  await expect(page.getByRole('button', { name: 'Aus Deutschland' })).toBeVisible()
})
