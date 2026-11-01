import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * The score as a price sticker, explained once per list (#222).
 *
 * Every card wears "92 · Side One, Track One"; none carries its own question
 * mark, and one "How the score works" stands at the head of each list. The
 * seeded collection has a handful of records, so the small-collection hint is
 * on the screen too.
 */
test('cards wear a score sticker and the list explains it once', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
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
  const fives = page.locator('section[aria-labelledby="top-five"]')
  await expect(fives.getByText('How the score works')).toHaveCount(1)

  await expect(page.getByTestId('small-collection')).toBeVisible()
})
