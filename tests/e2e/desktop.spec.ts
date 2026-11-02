import { expect, test, type Page } from './support/test'

import { putRows, readRows, seed } from './seed'

/**
 * A desk is not a stretched phone (#230).
 *
 * From 85rem the detail sheet docks: the list stays whole and usable on the
 * left, the record stands on the right, and `j`/`k` walk both at once. The
 * finds come as the dense table unless somebody chose otherwise, and the start
 * page puts its covers beside its words instead of under them.
 *
 * The rest of the suite runs at Playwright's 1280 — under the dock — so the
 * modal drawer keeps its own tests (a11y-pass, list-keys, shelf-walk).
 */
test.use({ viewport: { width: 1440, height: 900 } })

async function moreFinds(page: Page, digId: string) {
  const [first] = await readRows(page, 'matches')
  const matches = Array.from({ length: 8 }, (_, i) => ({
    ...first,
    digId,
    listingId: 900_000 + i,
    releaseId: 910_000 + i,
    artist: `Probe ${i}`,
    title: `Record ${i}`,
    score: 40 - i,
  }))
  await putRows(page, { matches })
}

test('docks the find beside a dense list, and j and k walk both', async ({ page }) => {
  const dig = await seed(page, 'en')
  await page.goto(`/shop?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({ timeout: 15_000 })
  await moreFinds(page, dig.id)
  await page.reload()
  await expect(page.getByRole('heading', { name: '10 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  // Never chosen a density on this device: a desk gets the table.
  await expect(page.getByRole('group', { name: /^Columns/ })).toBeVisible()

  await page.keyboard.press('j')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByText('1 of 10')).toBeVisible()

  // A pane, not a modal: nothing behind it switched off, nothing covered.
  await expect(sheet).not.toHaveAttribute('aria-modal', 'true')
  const list = page.locator('main [data-listing]').first()
  expect(await list.evaluate((row) => row.closest('[inert]') === null)).toBe(true)
  const rowBox = (await list.boundingBox())!
  const sheetBox = (await sheet.boundingBox())!
  expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(sheetBox.x + 1)

  // The list follows the sheet: the record on the right is marked on the left.
  const marked = page.locator('main [data-listing][aria-current="true"]')
  await expect(marked).toHaveCount(1)
  const first = await marked.getAttribute('data-listing')
  await page.keyboard.press('j')
  await expect(sheet.getByText('2 of 10')).toBeVisible()
  await expect(marked).toHaveCount(1)
  await expect(marked).not.toHaveAttribute('data-listing', first!)
  await page.keyboard.press('k')
  await expect(sheet.getByText('1 of 10')).toBeVisible()
  await expect(marked).toHaveAttribute('data-listing', first!)

  // And a click on the list swaps the record without closing anything.
  await page.locator('main [data-listing]').nth(4).getByRole('button').first().click()
  await expect(sheet.getByText('5 of 10')).toBeVisible()
  await expect(marked).toHaveAttribute(
    'data-listing',
    (await page.locator('main [data-listing]').nth(4).getAttribute('data-listing'))!,
  )

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('docks the shelf sheet and leaves the shelf usable', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/collection')
  const items = page.locator('main ul > li')
  await expect(items.first()).toBeVisible({ timeout: 15_000 })
  await items.first().getByRole('button').first().click()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet).not.toHaveAttribute('aria-modal', 'true')

  // The filter beside it still takes typing — under a modal it could not.
  const filter = page.getByPlaceholder('Artist, title or label')
  await filter.fill('Speak')
  await expect(filter).toHaveValue('Speak')
  await expect(sheet).toBeVisible()
})

test('puts the covers beside the words on the start page', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')
  // The page title: the search moved into the nav bar with #228.
  const search = page.getByRole('heading', { level: 1 })
  const rail = page.getByRole('heading', { name: 'Found last time' })
  await expect(rail).toBeVisible({ timeout: 15_000 })

  const left = (await search.boundingBox())!
  const right = (await rail.boundingBox())!
  // Beside, not under: the rail starts right of the title and level with the top.
  expect(right.x).toBeGreaterThan(left.x + left.width)
  expect(right.y).toBeLessThan(left.y + 200)
})
