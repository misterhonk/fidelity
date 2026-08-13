import { expect, test, type Page } from '@playwright/test'

import { DB_VERSION } from '~~/db/schema'

/**
 * The covers on the start screen are really clickable.
 *
 * Written after a change that looked right and was not: the wantlist rail was
 * given `<component :is="resolveComponent('NuxtLink')">` — which in a
 * production build silently hands back the *string* `'NuxtLink'` and renders a
 * literal `<nuxtlink>` element. No error, no warning, a cover that simply does
 * nothing. Measured 2026-08-13.
 *
 * `tests/unit/cover-tile.spec.ts` reads the source and could not see it: the
 * source was exactly what it was supposed to be. Only a browser knows what
 * came out, so this asks one — against the built output, with two records put
 * into IndexedDB, because the rails do not exist without them.
 */

const SHELF = {
  releaseId: 1001,
  instanceId: 5001,
  folderId: 1,
  masterId: 0,
  title: 'Selected Ambient Works 85-92',
  artistIds: [],
  artistNames: ['Aphex Twin'],
  artistNorms: ['aphex twin'],
  labelIds: [],
  labelNames: ['Apollo'],
  labelNorms: ['apollo'],
  catnos: ['AMB 3922 CD'],
  genres: ['Electronic'],
  styles: ['Ambient'],
  formats: ['Vinyl', 'LP'],
  year: 1992,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  addedAt: '2026-01-01T00:00:00-00:00',
}

/*
 * Twenty of them, and the one we tap sorts *last*.
 *
 * A fixture of one record cannot fail the scroll check: the only row is at
 * the top of the page whether anything scrolled or not. Measured 2026-08-13 —
 * removing the scroll left the test green. The wantlist puts the longest
 * wanted first, so the newest `addedAt` lands the target below the fold,
 * which is where a scroll is the difference between arriving and not.
 */
const WANTED = {
  releaseId: 2002,
  masterId: 0,
  title: 'Dummy',
  artistIds: [],
  artistNames: ['Portishead'],
  artistNorms: ['portishead'],
  labelIds: [],
  labelNames: ['Go! Beat'],
  labelNorms: ['go beat'],
  catnos: [],
  genres: [],
  styles: [],
  formats: ['Vinyl'],
  year: 1994,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  // Newest of the lot, so it sorts to the bottom.
  addedAt: '2026-08-01T00:00:00-00:00',
}

/** The crowd it has to be found in. */
const CROWD = Array.from({ length: 19 }, (_, index) => ({
  ...WANTED,
  releaseId: 3000 + index,
  title: `Filler ${index}`,
  artistNames: ['Somebody Else'],
  artistNorms: ['somebody else'],
  addedAt: `2020-01-${String(index + 1).padStart(2, '0')}T00:00:00-00:00`,
}))

async function withRails(page: Page) {
  await page.goto('/')

  /*
   * Let the app finish tidying up before writing anything.
   *
   * Signed out, the start screen sends you to the setup and the app clears the
   * database on the way — measured 2026-08-13, after a seed kept landing in a
   * brand new v1 with no stores at all. Waiting for the redirect is waiting
   * for that to have happened; seeding earlier is seeding into something the
   * app is about to throw away.
   */
  await page.waitForURL(/\/welcome/, { timeout: 20_000 })

  /*
   * Wait for the app to finish building its database, and check the *version*.
   *
   * Two traps, both walked into on 2026-08-13. `indexedDB.open('fidelity')` on
   * a name that does not exist yet **creates** an empty one at version 1, and
   * the app's migrations then run from there — the v6 block would try to drop
   * a `collection` store that was never made. So: never open it first.
   *
   * And the name alone is not enough. `databases()` lists the entry while the
   * upgrade is still running, at version 1 — opening on that answer is the
   * same mistake by a slower route, and it is what produced a seed against an
   * empty database with no stores at all.
   */
  const version = DB_VERSION
  await page.waitForFunction(
    async (wanted: number) => {
      const known = await indexedDB.databases()
      return known.some((entry) => entry.name === 'fidelity' && (entry.version ?? 0) >= wanted)
    },
    version,
    { timeout: 20_000 },
  )

  await page.evaluate(
    async ([shelf, wanted, crowd]) => {
      const open = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })

      const meta = db.transaction('meta', 'readwrite').objectStore('meta')
      /*
       * A stand-in, and the gate this screen actually checks.
       *
       * `identity` alone leaves the start screen redirecting to the setup —
       * measured 2026-08-13. Nothing here ever reaches Discogs: the rails are
       * read out of the two stores below, and a request with this would fail
       * and be swallowed like any other.
       */
      meta.put({ key: 'token', value: 'not-a-real-token' })
      meta.put({ key: 'identity', value: { username: 'probe', displayName: 'Probe' } })

      const tx = db.transaction(['collection', 'wantlist'], 'readwrite')
      tx.objectStore('collection').put(shelf)
      for (const record of [wanted, ...crowd]) tx.objectStore('wantlist').put(record)
      await new Promise((done) => (tx.oncomplete = () => done(null)))
    },
    [SHELF, WANTED, CROWD] as const,
  )
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()
}

test.describe('the covers on the start screen', () => {
  test('a record you own opens its own sheet', async ({ page }) => {
    await withRails(page)

    const tile = page.getByRole('button', { name: /Open Selected Ambient Works/i }).first()
    await expect(tile).toBeVisible({ timeout: 15_000 })
    await tile.click()

    // The sheet, not Discogs and not another page.
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/')
  })

  /**
   * The one this file was written for.
   *
   * A real `<a href>`, so that middle-click, "open in new tab" and every
   * screen reader's list of links behave — none of which a `<nuxtlink>` or a
   * button dressed as a link can do.
   */
  test('a record you want is a real link to its own row', async ({ page }) => {
    await withRails(page)

    const tile = page.getByRole('link', { name: /Open Dummy/i }).first()
    await expect(tile).toBeVisible({ timeout: 15_000 })
    await expect(tile).toHaveAttribute('href', '/wantlist#want-2002')
    // Inside the app: no second tab, and no outward jump.
    await expect(tile).not.toHaveAttribute('target', '_blank')

    await tile.click()
    /*
     * In the viewport, not merely in the document.
     *
     * `toBeVisible` passes for a row sitting a thousand pixels below the fold,
     * which is exactly what shipped for one build: the link was right, the
     * landing was not, and the test said nothing. The list arrives from
     * IndexedDB after the address does, so the page has to do the scrolling.
     */
    await expect(page.locator('#want-2002')).toBeInViewport()
  })

  /** And nothing on this screen quietly leaves for Discogs any more. */
  test('no cover leads out of the app', async ({ page }) => {
    await withRails(page)

    const outward = page.locator('.fid-rail a[href*="discogs.com"]')
    await expect(outward).toHaveCount(0)
  })
})
