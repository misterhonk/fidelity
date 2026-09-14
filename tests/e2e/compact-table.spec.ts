import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * The compact density is a table, and now it says so (M31.25).
 *
 * It has been four columns since docs/05 §3 — cover, score, record, price —
 * with none of them named and none of them sortable from where somebody is
 * looking. The persona who asked for this density asked for exactly that: "a
 * table instead of cards, columns to sort by".
 */
async function manyFinds(page: Page, digId: string) {
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
    // Cheapest last by score, so the two orderings disagree and the click shows.
    for (let i = 0; i < 6; i += 1) {
      store.put({
        ...first,
        digId: dig,
        listingId: 900_000 + i,
        releaseId: 910_000 + i,
        artist: `Probe ${i}`,
        title: `Record ${i}`,
        score: 40 - i,
        price: 40 - i * 5,
      })
    }
    await new Promise((done) => (tx.oncomplete = done))
    db.close()
  }, digId)
}

test('names the columns and sorts by the one you click', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })
  await manyFinds(page, dig.id)
  await page.goto(`/dig?id=${dig.id}&dicht=kompakt`)
  await expect(page.getByRole('heading', { name: '8 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  const head = page.getByRole('group', { name: /^Columns/ })
  await expect(head).toBeVisible()
  await expect(head.getByRole('button', { name: 'Score' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  /*
   * The long list, not the shortlist above it — that keeps its cards, and it
   * takes the best five, so what is left here are the lower-scoring probes.
   * By score the strongest of those leads; by price the cheapest does, and the
   * probes are built so that the two orderings disagree.
   */
  const rows = page.locator('section[aria-labelledby="all-matches"] ul > li')
  await expect(rows.first()).toContainText('Probe 3')

  await head.getByRole('button', { name: 'Price ↑' }).click()
  await expect(head.getByRole('button', { name: 'Price ↑' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page).toHaveURL(/sort=price/)
  await expect(rows.first()).toContainText('Probe 5')
})
