import { expect, test } from './support/test'

import { putRows, seed, seedCollection } from './seed'

/**
 * Catalogue runs as badges on the map (#247): "Brain 1000: 38 of 40", read off
 * the label chunk the horizon already holds — the same run CATALOG_RUN uses.
 */
test('shows a catalogue run as owned of pressed', async ({ page }) => {
  await seed(page, 'en')

  const numbers = Array.from({ length: 40 }, (_, i) => 1001 + i)
  const base = seedCollection[0]!
  // Release id = catalogue number, so 38 of the 40 sit on the shelf.
  const shelf = numbers.slice(0, 38).map((num) => ({
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
        catalogueSize: 40,
        releaseIds: Int32Array.from(numbers),
        roles: new Uint8Array(numbers.length),
        years: new Int16Array(numbers.length),
        catnoNums: Int32Array.from(numbers),
        catnoPrefix: 'BRAIN',
      },
    ],
  })

  await page.goto('/insights')
  const runs = page.getByRole('region', { name: 'Catalogue runs' })
  await expect(runs).toBeVisible({ timeout: 15_000 })
  await expect(runs.getByRole('listitem')).toHaveText(['Brain 1000: 38 of 40'])
})
