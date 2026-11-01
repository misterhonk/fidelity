import { expect, test, type Page } from '@playwright/test'

import { settled, signIn } from './seed'

/**
 * A signed-in device that has never dug, watched or bought anywhere.
 *
 * `signIn()` and not `seed()`: `seed()` writes a shop, and this is the one
 * screen where that would hide the case under test. This used to be a seed of
 * its own that put the token in a transaction and navigated away without
 * waiting for it to commit — WebKit then aborted the write now and then, and
 * the screen said "Sign in first" instead (#264). `signIn()` waits for
 * `oncomplete`.
 */
async function signedInWithNoShops(page: Page) {
  await signIn(page)
  await page.goto('/dealers')
  await settled(page)
}

test.describe('the shops screen with nothing on it', () => {
  /*
   * One field, in view (M34.1). The screen used to end in a search box and a
   * folded question about the friends list; both moved to the settings, and
   * what is left is the shortest path: a name.
   */
  test('says so, and offers the one field', async ({ page }) => {
    await signedInWithNoShops(page)

    await expect(page.getByText('No shops yet.')).toBeInViewport({ timeout: 15_000 })
    await expect(page.getByLabel('Add a shop')).toBeVisible()
    await expect(page.getByText('Also read my Discogs friends list?')).toHaveCount(0)

    // And five shops to start with (M34.4), each one lookup away.
    const starters = page.getByRole('region', { name: 'Five shops to start with' })
    await expect(starters).toBeInViewport()
    await expect(starters.getByRole('button', { name: /^Add / })).toHaveCount(5)
    await expect(starters.getByText('Juno Records')).toBeVisible()
  })

  test('keeps the friends question and the search in the settings', async ({ page }) => {
    await signedInWithNoShops(page)
    await page.goto('/settings/search')

    await expect(page.getByRole('checkbox', { name: /friends list as well/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: 'Find shops at Discogs' })).toBeVisible()
  })
})
