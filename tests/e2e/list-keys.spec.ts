import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * The list from the keyboard (M31.24).
 *
 * `j` and `k` walk a list in every mail client, every issue tracker and
 * `less`, and `/` jumps into the filter. Somebody who spends an evening in a
 * list of two hundred finds already has both in their fingers.
 *
 * The guard is the part worth pinning: in a field, `j` is the letter j.
 */

/** The seed's two finds both sit in the shortlist, so there is no long list. */
async function moreFinds(page: Page, digId: string) {
  await page.evaluate(async (dig: string) => {
    const request = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((done) => {
      request.onsuccess = () => done(request.result)
    })
    const tx = db.transaction('matches', 'readwrite')
    const store = tx.objectStore('matches')
    const first: Record<string, unknown> = await new Promise((done) => {
      const all = store.getAll()
      all.onsuccess = () => done(all.result[0] as Record<string, unknown>)
    })
    for (let i = 0; i < 8; i += 1) {
      store.put({
        ...first,
        digId: dig,
        listingId: 900_000 + i,
        releaseId: 910_000 + i,
        artist: `Probe ${i}`,
        title: `Record ${i}`,
        score: 40 - i,
      })
    }
    await new Promise((done) => (tx.oncomplete = done))
    db.close()
  }, digId)
}

test('walks the finds with j and k, and jumps into the filter with /', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })
  await moreFinds(page, dig.id)
  await page.reload()
  /*
   * Wait for the *ten*, not merely for a heading.
   *
   * The order the arrows walk is built from the list on screen, so pressing
   * `j` while the page still holds the two it loaded before the write gives
   * "1 of 2" — a real race, caught on the first run of this test.
   */
  await expect(page.getByRole('heading', { name: '10 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  // Nothing open yet: `j` starts at the top of the list.
  await page.keyboard.press('j')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByText('1 of 10')).toBeVisible()

  await page.keyboard.press('j')
  await expect(sheet.getByText('2 of 10')).toBeVisible()
  await page.keyboard.press('k')
  await expect(sheet.getByText('1 of 10')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // And `/` lands in the filter — where `j` is then the letter j again.
  await page.keyboard.press('/')
  const search = page.getByLabel('Filter the finds')
  await expect(search).toBeFocused()
  await search.press('j')
  await expect(search).toHaveValue('j')
  await expect(page.getByRole('dialog')).toBeHidden()
})
