import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * A reason that repeats is not a reason, it is a category (M33 #1).
 *
 * Twenty of twenty-seven cards said "*X* steht schon in deiner Sammlung —
 * diese Platte nicht" when the demo account walked the screens on 2026-09-16,
 * with a different X each time. Read once, that sentence is the product; read
 * twenty times it is a column heading somebody printed into every row.
 *
 * Only a browser can show this, and that is the point of the test rather than
 * an inconvenience: the *rule* is a pure function with its own unit tests, but
 * whether a card draws the plate depends on what the list around it holds —
 * and a list is a thing with a document, not a shape in the source.
 */

/** The long list starts below the shortlist, so enough that both are full. */
const MANY = 20

/**
 * Twenty finds with the same reason, and one with a second thing to say.
 *
 * Scores from 40 down, under both of the seeded finds, so the shortlist is
 * `[92, 71, 40, 39, 38]` and everything from 37 down is the long list. The one
 * that also collects the label sits at 30, safely inside it.
 */
async function manyOfTheSame(page: Page, digId: string) {
  await page.evaluate(
    async ({ dig, howMany }: { dig: string; howMany: number }) => {
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

      for (let i = 0; i < howMany; i += 1) {
        const artist = {
          type: 'ARTIST_KNOWN',
          confidence: 1,
          evidence: { artist: `Probe ${i}`, owned: 5 },
        }
        /*
         * One of them collects the label as well. ARTIST_KNOWN weighs 55 and
         * LABEL_AFFINITY 45, so the artist still leads and goes on the plate
         * — and the label is what the card has left to say in a sentence.
         */
        const alsoLabel = {
          type: 'LABEL_AFFINITY',
          confidence: 1,
          evidence: { label: 'Blue Note', owned: 14 },
        }
        store.put({
          ...first,
          digId: dig,
          listingId: 900_000 + i,
          releaseId: 910_000 + i,
          artist: `Probe ${i}`,
          title: `Record ${i}`,
          score: 40 - i,
          price: 40 - i,
          signals: i === 10 ? [artist, alsoLabel] : [artist],
        })
      }
      await new Promise((done) => (tx.oncomplete = done))
      db.close()
    },
    { dig: digId, howMany: MANY },
  )
}

test('wears a worn-out reason as a plate, and keeps the sentence for the rest', async ({
  page,
}) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })
  await manyOfTheSame(page, dig.id)
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: '22 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  const list = page.locator('section[aria-labelledby="all-matches"]')
  const shortlist = page.locator('section[aria-labelledby="top-five"]')

  // The plate: the signal's own word, the name it is about, and how many of
  // them are on the shelf.
  await expect(list.getByText('On the shelf · 5').first()).toBeVisible()

  /*
   * And the sentence it replaces is gone from the long list. Not gone from the
   * app — the sheet still says it in full, which is where somebody who wants
   * the whole story goes.
   */
  await expect(list.getByText('You have 5 records by Probe 12')).toHaveCount(0)

  /*
   * The card that has more to say says it. The plate carries the lead, and the
   * sentence starts at the next strongest signal instead of repeating what the
   * plate just said.
   */
  const alsoLabel = list.locator('article', { hasText: 'Record 10' })
  await expect(alsoLabel.getByText('On the shelf · 5')).toBeVisible()
  await expect(alsoLabel.getByText('You collect Blue Note')).toBeVisible()

  /*
   * The shortlist is five cards, and five is not a stretch of anything. It
   * gets no provider at all, so every card there keeps the sentence — which is
   * the whole reason the decision sits on the list rather than on the card.
   */
  await expect(shortlist.getByText('You have 5 records by Probe 0')).toBeVisible()
  await expect(shortlist.getByText('On the shelf · 5')).toHaveCount(0)
})

/**
 * The second key under the score (M33 #2).
 *
 * Twenty finds sat at 48 on the same walk and "by score" ordered nothing among
 * them — the list was whatever order the scan happened to write. The price
 * carries on where the score stops, and the tab says so rather than leaving
 * somebody to work out why two equal finds are in the order they are in.
 */
test('breaks a tie on the price, and says on the tab that it does', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })

  await page.evaluate(async (digId: string) => {
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
    // Eight finds at one score, written dearest first so the order on screen
    // can only come from the tie-break.
    for (let i = 0; i < 8; i += 1) {
      store.put({
        ...first,
        digId,
        listingId: 800_000 + i,
        releaseId: 810_000 + i,
        artist: `Tie ${i}`,
        title: `Same ${i}`,
        score: 48,
        price: 80 - i * 5,
      })
    }
    await new Promise((done) => (tx.oncomplete = done))
    db.close()
  }, dig.id)

  await page.goto(`/dig?id=${dig.id}&density=compact`)
  await expect(page.getByRole('heading', { name: '10 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  /*
   * Read as prices rather than as names, because *which* of the eight the
   * shortlist takes is the worker's business and not this test's — it ranks
   * by score too, and among eight equal scores its answer is the order the
   * store handed them over. What is being checked is the rule: whatever is
   * left over stands cheapest first, although the scores say nothing.
   *
   * They were written dearest-first on purpose, so the order on screen cannot
   * be the order they arrived in.
   */
  const rows = page.locator('section[aria-labelledby="all-matches"] ul > li')
  await expect(rows.first()).toBeVisible()

  const prices = (await rows.allInnerTexts()).map((row) =>
    Number(row.match(/€(\d+(?:\.\d+)?)/)?.[1] ?? Number.NaN),
  )

  expect(prices.length).toBeGreaterThan(1)
  expect(prices).not.toContain(Number.NaN)
  expect(prices).toEqual([...prices].sort((a, b) => a - b))

  // And the tab in force names its second key, so the order is readable
  // rather than a thing somebody has to reverse-engineer from the rows.
  const sorting = page.getByRole('navigation', { name: /^Sorting/ })
  await expect(sorting.getByRole('button', { name: /Score/ })).toContainText('then price')
})
