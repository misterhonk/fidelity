import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * How much you want it (docs/06 M20 #1): Discogs' 0–5 per want, synced all
 * along and shown nowhere until today.
 *
 * The seed wants one record, Stereolab at five stars. A second want is
 * written straight into the database — older, and never rated — so there is
 * an order to switch and a star to give.
 */
async function olderWant(page: Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('wantlist', 'readwrite')
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
      addedAt: '2018-06-01T00:00:00-00:00',
      note: '',
      want: 0,
    })
    await new Promise((done) => (tx.oncomplete = () => done(null)))
    db.close()
  })
}

test('marks the ones you want most, sorts by them, and takes a star', async ({ page }) => {
  await seed(page, 'en')
  await olderWant(page)
  await page.goto('/wantlist')

  const stereolab = page.locator('#want-3299477')
  const unity = page.locator('#want-9912999')
  await expect(stereolab).toBeVisible({ timeout: 15_000 })
  await expect(stereolab).toContainText('wanted most')
  await expect(stereolab.getByRole('button', { name: 'Want it 5 stars' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(unity).not.toContainText('wanted most')

  // Longest wanted first by default: Unity since 2018. Wanted most: Stereolab.
  const rows = page.locator('li[id^="want-"]')
  await expect(rows.nth(0)).toHaveId('want-9912999')
  await page.getByRole('button', { name: 'Wanted most' }).click()
  await expect(page).toHaveURL(/sort=want/)
  await expect(rows.nth(0)).toHaveId('want-3299477')

  // Four stars on the one nobody rated: wanted most. Tapped again: never said.
  await unity.getByRole('button', { name: 'Want it 4 stars' }).click()
  await expect(unity).toContainText('wanted most')
  await expect(unity.getByRole('button', { name: 'Want it 4 stars' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(unity.getByRole('button', { name: 'Want it 5 stars' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await unity.getByRole('button', { name: 'Want it 4 stars' }).click()
  await expect(unity).not.toContainText('wanted most')
})

test('spricht deutsch', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/wantlist')
  await expect(page.locator('#want-3299477')).toContainText('ganz oben', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Am meisten gewollt' })).toBeVisible()
})
