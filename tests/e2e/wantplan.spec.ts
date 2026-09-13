import { expect, test, type Page } from '@playwright/test'

import { putRows, seed } from './seed'

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
  const now = Date.now()
  const rows: Record<'wantlist' | 'dealers' | 'digs' | 'matches', unknown[]> = {
    wantlist: [],
    dealers: [],
    digs: [],
    matches: [],
  }
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
  rows.wantlist.push(want(9_912_345, 'Point of Departure'))
  rows.wantlist.push(want(9_912_999, 'Unity'))
  rows.dealers.push({
    username: 'waxstand',
    displayName: 'Wax Stand',
    shipsFrom: 'Germany',
    sellerRating: 100,
    ratingCount: 10,
    numForSale: 500,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: now - 120_000,
    newestListedAt: null,
    affinity: 1,
    fingerprint: null,
    shippingTiers: [{ minItems: 1, maxItems: null, price: 6, currency: 'EUR', source: 'user' }],
  })
  rows.digs.push({
    id: '01J0000000000000000000DIG2',
    dealer: 'waxstand',
    status: 'done',
    startedAt: now - 120_000,
    finishedAt: now - 90_000,
    expiresAt: now + 5 * 60 * 60 * 1000,
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
    rows.matches.push({
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
  await putRows(page, rows)
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

test('before the first dig it says what would fill it, with the way there', async ({
  page,
}) => {
  await seed(page, 'en')
  // The seed's dig, expired: nothing inside the six hours any more (rule 4).
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('digs', 'readwrite')
    const store = tx.objectStore('digs')
    const all: { id: string; expiresAt: number }[] = await new Promise((resolve) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
    })
    for (const dig of all) store.put({ ...dig, expiresAt: Date.now() - 1000 })
    await new Promise((done) => (tx.oncomplete = () => done(null)))
    db.close()
  })
  await page.goto('/wantlist')

  const box = page.getByTestId('want-plan')
  await expect(box).toContainText('No shop scanned in the last six hours.', { timeout: 15_000 })
  await expect(box.getByRole('link', { name: 'Start a dig' })).toHaveAttribute('href', '/dig')
  await expect(box.getByRole('group', { name: 'Ships from' })).toHaveCount(0)
})

test('says when the scanned shops have none of them', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/wantlist')
  await expect(page.getByTestId('want-plan')).toContainText(
    'Keine deiner gesuchten Platten bei einem Laden aus den letzten sechs Stunden.',
  )
})
