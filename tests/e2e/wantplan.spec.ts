import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * Your wants across the shops you scanned (docs/06 M19 #9).
 *
 * The seed has one fresh dig at Plattenkiste with a €34 record the signals
 * call a wantlist hit — but the wantlist is the truth, so the record goes on
 * it here. A second shop is written straight into the database, dearer on
 * that record and with the only copy of a second want, so that the cheapest
 * plan is one parcel and the plan it beats is two.
 */
async function wantsAndASecondShop(page: Page) {
  await page.evaluate(
    async (input) => {
      const open = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const tx = db.transaction(['wantlist', 'dealers', 'digs', 'matches'], 'readwrite')
      const want = (releaseId: number, title: string) => ({
        releaseId,
        masterId: 0,
        title,
        artistIds: [1],
        artistNorms: ['andrew hill'],
        artistNames: ['Andrew Hill'],
        labelIds: [],
        labelNorms: [],
        labelNames: [],
        catnos: [],
        genres: [],
        styles: [],
        formats: ['Vinyl'],
        year: 1965,
        addedAt: '2021-01-01T00:00:00-00:00',
        note: '',
        want: 1,
      })
      tx.objectStore('wantlist').put(want(9_912_345, 'Point of Departure'))
      tx.objectStore('wantlist').put(want(9_912_999, 'Unity'))
      tx.objectStore('dealers').put({
        username: 'waxstand',
        displayName: 'Wax Stand',
        shipsFrom: 'Germany',
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
          { minItems: 1, maxItems: null, price: 6, currency: 'EUR', source: 'user' },
        ],
      })
      tx.objectStore('digs').put({
        id: '01J0000000000000000000DIG2',
        dealer: 'waxstand',
        status: 'done',
        startedAt: input.now - 120_000,
        finishedAt: input.now - 90_000,
        expiresAt: input.now + 5 * 60 * 60 * 1000,
        listingsTotal: 500,
        listingsScanned: 500,
        coverage: 1,
        truncated: false,
        matchCount: 2,
        apiRequests: 6,
        cursor: null,
      })
      for (const [listingId, releaseId, title, price] of [
        [4_100_000_001, 9_912_345, 'Point of Departure', 36],
        [4_100_000_002, 9_912_999, 'Unity', 20],
      ] as const) {
        tx.objectStore('matches').put({
          digId: '01J0000000000000000000DIG2',
          listingId,
          releaseId,
          score: 90,
          signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
          title,
          artist: releaseId === 9_912_345 ? 'Andrew Hill' : 'Larry Young',
          label: 'Blue Note',
          catno: null,
          format: 'Vinyl, LP',
          year: 1965,
          condition: 'Very Good Plus (VG+)',
          sleeve: null,
          price,
          currency: 'EUR',
          comments: null,
          thumbUrl: null,
          marketLowestPrice: null,
          marketNumForSale: null,
          expired: false,
        })
      }
      await new Promise((done) => (tx.oncomplete = () => done(null)))
      db.close()
    },
    { now: Date.now() },
  )
}

test('one parcel beats two, and the box says by how much', async ({ page }) => {
  await seed(page, 'en')
  await wantsAndASecondShop(page)
  await page.goto('/wantlist')

  const box = page.getByTestId('want-plan')
  await expect(box).toBeVisible({ timeout: 15_000 })
  await expect(box).toContainText('2 of your 3 wants are at these shops.')
  /*
   * Plattenkiste has both (34 + 21.50, postage 4.50 → 60.00) and Wax Stand
   * has both too (36 + 20, postage 6 → 62). Each where it is cheapest would
   * be Plattenkiste for one and Wax Stand for the other: 34 + 20 + 4.50 + 6
   * = 64.50, two parcels. One parcel wins by 4.50.
   */
  await expect(box).toContainText(
    'Cheapest: 1 shop, €55.50 for the records plus €4.50 postage — €60.00.',
  )
  await expect(box.getByRole('link', { name: 'Plattenkiste' })).toBeVisible()
  await expect(box).toContainText(
    'Each where it is cheapest would be 2 shops and €10.50 postage — €4.50 more.',
  )
  await expect(box).toContainText('Prices as scanned, good until')
})

test('says when the scanned shops have none of them', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/wantlist')
  await expect(page.getByTestId('want-plan')).toContainText(
    'Keine deiner gesuchten Platten bei einem Laden aus den letzten sechs Stunden.',
  )
})
