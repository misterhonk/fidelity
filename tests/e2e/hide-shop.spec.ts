import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * "Never show this one again", and the way back (docs/06 M19 #2).
 *
 * The seed has one scanned shop. Hiding it has to empty the list — and must
 * not take the one place it can be restored from with it, which is the
 * mistake a `v-else` around the whole screen would make.
 */
test('a shop can be hidden, and shown again', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/dealers')

  const list = page.getByRole('list', { name: 'Scanned shops' })
  await expect(list.getByRole('button', { name: 'plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'Hide this shop' }).click()

  /*
   * The way back stands where the hand is (M34.1): one line, bottom left,
   * before the foot of the screen gets a say.
   */
  await expect(list).toHaveCount(0)
  const back = page.getByRole('status').filter({ hasText: 'Plattenkiste hidden.' })
  await expect(back).toBeVisible()
  await back.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('list', { name: 'Scanned shops' }).getByRole('button', {
      name: 'plattenkiste',
    }),
  ).toBeVisible()
  await expect(back).toHaveCount(0)

  await page.getByRole('button', { name: 'Hide this shop' }).click()

  // Gone from the list, present at the foot.
  await expect(page.getByRole('list', { name: 'Scanned shops' })).toHaveCount(0)
  const hidden = page.getByRole('region', { name: 'One shop hidden' })
  await expect(hidden).toBeVisible()
  await expect(hidden.getByText('plattenkiste')).toBeVisible()

  await hidden.getByRole('button', { name: 'Show again' }).click()

  await expect(
    page.getByRole('list', { name: 'Scanned shops' }).getByRole('button', {
      name: 'plattenkiste',
    }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'One shop hidden' })).toHaveCount(0)
})
