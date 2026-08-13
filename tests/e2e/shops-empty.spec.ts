import { expect, test, type Page } from '@playwright/test'

import { DB_VERSION } from '~~/db/schema'

/**
 * The shops screen with nothing on it yet.
 *
 * That is the state somebody is in exactly once, and it is the state in which
 * the friends list matters most: reading it is the difference between an
 * import that finds two shops and one that finds twenty, and it lived in
 * Settings → Search — three taps from the only screen where it does anything.
 *
 * A unit test can read the markup and see the component is there. Only a
 * browser can say whether the question is *open* when the list is empty, which
 * is the whole point: folded, it is a summary line somebody scrolls past on
 * the one visit where they have nothing else to look at.
 */

async function signedInWithNoShops(page: Page) {
  await page.goto('/')

  /*
   * Signed out, the app clears the database on its way to the setup. Seeding
   * before that redirect has happened is seeding into something the app is
   * about to throw away — measured 2026-08-13 in `start-rails.spec.ts`, and
   * the same trap sits here.
   */
  await page.waitForURL(/\/welcome/, { timeout: 20_000 })

  // Never `indexedDB.open` first: on a name that does not exist yet it
  // *creates* an empty v1 and the app's migrations then run from the wrong
  // floor. Wait for the app's own database to reach its version instead.
  await page.waitForFunction(
    async (wanted: number) => {
      const known = await indexedDB.databases()
      return known.some((entry) => entry.name === 'fidelity' && (entry.version ?? 0) >= wanted)
    },
    DB_VERSION,
    { timeout: 20_000 },
  )

  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })

    // A token is the gate, not the identity — and nothing here ever reaches
    // Discogs: the screen under test draws from the empty `dealers` store.
    const meta = db.transaction('meta', 'readwrite').objectStore('meta')
    meta.put({ key: 'token', value: 'not-a-real-token' })
    meta.put({ key: 'identity', value: { username: 'probe', displayName: 'Probe' } })
    await new Promise((done) => setTimeout(done, 0))
  })

  await page.goto('/dealers')
  await expect(page.locator('main')).toBeVisible()
}

test.describe('the shops screen with nothing on it', () => {
  test('asks about the friends list, open', async ({ page }) => {
    await signedInWithNoShops(page)

    const question = page.getByText('Also read my Discogs friends list?')
    await expect(question).toBeInViewport({ timeout: 15_000 })

    // Open, not folded: the checkbox itself has to be on screen, not one tap
    // behind a summary line.
    const toggle = page.getByRole('checkbox', { name: /friends list as well/i })
    await expect(toggle).toBeInViewport()
  })

  /**
   * And it folds itself away again once there is a shop list to read.
   *
   * On every later visit the question is a footnote, and a footnote that keeps
   * opening itself is an argument being restated to somebody who already
   * answered it.
   */
  test('folds it away once shops are known', async ({ page }) => {
    await signedInWithNoShops(page)

    await page.evaluate(async () => {
      const open = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const tx = db.transaction('dealers', 'readwrite')
      tx.objectStore('dealers').put({
        username: 'plattenkiste',
        displayName: 'Plattenkiste',
        shipsFrom: 'Germany',
        sellerRating: 100,
        ratingCount: 42,
        numForSale: 900,
        minOrderTotal: null,
        shippingNote: null,
        lastScannedAt: null,
        affinity: null,
        fingerprint: null,
        shippingTiers: [],
        watching: false,
      })
      await new Promise((done) => (tx.oncomplete = () => done(null)))
    })

    await page.goto('/dealers')
    await expect(page.getByRole('button', { name: 'Plattenkiste' })).toBeVisible({
      timeout: 15_000,
    })

    // Still reachable — one tap, not three — but no longer opened for you.
    await expect(page.getByText('Also read my Discogs friends list?')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /friends list as well/i })).toBeHidden()
  })
})
