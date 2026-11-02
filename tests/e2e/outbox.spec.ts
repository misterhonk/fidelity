import { expect, test } from './support/test'

import { putRows, readRows, seed, seedCollection } from './seed'

/**
 * The outbox sheet (#238): what has not reached Discogs, by record, with its
 * attempts and last answer; a choice where both sides changed; and the copies
 * a full sync no longer found, with the place each one keeps for 30 days.
 */
test('lists waiting changes by record, asks about a conflict, and names what is gone', async ({
  page,
}) => {
  await seed(page, 'en')
  const speakNoEvil = seedCollection[0]!
  const now = Date.now()

  await putRows(page, {
    // Ours on the shelf is five stars; Discogs started at three and now says four.
    collection: [{ ...speakNoEvil, rating: 5 }],
    outbox: [
      {
        id: `collection.rating:${speakNoEvil.instanceId}`,
        kind: 'collection.rating',
        payload: {
          releaseId: speakNoEvil.releaseId,
          folderId: 1,
          instanceId: speakNoEvil.instanceId,
          rating: 5,
        },
        revert: { rating: 3 },
        attempts: 0,
        queuedAt: now - 60_000,
        conflict: { remote: { rating: 4 }, at: now - 30_000 },
      },
      {
        id: `collection.field:${speakNoEvil.instanceId}:3`,
        kind: 'collection.field',
        payload: {
          releaseId: speakNoEvil.releaseId,
          folderId: 1,
          instanceId: speakNoEvil.instanceId,
          fieldId: 3,
          value: 'Bought in Jena',
        },
        revert: { value: '' },
        attempts: 2,
        queuedAt: now - 50_000,
        lastError: 'offline',
      },
    ],
    places: [{ id: 'crate-3', name: 'Crate 3', parentId: null }],
    placements: [{ instanceId: 7001, placeId: 'crate-3', at: 1 }],
    gone: [
      {
        instanceId: 7001,
        record: { ...seedCollection[1]!, instanceId: 7001, title: 'Maiden Voyage' },
        goneAt: now - 24 * 60 * 60 * 1000,
      },
    ],
  })
  await page.goto('/collection')

  const line = page.getByTestId('outbox-open')
  await expect(line).toHaveText('2 waiting for Discogs · 1 to decide · 1 gone from Discogs', {
    timeout: 15_000,
  })
  await line.click()

  const sheet = page.getByRole('dialog', { name: 'On its way to Discogs' })
  await expect(sheet).toBeVisible()

  // One record, both of its changes under it.
  const record = sheet.locator('li', {
    has: page.getByRole('heading', { name: 'Speak No Evil' }),
  })
  await expect(record.getByText('Rating: ★★★★★')).toBeVisible()
  await expect(record.getByText('Condition or note: Bought in Jena')).toBeVisible()
  // The keeper may have tried once more meanwhile; the count and the answer are what matter.
  await expect(record.getByText(/Tried \d+ times · Last answer: /)).toBeVisible()

  const question = sheet.getByRole('group', {
    name: 'Changed on Discogs too. Which one stays?',
  })
  await expect(question.getByText('★★★★', { exact: true })).toBeVisible()

  const gone = sheet.getByRole('region', { name: 'No longer on Discogs' })
  await expect(gone.getByText('Maiden Voyage')).toBeVisible()
  await expect(gone.getByText(/Keeps Crate 3 until/)).toBeVisible()

  await question.getByRole('button', { name: 'Take Discogs’' }).click()
  await expect(question).toHaveCount(0)

  const shelf = await readRows<{ instanceId: number; rating: number }>(page, 'collection')
  expect(shelf.find((row) => row.instanceId === speakNoEvil.instanceId)?.rating).toBe(4)
  const left = await readRows<{ id: string }>(page, 'outbox')
  expect(left.map((job) => job.id)).toEqual([`collection.field:${speakNoEvil.instanceId}:3`])
})
