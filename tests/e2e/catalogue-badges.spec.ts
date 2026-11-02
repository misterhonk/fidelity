import { expect, test } from './support/test'

import { putRows, seed, seedCollection } from './seed'

/**
 * Catalogue runs as badges on the map (#247): "Brain 1000: 38 of 40", read off
 * the label chunk the horizon already holds — the same run CATALOG_RUN uses.
 */
async function seedBrain(
  page: Parameters<typeof putRows>[0],
  numbers: number[],
  owned: number[],
) {
  const base = seedCollection[0]!
  // Release id = catalogue number.
  const shelf = owned.map((num) => ({
    ...base,
    releaseId: num,
    masterId: 0,
    instanceId: 900_000 + num,
    title: `Brain ${num}`,
    labelIds: [5],
    labelNorms: ['brain'],
    labelNames: ['Brain'],
    catnos: [`brain ${num}`],
  }))

  await putRows(page, {
    collection: shelf,
    horizon: [
      {
        key: 'label:5',
        kind: 'label',
        entityId: 5,
        name: 'Brain',
        fetchedAt: Date.now(),
        complete: true,
        requests: 1,
        catalogueSize: numbers.length,
        releaseIds: Int32Array.from(numbers),
        roles: new Uint8Array(numbers.length),
        years: new Int16Array(numbers.length),
        catnoNums: Int32Array.from(numbers),
        catnoPrefix: 'BRAIN',
      },
    ],
  })
}

test('shows a catalogue run as owned of pressed', async ({ page }) => {
  await seed(page, 'en')
  const numbers = Array.from({ length: 40 }, (_, i) => 1001 + i)
  await seedBrain(page, numbers, numbers.slice(0, 38))

  await page.goto('/insights')
  const runs = page.getByRole('region', { name: 'Catalogue runs' })
  await expect(runs).toBeVisible({ timeout: 15_000 })
  await expect(runs.getByRole('listitem')).toHaveText(['Brain 1000: 38 of 40'])
})

test('names a run below a thousand by the label alone when the prefix repeats it', async ({
  page,
}) => {
  await seed(page, 'en')
  await seedBrain(page, [1, 2, 3, 4, 5], [1, 2, 3])

  await page.goto('/insights')
  const runs = page.getByRole('region', { name: 'Catalogue runs' })
  await expect(runs).toBeVisible({ timeout: 15_000 })
  await expect(runs.getByRole('listitem')).toHaveText(['Brain: 3 of 5'])
})
