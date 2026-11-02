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

/*
 * How long the "why" takes to unfold, or null where it cannot unfold at all.
 *
 * Read off the style, not `getAnimations()`: that list never carries the
 * `::details-content` transition (Chromium 151 — mid-unfold, zero entries),
 * so a poll on it passes on whatever else is moving. Without
 * `interpolate-size` (WebKit 26.5) the height cannot be animated and the
 * answer opens at once, which is the designed fallback.
 */
function unfolding(page: Page) {
  return page
    .locator('section[aria-labelledby="the-wall"] details')
    .first()
    .evaluate((details) =>
      CSS.supports('interpolate-size', 'allow-keywords')
        ? getComputedStyle(details, '::details-content').transitionDuration
        : null,
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
    // One step for every stagger (#313): the tiles' 40 ms.
    expect(delays).toEqual(['0.04s', '0.08s'])

    const duration = await unfolding(page)
    test.skip(duration === null, 'no interpolate-size: the why opens at once by design')
    expect(duration).not.toMatch(/^0s(, 0s)*$/)
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

    // main.css's opt-out cannot reach the pseudo-element; WhyNote's own must.
    const duration = await unfolding(page)
    if (duration !== null) expect(duration).toMatch(/^0s(, 0s)*$/)

    await wall.getByRole('button', { name: / – / }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
    expect(await longest(page)).toBeLessThanOrEqual(1)
  })
})
