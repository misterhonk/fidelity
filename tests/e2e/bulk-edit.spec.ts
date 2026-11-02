import { expect, test } from './support/test'

import { putRows, readRows, seed, seedCollection } from './seed'

/**
 * Bulk edit (#237): tick with `x` and shift-click, change them all, see what
 * it costs, and take all of it back.
 *
 * Discogs answers 401 here (seed.ts), so the nudge after the change is refused
 * and every job is still only ours when "Undo all" comes: it cancels them, and
 * nothing is left waiting.
 */
test('rates a run of records at once, says what it costs, and undoes all of it', async ({
  page,
}) => {
  await seed(page, 'en')
  const base = seedCollection[0]!
  const titles = ['Alpha', 'Beta', 'Gamma']
  await putRows(page, {
    // Newest first on the shelf, so the three stand in a row ahead of the seed.
    collection: titles.map((title, index) => ({
      ...base,
      releaseId: 7_700_001 + index,
      title,
      rating: 0,
      instanceId: 977_000_001 + index,
      addedAt: `2025-06-0${3 - index}T10:00:00-00:00`,
    })),
  })
  await page.goto('/collection')

  const tile = (title: string) =>
    page.locator('main ul > li', { hasText: title }).getByRole('button').first()
  await expect(tile('Gamma')).toBeVisible({ timeout: 15_000 })

  // x ticks the record in focus and opens select mode; shift-click ticks the run to Gamma.
  await tile('Alpha').focus()
  await page.keyboard.press('x')
  await expect(page.getByText('1 selected')).toBeVisible()
  await tile('Gamma').click({ modifiers: ['Shift'] })
  await expect(page.getByText('3 selected')).toBeVisible()

  // The box shows the selection: a shift-click on a ticked one keeps it ticked, a plain click unticks it.
  const box = page.getByRole('checkbox', { name: /Beta$/ })
  await box.click({ modifiers: ['Shift'] })
  await expect(box).toBeChecked()
  await expect(page.getByText('3 selected')).toBeVisible()
  await box.click()
  await expect(box).not.toBeChecked()
  await expect(page.getByText('2 selected')).toBeVisible()
  await box.click()
  await expect(box).toBeChecked()
  await expect(page.getByText('3 selected')).toBeVisible()

  await page.getByRole('combobox', { name: 'Rating' }).selectOption('5')

  const line = page.getByRole('status').filter({ hasText: 'changes' })
  await expect(line).toContainText('3 changes · under a minute in the background')
  const rated = async () =>
    (await readRows<{ instanceId: number; rating: number }>(page, 'collection'))
      .filter((row) => row.instanceId >= 977_000_001)
      .map((row) => row.rating)
  await expect.poll(rated).toEqual([5, 5, 5])
  // The nudge has been refused, so no job is on its way any more (one on its way gets a reversal instead).
  await expect
    .poll(async () =>
      (await readRows<{ attempts: number }>(page, 'outbox')).some((job) => job.attempts > 0),
    )
    .toBe(true)

  await line.getByRole('button', { name: 'Undo all' }).click()
  await expect(line).toBeHidden()
  await expect.poll(rated).toEqual([0, 0, 0])
  // Cancelled, not reversed: nothing is left to send.
  await expect.poll(async () => (await readRows(page, 'outbox')).length).toBe(0)
})
