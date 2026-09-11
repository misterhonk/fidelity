import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * A year on the shelf (docs/06 M19 #8).
 *
 * The seed's shelf has two records, both added in 2024 — so that is the
 * only year, and the first. A third is written straight into the database
 * here, the way `fair.spec.ts` writes its second stand, so there is an
 * earlier year to switch to.
 */
async function olderRecord(page: Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('collection', 'readwrite')
    tx.objectStore('collection').put({
      instanceId: 990_001,
      folderId: 1,
      releaseId: 1_178_452,
      masterId: 0,
      title: 'Ege Bamyasi',
      artistIds: [1],
      artistNorms: ['can'],
      artistNames: ['Can'],
      labelIds: [5],
      labelNorms: ['united artists records'],
      labelNames: ['United Artists Records'],
      catnos: ['UAS 29 414'],
      genres: ['Rock'],
      styles: ['Krautrock'],
      formats: ['Vinyl', 'LP', 'Album'],
      year: 1972,
      thumbUrl: '',
      coverUrl: '',
      rating: 0,
      addedAt: '2019-03-01T00:00:00-00:00',
    })
    await new Promise((done) => (tx.oncomplete = () => done(null)))
    db.close()
  })
}

test('opens on the latest year and switches to an earlier one', async ({ page }) => {
  await seed(page, 'en')
  await olderRecord(page)
  await page.goto('/review')

  await expect(
    page.getByRole('heading', { level: 1, name: 'A year on the shelf' }),
  ).toBeVisible()
  const chips = page.getByRole('group', { name: 'Which year' })
  await expect(chips.getByRole('button', { name: '2024' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('2 records arrived in 2024.')).toBeVisible()
  await expect(page.getByText('2 artists new to the shelf:')).toBeVisible()
  await expect(page.getByText('Herbie Hancock, Wayne Shorter')).toBeVisible()
  // The pressing years of the additions: both jazz records are from the sixties.
  await expect(
    page.getByText('The oldest pressing to arrive: Herbie Hancock – Maiden Voyage, 1965.'),
  ).toBeVisible()
  await expect(page.getByText('No dig that year.')).toBeVisible()

  await chips.getByRole('button', { name: '2019' }).click()
  await expect(page).toHaveURL(/year=2019/)
  await expect(page.getByText('1 record arrived in 2019.')).toBeVisible()
  await expect(page.getByText('The first year on the shelf.')).toBeVisible()
  await expect(page.getByText('Can', { exact: true }).first()).toBeVisible()
})

test('is the first year, and says so, when there is only one', async ({ page }) => {
  await seed(page, 'de')
  await page.goto('/review')
  await expect(page.getByRole('group', { name: 'Welches Jahr' })).toHaveCount(0)
  await expect(page.getByText('2 Platten kamen 2024 dazu.')).toBeVisible()
  await expect(page.getByText('Das erste Jahr im Regal.')).toBeVisible()
})
