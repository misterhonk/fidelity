import { expect, test, type Page } from './support/test'

import { seed } from './seed'

/**
 * The motion pass (#226): finds cascade in, the "why" unfolds, the cover grows
 * into the sheet — and somebody who asked not to be moved gets none of it.
 */

/** The longest animation or transition running on the page, in ms. */
function longest(page: Page) {
  return page.evaluate(() =>
    Math.max(
      0,
      ...document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)),
    ),
  )
}

async function openDig(page: Page) {
  const dig = await seed(page, 'en')
  await page.goto(`/dig?id=${dig.id}`)
  const wall = page.locator('section[aria-labelledby="the-wall"]')
  await expect(wall.locator('article').first()).toBeVisible({ timeout: 15_000 })
  return wall
}

test.describe('with motion', () => {
  test('finds arrive one after another, and the why unfolds', async ({ page }) => {
    const wall = await openDig(page)

    // The stagger grows with the place in the list.
    const delays = await wall
      .locator('li.fid-cascade')
      .evaluateAll((items) =>
        items.slice(0, 2).map((li) => getComputedStyle(li).transitionDelay),
      )
    expect(delays).toEqual(['0.03s', '0.06s'])

    const why = wall.locator('details').first()
    await why.locator('summary').click()
    await expect(why).toHaveAttribute('open', '')
    await expect.poll(() => longest(page)).toBeGreaterThan(1)
  })

  /*
   * The sheet's cover is drawn only once its record has been read, so the new
   * picture has to wait for it — taken a tick early it had no cover in it and
   * nothing grew anywhere. Chromium only: it is where `getAnimations()` lists
   * the view-transition pseudo-elements.
   */
  test('the cover grows into the sheet', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'view-transition animations are listed in Chromium')
    const wall = await openDig(page)

    await page.evaluate(() => {
      const seen = new Set<string>()
      Object.assign(window, { __seen: seen })
      const look = () => {
        for (const a of document.getAnimations()) {
          const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement
          if (pseudo) seen.add(pseudo)
        }
        requestAnimationFrame(look)
      }
      look()
    })
    await wall.getByRole('button', { name: / – / }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(() =>
        page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen]),
      )
      .toContain('::view-transition-group(fid-cover)')
  })
})

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('everything happens at once', async ({ page }) => {
    const wall = await openDig(page)
    expect(await longest(page)).toBeLessThanOrEqual(1)

    await wall.locator('details').first().locator('summary').click()
    expect(await longest(page)).toBeLessThanOrEqual(1)

    await wall.getByRole('button', { name: / – / }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
    expect(await longest(page)).toBeLessThanOrEqual(1)
  })
})
