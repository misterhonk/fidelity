import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * Records before sentences (#314).
 *
 * On a phone the start page showed a search field, a link field, two refresh
 * links, a version note and a four-line card before the first cover. Measured
 * at the iPhone size the owner reported it on, signed in, with the version
 * note showing — the most there can be above the fold.
 */
test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the first cover is on the first screen, under at most three lines', async ({
  page,
}) => {
  await seed(page, 'en')
  await page.evaluate(() => localStorage.setItem('fidelity:seen-version', '0.0.1-alt'))
  await page.goto('/')

  // The chip is there, so this is the crowded case and not the quiet one.
  await expect(page.getByText(/updated to/i)).toBeVisible()
  const cover = page.locator('main .fid-rail li').first()
  await expect(cover).toBeVisible()

  // The whole sleeve, above the tab bar that stands over the bottom of a phone.
  const box = await cover.locator('.aspect-square').boundingBox()
  const bar = await page.getByRole('navigation', { name: 'Main sections' }).boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(bar?.y ?? 844)

  /*
   * Lines of body text above it: every rendered line of text that is not a
   * heading or something to press. Distinct line tops, so one sentence that
   * wraps counts twice and a row of three words counts once.
   */
  const lines = await page.evaluate((top) => {
    const main = document.querySelector('main')!
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    const tops = new Set<number>()
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement
      if (!node.textContent?.trim() || !parent) continue
      if (parent.closest('h1, h2, button, a, summary, input, [role="option"]')) continue
      // A closed <details> still lays out its body in Chromium, hidden by content-visibility.
      if (!parent.checkVisibility()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.height > 0 && rect.bottom <= top) tops.add(Math.round(rect.top / 4))
      }
    }
    return tops.size
  }, box!.y)
  expect(lines).toBeLessThanOrEqual(3)
})
