import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The stack in a browser.
 *
 * A swipe has no testable shape. It has a gesture, a threshold and a
 * direction, and only a machine with a pointing device knows those — in the
 * source there is a transform, on the screen a card moves.
 * `tests/unit/stack.spec.ts` holds the decisions, this the movement.
 */
test.describe('the stack', () => {
  test('shows one find and moves on', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    // The shop from the seed stands in the top row.
    const row = page.getByRole('button', { name: /plattenkiste/i })
    await expect(row.first()).toBeVisible({ timeout: 15_000 })

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible()
    const first = await position.textContent()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(position).not.toHaveText(first ?? '')
  })

  /**
   * And back, visibly.
   *
   * Tinder can afford a lost no; a rare record cannot.
   */
  test('takes a swipe back', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible({ timeout: 15_000 })
    const start = await position.textContent()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(position).not.toHaveText(start ?? '')

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(position).toHaveText(start ?? '')
  })

  /**
   * The gesture itself, with the threshold.
   *
   * Eighty pixels separate a swipe from a wobble while tapping. A stack that
   * jumps on at every touch is unusable — and that shows up in no unit test,
   * because nobody wobbles there.
   */
  test('ignores a nudge and follows a swipe', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible({ timeout: 15_000 })
    const start = await position.textContent()

    const card = page.locator('[style*="translateX"]')
    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2

    // Too short: nothing happens.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 30, y, { steps: 5 })
    await page.mouse.up()
    await expect(position).toHaveText(start ?? '')

    // Far enough: one card on.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 160, y, { steps: 10 })
    await page.mouse.up()
    await expect(position).not.toHaveText(start ?? '')
  })
})
