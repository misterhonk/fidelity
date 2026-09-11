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

  const list = page.getByRole('navigation', { name: 'Scanned shops' })
  await expect(list.getByRole('button', { name: 'plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'Hide this shop' }).click()

  // Gone from the list, present at the foot.
  await expect(list).toHaveCount(0)
  const hidden = page.getByRole('region', { name: 'One shop hidden' })
  await expect(hidden).toBeVisible()
  await expect(hidden.getByText('plattenkiste')).toBeVisible()

  await hidden.getByRole('button', { name: 'Show again' }).click()

  await expect(
    page.getByRole('navigation', { name: 'Scanned shops' }).getByRole('button', {
      name: 'plattenkiste',
    }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'One shop hidden' })).toHaveCount(0)
})
