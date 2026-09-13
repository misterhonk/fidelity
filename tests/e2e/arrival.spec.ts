import { expect, test, type Page } from '@playwright/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * "Did it arrive?" in a browser (M14).
 *
 * Two things can be checked here and only here. The first is a condition about
 * time: the question appears only once the post could have been — in the
 * source there is a comparison, on the screen there is a box or there is not.
 * The second is the path from the answer to the number: three buttons on the
 * start page, a rate in the dealer profile, and in between a worker and a
 * database that no unit test runs through together.
 */

const TAG = 24 * 60 * 60 * 1000

/** Writing purchases the way a dig would have left them. */
async function bought(
  page: Page,
  rows: { listingId: number; ageDays: number; arrived?: 'as-described' | 'worse' }[],
) {
  const now = Date.now()
  await putRows(page, {
    feedback: rows.map((row) => ({
      listingId: row.listingId,
      releaseId: row.listingId * 10,
      artist: 'Alice Coltrane',
      title: `Journey ${row.listingId}`,
      dealer: seedDealer.username,
      verdict: 'bought',
      arrived: row.arrived ?? null,
      arrivedAt: row.arrived ? now : null,
      signals: [],
      score: 80,
      createdAt: now - row.ageDays * TAG,
      updatedAt: now,
    })),
  })
}

test.describe('the arrival question', () => {
  /**
   * A tick at "bought" means ordered, not arrived.
   *
   * Hence two purchases in the same seed: one from yesterday, one from a month
   * ago. Exactly one record is asked about, and it has to be the older one — a
   * test that only checks "some box is there" would hold even if the bound
   * disappeared.
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

    // Answered, and therefore gone — no second ripe record is waiting.
    await box.getByRole('button', { name: 'As described' }).click()
    await expect(box).toBeHidden()
  })

  /**
   * And from there to the number in the profile.
   *
   * Below five judged records there is deliberately no percentage: two out of
   * two is 100 %, and that reads like a verdict on a shop one knows nothing
   * about. So four first — no rate — and then the fifth.
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

    // The fifth comes in through the question on the start page.
    await bought(page, [{ listingId: 9105, ageDays: 30 }])
    await page.goto('/')
    const box = page.getByRole('group', { name: /how did .* arrive/i })
    await expect(box).toBeVisible({ timeout: 15_000 })
    await box.getByRole('button', { name: 'As described' }).click()

    await page.goto('/dealers')
    // Four of five as described or better.
    await expect(page.getByText(/80 % of 5 records/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/1 was worse than described/i)).toBeVisible()
  })
})
