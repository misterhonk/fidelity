import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The coverage line counts records, not page rows (M32.6).
 *
 * A shop is walked from both ends, so the middle comes back twice: on a shop
 * holding 19.864 listings the two passes read 20.000 rows, and the line said
 * "20.000 of 19.864 dug (100 %)" — reported from a real screen on
 * 2026-09-14 with exactly those numbers, and there is no reading of it that is
 * true. `uniqueSeen` is the numerator the coverage percentage is already built
 * from; now the sentence and the percentage agree.
 */
test('counts distinct listings, never more than the shop holds', async ({ page }) => {
  const dig = await seed(page, 'en')

  await page.evaluate(async (digId: string) => {
    const request = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((done) => {
      request.onsuccess = () => done(request.result)
    })
    const tx = db.transaction('digs', 'readwrite')
    const store = tx.objectStore('digs')
    const row: Record<string, unknown> = await new Promise((done) => {
      const one = store.get(digId)
      one.onsuccess = () => done(one.result as Record<string, unknown>)
    })
    // The real shape of a two-pass walk: more rows read than records held.
    store.put({
      ...row,
      listingsTotal: 19_864,
      listingsScanned: 20_000,
      uniqueSeen: 19_864,
      coverage: 1,
    })
    await new Promise((done) => (tx.oncomplete = done))
    db.close()
  }, dig.id)

  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByText('19,864 of 19,864 dug (100 %)')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('20,000 of 19,864')).toHaveCount(0)
})
