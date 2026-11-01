import { expect, type Page, test } from './support/test'

import { putRows, readRows, seed } from './seed'

/**
 * The compact table on a phone, and the sheet's way through the finds
 * (2026-09-21, from Martin's iPhone screenshots): the row keeps the record
 * and the price and drops the rest, the rows are there without a scroll,
 * and the arrows and the close button stand on the surface as buttons.
 */
test.use({ viewport: { width: 390, height: 844 } })

/** Enough finds that the long list below the top five exists (as compact-table.spec does). */
async function manyFinds(page: Page, digId: string) {
  const [first] = await readRows(page, 'matches')
  const matches = Array.from({ length: 6 }, (_, i) => ({
    ...first,
    digId,
    listingId: 900_000 + i,
    releaseId: 910_000 + i,
    artist: `Probe ${i}`,
    title: `Record ${i}`,
    score: 40 - i,
    price: 40 - i * 5,
  }))
  await putRows(page, { matches })
}

test('keeps the record readable in a compact row, and the sheet’s arrows visible', async ({
  page,
}) => {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByRole('heading', { name: /finds at/ })).toBeVisible({
    timeout: 15_000,
  })
  await manyFinds(page, dig.id)
  await page.goto(`/dig?id=${dig.id}&density=compact`)
  await expect(page.getByRole('heading', { name: '8 finds at plattenkiste' })).toBeVisible({
    timeout: 15_000,
  })

  const row = page.locator('section[aria-labelledby="all-matches"] ul > li').first()
  await expect(row).toBeVisible()
  const title = row.getByRole('button').first()
  // The record's name has room: not clipped to the two letters the phone showed.
  const fits = await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  expect(fits).toBe(true)
  await expect(title).toHaveText(/Probe \d+ – Record \d+/)
  // The reason and the verdict buttons wait for a wider screen.
  await expect(row.getByRole('group')).toBeHidden()

  await title.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  const next = sheet.getByRole('button', { name: /next/i }).first()
  await expect(next).toBeVisible()
  const border = await next.evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(border).toBe('1px')
  const close = sheet.getByRole('button', { name: /close/i }).first()
  const closeBox = await close.boundingBox()
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44)
})
