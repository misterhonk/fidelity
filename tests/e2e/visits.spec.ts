import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The history as the shops' story (M36): one line per shop with the newest
 * full dig and what has happened since, the runs in a fold, and an earlier
 * dig opened says what the shop saw after it.
 */
test('groups the earlier digs by shop, and an old dig says what came since', async ({
  page,
}) => {
  const dig = await seed(page, 'en')
  const day = 86_400_000
  // Sorts before the seed's '01J…' id: the ids are the order of the runs.
  const older = '01H0000000000000000000OLD1'

  // An earlier full dig of the same shop, with two finds, one of them gone since.
  await page.evaluate(
    async ({ id, startedAt, goneAt }) => {
      const request = indexedDB.open('fidelity')
      const db: IDBDatabase = await new Promise((done) => {
        request.onsuccess = () => done(request.result)
      })
      const tx = db.transaction(['digs', 'matches'], 'readwrite')
      const digs = tx.objectStore('digs')
      const matches = tx.objectStore('matches')
      const current: Record<string, unknown> = await new Promise((done) => {
        const all = digs.getAll()
        all.onsuccess = () => done(all.result[0] as Record<string, unknown>)
      })
      digs.put({
        ...current,
        id,
        startedAt,
        finishedAt: startedAt + 1000,
        expiresAt: startedAt + 6 * 3_600_000,
        status: 'expired',
        matchCount: 2,
      })
      digs.put({ ...current, checkedGone: true })
      const first: Record<string, unknown> = await new Promise((done) => {
        const all = matches.getAll()
        all.onsuccess = () => done(all.result[0] as Record<string, unknown>)
      })
      // Two releases, or the sheet's one-per-release fold would keep one.
      matches.put({
        ...first,
        digId: id,
        listingId: 800_001,
        releaseId: 810_001,
        price: null,
        expired: true,
      })
      matches.put({
        ...first,
        digId: id,
        listingId: 800_002,
        releaseId: 810_002,
        price: null,
        expired: true,
        goneAt,
      })
      await new Promise((done) => (tx.oncomplete = done))
      db.close()
    },
    { id: older, startedAt: Date.now() - 9 * day, goneAt: Date.now() - day },
  )

  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })

  // The newer dig against the older one (M36.5): two new, one gone, one still there.
  await page.getByText('Since the visit of', { exact: false }).click()
  await expect(
    page.getByText(/Since the visit of .*: 2 new, 1 gone, 1 still there/),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gone · 1' })).toBeVisible()

  // The field, the shops and the visits sit behind the folded head (M32).
  await page.getByText('Another shop, or an earlier dig').click()
  const visits = page.getByRole('list', { name: 'Your visits' })
  await expect(visits).toBeVisible()
  await expect(visits.getByText('full dig', { exact: false }).first()).toBeVisible()
  // The fold holds both runs of the shop; the older one says what left.
  await expect(visits.getByText('1 of 2 gone since')).toBeVisible()

  await visits.getByRole('button', { name: 'open' }).first().click()
  await expect(page).toHaveURL(new RegExp(`id=${older}`))
  await expect(page.getByText('Since this dig: 0 new, 1 of these gone.')).toBeVisible({
    timeout: 15_000,
  })
  // The plate word leads the card's meta line: "gone · label · format · year".
  await expect(page.getByText(/^gone ·/).first()).toBeVisible()
})
