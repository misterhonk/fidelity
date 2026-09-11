import { expect, test, type Page } from '@playwright/test'

import { seed, seedDealer } from './seed'

/**
 * „Ist sie angekommen?" im Browser (M14).
 *
 * Zwei Dinge sind hier und nur hier zu prüfen. Das erste ist eine Bedingung
 * über die Zeit: die Frage erscheint erst, wenn die Post gewesen sein könnte —
 * im Quelltext steht ein Vergleich, auf dem Schirm steht ein Kasten oder
 * keiner. Das zweite ist der Weg von der Antwort zur Zahl: drei Knöpfe auf der
 * Startseite, eine Quote im Händlerprofil, und dazwischen ein Worker und eine
 * Datenbank, die kein Unit-Test zusammen durchläuft.
 */

const TAG = 24 * 60 * 60 * 1000

/** Käufe schreiben, wie sie der Dig hinterlassen hätte. */
async function bought(
  page: Page,
  rows: { listingId: number; ageDays: number; arrived?: 'as-described' | 'worse' }[],
) {
  await page.evaluate(
    async (input) => {
      const open = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })

      const tx = db.transaction('feedback', 'readwrite')
      for (const row of input.rows) {
        tx.objectStore('feedback').put({
          listingId: row.listingId,
          releaseId: row.listingId * 10,
          artist: 'Alice Coltrane',
          title: `Journey ${row.listingId}`,
          dealer: input.dealer,
          verdict: 'bought',
          arrived: row.arrived ?? null,
          arrivedAt: row.arrived ? input.now : null,
          signals: [],
          score: 80,
          createdAt: input.now - row.ageDays * input.day,
          updatedAt: input.now,
        })
      }
      await new Promise((done) => (tx.oncomplete = () => done(null)))
      db.close()
    },
    { rows, dealer: seedDealer.username, now: Date.now(), day: TAG },
  )
}

test.describe('the arrival question', () => {
  /**
   * Ein Haken bei „gekauft" heißt bestellt, nicht angekommen.
   *
   * Deshalb zwei Käufe im selben Seed: einer von gestern, einer von vor einem
   * Monat. Gefragt wird nach genau einer Platte, und es muss die ältere sein —
   * ein Test, der nur „irgendein Kasten steht da" prüft, hielte auch, wenn die
   * Grenze wegfiele.
   */
  test('asks about the record the post could have brought, not yesterday’s', async ({
    page,
  }) => {
    await seed(page)
    await bought(page, [
      { listingId: 9001, ageDays: 1 },
      { listingId: 9002, ageDays: 30 },
    ])

    await page.goto('/')

    const box = page.getByRole('group', { name: /how did .* arrive/i })
    await expect(box).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Journey 9002')).toBeVisible()
    await expect(page.getByText('Journey 9001')).toBeHidden()

    // Beantwortet, und damit weg — es wartet keine zweite reife Platte.
    await box.getByRole('button', { name: 'As described' }).click()
    await expect(box).toBeHidden()
  })

  /**
   * Und von dort zur Zahl im Profil.
   *
   * Unter fünf beurteilten Platten steht bewusst keine Prozentzahl: zwei von
   * zwei sind 100 %, und das liest sich wie ein Urteil über einen Laden, über
   * den man nichts weiß. Also erst vier — keine Quote — und dann die fünfte.
   */
  test('turns answers into a figure on the shop', async ({ page }) => {
    await seed(page)
    await bought(page, [
      { listingId: 9101, ageDays: 30, arrived: 'as-described' },
      { listingId: 9102, ageDays: 30, arrived: 'as-described' },
      { listingId: 9103, ageDays: 30, arrived: 'as-described' },
      { listingId: 9104, ageDays: 30, arrived: 'worse' },
    ])

    await page.goto('/dealers')
    await expect(page.getByText(/4 records judged so far/i)).toBeVisible({ timeout: 15_000 })

    // Die fünfte kommt über die Frage auf der Startseite herein.
    await bought(page, [{ listingId: 9105, ageDays: 30 }])
    await page.goto('/')
    const box = page.getByRole('group', { name: /how did .* arrive/i })
    await expect(box).toBeVisible({ timeout: 15_000 })
    await box.getByRole('button', { name: 'As described' }).click()

    await page.goto('/dealers')
    // Vier von fünf wie beschrieben oder besser.
    await expect(page.getByText(/80 % of 5 records/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/1 was worse than described/i)).toBeVisible()
  })
})
