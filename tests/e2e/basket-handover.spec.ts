import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The hand-over to Discogs (M20 #9): the cart cannot be filled from here,
 * so the way there is made short — one link at a time, the next one moving
 * up, and the memory of which are done surviving a reload. No network: the
 * links open Discogs in a new tab, which the test catches and closes.
 */
test('hands the basket over one listing at a time and remembers where it was', async ({
  page,
  context,
}) => {
  await seed(page, 'en')
  await page.goto('/basket')

  await page.getByRole('button', { name: 'Put these in at Discogs' }).click()
  await expect(page.getByText('0 of 2 at Discogs')).toBeVisible()

  const first = page.getByRole('link', { name: /Open next at Discogs: Andrew Hill/ })
  await expect(first).toBeVisible()
  const opened = context.waitForEvent('page')
  await first.click()
  await (await opened).close()

  await expect(page.getByText('1 of 2 at Discogs')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Open next at Discogs: Larry Young/ }),
  ).toBeVisible()
  await expect(page.getByText('✓ at Discogs')).toHaveCount(1)

  // Remembered on the item, not in the page.
  await page.reload()
  await expect(page.getByText('1 of 2 at Discogs')).toBeVisible()

  const second = page.getByRole('link', { name: /Open next at Discogs: Larry Young/ })
  const openedAgain = context.waitForEvent('page')
  await second.click()
  await (await openedAgain).close()
  await expect(page.getByText('All 2 records are over there', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: /To the cart at Discogs/ })).toBeVisible()

  // Starting again closes the panel and forgets the ticks; the button is back.
  await page.getByRole('button', { name: 'Start the hand-over again' }).click()
  await expect(page.getByRole('button', { name: 'Put these in at Discogs' })).toBeVisible()
  await expect(page.getByText('✓ at Discogs')).toHaveCount(0)
})
