import { expect, test, type Page } from './support/test'

import { freshDig, putRows, seed } from './seed'

/**
 * The score as a price sticker, explained once per list (#222).
 *
 * Every card wears "92 · Side One, Track One"; none carries its own question
 * mark, and one "How the score works" stands at the head of each list. The
 * seeded collection has a handful of records, so the small-collection hint is
 * on the screen too.
 */
/** The hint speaks of a collection that has been read through once (#313). */
async function synced(page: Page) {
  await putRows(page, {
    meta: [{ key: 'syncState', value: { collectionSyncedAt: Date.now() } }],
  })
}

test('cards wear a score sticker and the list explains it once', async ({ page }) => {
  const dig = await seed(page, 'en')
  await synced(page)
  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })

  const stickers = page.getByTestId('score-sticker')
  await expect(stickers.first()).toBeVisible()
  // The screen reader's sentence first (sr-only), then the visible "92 · Word".
  await expect(stickers.first()).toHaveText(
    /^\s*Barry Score (\d+) out of 100, (Side One, Track One|Top Five|Solid|Footnote)\s*\1\s*· \2\s*$/,
  )
  expect(await stickers.count()).toBeGreaterThan(1)

  await expect(page.locator('article details')).toHaveCount(0)
  // Once per list: the seeded finds all stand in the top five.
  const fives = page.locator('section[aria-labelledby="the-wall"]')
  await expect(fives.getByText('How the score works')).toHaveCount(1)

  await expect(page.getByTestId('small-collection')).toBeVisible()
})

/*
 * And without finds (#223 review): the hint stands under the finds section,
 * not inside the branch that only renders when there are some. A small
 * collection is the likeliest reason a dig comes back empty.
 */
test('a dig with no finds still says the collection is small', async ({ page }) => {
  await seed(page, 'en')
  await synced(page)
  const dig = { ...freshDig(Date.now()), id: '01J0000000000000000000DIG0', matchCount: 0 }
  await putRows(page, { digs: [dig] })

  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('score-sticker')).toHaveCount(0)
  await expect(page.getByTestId('small-collection')).toBeVisible()
})

/* Never synced: nought records is "not counted yet", not "small" (#313). */
test('a collection that was never synced is not called small', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('score-sticker').first()).toBeVisible()
  await expect(page.getByTestId('small-collection')).toHaveCount(0)
})
