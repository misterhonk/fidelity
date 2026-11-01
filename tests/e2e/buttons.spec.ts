import AxeBuilder from '@axe-core/playwright'
import { devices, expect, test, type Page } from './support/test'

import { seed } from './seed'

/**
 * The four-tier button (#221), measured where it matters: under a thumb.
 *
 * The iPhone profile minus its browser choice, as in theme.spec — what is
 * wanted is `pointer: coarse`, the condition the 44 px rule is written against.
 */
const { defaultBrowserType: _engine, ...IPHONE } = devices['iPhone 15']

async function undersized(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    if (!matchMedia('(pointer: coarse)').matches) return ['pointer is not coarse']
    // Every button, not only FidButtons: a raw <button> beside them is just as hard to hit.
    return [...document.querySelectorAll('button, [role="button"], .fid-button')]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(
        ({ el, box }) =>
          `${Math.round(box.width)}×${Math.round(box.height)} ${(el.textContent ?? '').trim()}`,
      )
  })
}

test.describe('on a phone', () => {
  test.use(IPHONE)

  for (const [path, ready] of [
    ['/basket', 'Remove Larry Young — Unity'],
    ['/wantlist', 'Take Stereolab — Sound-Dust off the wantlist'],
  ] as const) {
    test(`${path}: every button is at least 44 × 44`, async ({ page }) => {
      await seed(page, 'en')
      await page.goto(path)
      await expect(page.getByRole('button', { name: ready })).toBeVisible({ timeout: 15_000 })

      expect(await undersized(page)).toEqual([])
    })
  }
})

test('a removed basket line comes back with the undo line', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/basket')

  await page.getByRole('button', { name: 'Remove Larry Young — Unity' }).click()
  const toast = page.getByRole('status').filter({ hasText: 'is out of the basket' })
  await expect(toast).toHaveText(/Larry Young — Unity is out of the basket\./)
  await expect(page.getByRole('button', { name: 'Remove Larry Young — Unity' })).toHaveCount(0)

  const { violations } = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Remove Larry Young — Unity' })).toBeVisible()
  await expect(toast).toHaveCount(0)
})

test('a want taken off the list comes back with the undo line', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/wantlist')

  const drop = page.getByRole('button', {
    name: 'Take Stereolab — Sound-Dust off the wantlist',
  })
  await drop.click()
  const toast = page.getByRole('status').filter({ hasText: 'off the wantlist' })
  await expect(toast).toBeVisible()
  await expect(drop).toHaveCount(0)

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(drop).toBeVisible()
})
