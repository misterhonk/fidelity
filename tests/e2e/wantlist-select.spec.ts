import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * Select mode on the wantlist (M27).
 *
 * The shelf has had "Select" since M27.5; the wantlist never did, so the way
 * off the list that goes stale fastest — you buy a record and it is still on
 * it — was one sheet per record.
 *
 * The part worth pinning is the counting. A folded row is an *album*, and the
 * seed below gives it two pressings: ticking one sleeve has to say "2", or the
 * button promises to remove one record and removes two. That is the lesson of
 * M28 #4 from the other side, and it is invisible until a master repeats.
 */
async function morePressings(page: Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('wantlist', 'readwrite')
    const store = tx.objectStore('wantlist')
    const blank = {
      masterId: 0,
      artistIds: [],
      artistNorms: ['tomita'],
      artistNames: ['Isao Tomita'],
      labelIds: [],
      labelNorms: [],
      labelNames: [],
      catnos: [],
      genres: [],
      styles: [],
      formats: ['Vinyl'],
      year: 1974,
      thumbUrl: '',
      coverUrl: '',
      addedAt: '2018-06-01T00:00:00-00:00',
      note: '',
      want: 0,
    }
    // Two pressings of one album — they fold into a single sleeve (M28 #2).
    store.put({ ...blank, releaseId: 9_912_001, masterId: 77_001, title: 'Snowflakes' })
    store.put({ ...blank, releaseId: 9_912_002, masterId: 77_001, title: 'Snowflakes' })
    // And one that stands alone, so the list is not all one album.
    store.put({ ...blank, releaseId: 9_912_003, title: 'Firebird' })
    await new Promise((done) => (tx.oncomplete = () => done(null)))
    db.close()
  })
}

test('takes an album off by the sleeve, counting pressings, and puts it back', async ({
  page,
}) => {
  await seed(page, 'en')
  await morePressings(page)
  await page.goto('/wantlist')

  // Four wants on three sleeves: Stereolab, Firebird, and Snowflakes twice.
  const lead = page.getByText('4 records wanted')
  await expect(lead).toBeVisible({ timeout: 15_000 })
  const rows = page.locator('li[id^="want-"]')
  await expect(rows).toHaveCount(3)

  await page.getByRole('button', { name: 'Select' }).click()

  // Nothing ticked: the action is there and does nothing.
  await expect(page.getByText('0 selected')).toBeVisible()
  await expect(page.getByRole('button', { name: /Take 0 off/ })).toBeDisabled()

  /*
   * One sleeve, two wants. The whole point of the test: the number on the
   * button counts what would actually leave the list.
   */
  await page.locator('#want-9912001').getByRole('checkbox').check()
  await expect(page.getByText('2 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Take 2 off the wantlist' }).click()

  await expect(page.getByText('2 records wanted')).toBeVisible()
  await expect(rows).toHaveCount(2)
  await expect(page.locator('#want-9912001')).toBeHidden()

  // And the way back, which at this point has not cost a request: the removal
  // was still waiting in the outbox, so undoing it dropped the job.
  await expect(page.getByText('2 off the wantlist')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByText('4 records wanted')).toBeVisible()
  await expect(rows).toHaveCount(3)
  await expect(page.locator('#want-9912001')).toBeVisible()
})

test('ticks the whole answer with All, and leaves select mode on Done', async ({ page }) => {
  await seed(page, 'en')
  await morePressings(page)
  await page.goto('/wantlist')

  await expect(page.getByText('4 records wanted')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Select' }).click()
  await page.getByRole('button', { name: 'All' }).click()

  // Every want, not every sleeve, and not only the sixty that are drawn.
  await expect(page.getByText('4 selected')).toBeVisible()

  /*
   * Done puts the screen back and forgets the ticks rather than acting on them.
   *
   * Matched exactly, because every row carries "Not any more" under the
   * accessible name "Take {artist} — {title} off the wantlist" — the bulk
   * action is deliberately the same sentence with a number in place of a
   * record, and a loose pattern here catches all of them.
   */
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(
    page.getByRole('button', { name: 'Take 4 off the wantlist', exact: true }),
  ).toBeHidden()
  await expect(page.locator('li[id^="want-"]')).toHaveCount(3)

  await page.getByRole('button', { name: 'Select' }).click()
  await expect(page.getByText('0 selected')).toBeVisible()
})

test('spricht deutsch', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/wantlist')
  await page.getByRole('button', { name: 'Auswählen' }).click()
  await expect(page.getByText('0 ausgewählt')).toBeVisible({ timeout: 15_000 })
})
