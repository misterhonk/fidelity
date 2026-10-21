import { expect, test } from '@playwright/test'

import { putRows, seedCollection, signIn } from './seed'

/**
 * The first dig comes before the lookup (2026-10-21).
 *
 * After the collection, the start page used to send a newcomer to the
 * artist lookup first — about twelve minutes for a typical shelf — and only
 * then to a dig. A dig works without the lookup and is a list in minutes;
 * the lookup makes the next one better. And the empty dig screen offered no
 * shop to start with.
 */
test.beforeEach(async ({ page }) => {
  await signIn(page)
  await putRows(page, { collection: seedCollection })
})

test('with a collection and no dig, the next step is a dig, not the lookup', async ({
  page,
}) => {
  await page.goto('/')
  const next = page.getByRole('region', { name: /dig through the first shop/i })
  await expect(next).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start a dig' })).toHaveAttribute(
    'href',
    /\/dig$/,
  )
})

test('a dig screen with no shops of its own offers some to start with', async ({ page }) => {
  await page.goto('/dig')
  const starters = page.getByRole('navigation', { name: 'Shops to start with' })
  await expect(starters).toBeVisible()
  await starters.getByRole('button', { name: /Juno Records/ }).click()
  await expect(page.locator('main input').first()).toHaveValue('Juno_Records')
})
