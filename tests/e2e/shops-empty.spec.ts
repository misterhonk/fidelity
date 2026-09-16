import { expect, test, type Page } from '@playwright/test'

import { DB_VERSION } from '~~/db/schema'

/**
 * A signed-in device that has never dug, watched or bought anywhere.
 *
 * `seed()` writes a shop, and this is the one screen where that would hide
 * the case under test. The token is a placeholder: nothing here talks to
 * Discogs.
 */
async function signedInWithNoShops(page: Page) {
  await page.goto('/')

  /* The welcome screen means the stores exist and the guard has run. */
  await page.waitForURL(/\/welcome/, { timeout: 20_000 })

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

    const meta = db.transaction('meta', 'readwrite').objectStore('meta')
    meta.put({ key: 'token', value: 'not-a-real-token' })
    meta.put({ key: 'identity', value: { username: 'probe', displayName: 'Probe' } })
    await new Promise((done) => setTimeout(done, 0))
  })

  await page.goto('/dealers')
  await expect(page.locator('main')).toBeVisible()
}

test.describe('the shops screen with nothing on it', () => {
  /*
   * One field, in view (M34.1). The screen used to end in a search box and a
   * folded question about the friends list; both moved to the settings, and
   * what is left is the shortest path: a name.
   */
  test('says so, and offers the one field', async ({ page }) => {
    await signedInWithNoShops(page)

    await expect(page.getByText('No shop scanned yet.')).toBeInViewport({ timeout: 15_000 })
    await expect(page.getByLabel('Add a shop')).toBeInViewport()
    await expect(page.getByText('Also read my Discogs friends list?')).toHaveCount(0)
  })

  test('keeps the friends question and the search in the settings', async ({ page }) => {
    await signedInWithNoShops(page)
    await page.goto('/settings/search')

    await expect(page.getByRole('checkbox', { name: /friends list as well/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: 'Find shops at Discogs' })).toBeVisible()
  })
})
