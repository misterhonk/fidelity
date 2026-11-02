import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * The dig page, results first (#223).
 *
 * The shop's finds open the page; the field, the shops and the earlier visits
 * fold into segments beside them. On a phone the first find stands above the
 * fold, the head says how much of the shop was read and until when its prices
 * may be shown (rule 4), and nothing apologises for a hub nobody set up.
 */
test.use({ viewport: { width: 390, height: 844 } })

test('opens on the finds, with the tools one segment away', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}`)

  const head = page.getByRole('heading', { level: 1, name: /finds at plattenkiste/ })
  await expect(head).toBeVisible({ timeout: 15_000 })

  // The freshness clock: how long these prices may still be shown.
  await expect(page.getByTestId('freshness')).toHaveText(/prices until/)

  // The first find of the wall, above the fold.
  const first = page.locator('section[aria-labelledby="the-wall"] article').first()
  await expect(first).toBeVisible()
  const top = await first.evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeLessThan(844)
  // The title, after the sleeve: both are named "artist – title".
  const title = first.getByRole('button', { name: / – / }).last()
  const bottom = await title.evaluate((el) => el.getBoundingClientRect().bottom)
  expect(bottom).toBeLessThan(844)

  // No apology for a hub.
  await expect(page.getByText('Sharing needs a hub')).toHaveCount(0)

  // The question is one segment away, and the finds step aside for it.
  const field = page.getByLabel('Shop name or link')
  await expect(field).toBeHidden()
  const segments = page.getByRole('group', { name: 'This dig' })
  await segments.getByRole('button', { name: 'Shop' }).click()
  await expect(field).toBeVisible()
  await expect(first).toBeHidden()

  await segments.getByRole('button', { name: 'Visits' }).click()
  await expect(page.getByRole('list', { name: 'Your visits' })).toBeVisible()

  await segments.getByRole('button', { name: 'Finds' }).click()
  await expect(first).toBeVisible()
})

/* The keys and the deep link follow the segment that is up (#313). */
test('j opens a find only while the finds are up', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { level: 1, name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })
  const segments = page.getByRole('group', { name: 'This dig' })
  await segments.getByRole('button', { name: 'Shop' }).click()
  await expect(page.getByLabel('Shop name or link')).toBeVisible()
  await page.keyboard.press('j')

  // Back on the finds the same key opens one — so nothing above was a lost key.
  await segments.getByRole('button', { name: 'Finds' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('j')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
})

test('a ?dealer= link opens on the Shop segment with its name filled in', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}&dealer=someshop`)
  const field = page.getByLabel('Shop name or link')
  await expect(field).toBeVisible({ timeout: 15_000 })
  await expect(field).toHaveValue('someshop')
})
