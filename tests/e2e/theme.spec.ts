import { devices, expect, test } from '@playwright/test'

/**
 * Hell und dunkel, und was auf einem Telefon passiert.
 *
 * Two things are worth a browser rather than a unit test here. The first is
 * that the theme has to be right *before* the first paint — a class applied
 * after hydration is a white flash on a dark app, and no assertion about the
 * settings screen would catch it. The second is that the light theme was never
 * looked at: every progress track and empty cover was a hard-coded
 * `--fid-n-800`, which is near-black, and on a white page that is a row of
 * dominoes.
 */

/** oklch lightness, pulled out of whatever the browser resolved. */
async function lightnessOf(value: string) {
  const match = /oklch\(\s*([\d.]+)(%?)/.exec(value)
  if (!match) throw new Error(`kein oklch: ${value}`)
  return match[2] === '%' ? Number(match[1]) / 100 : Number(match[1])
}

test.describe('the theme is decided before anything is drawn', () => {
  for (const preference of ['light', 'dark'] as const) {
    test(`a stored "${preference}" is on <html> at first paint`, async ({ page }) => {
      // @nuxtjs/color-mode's own key. The bootstrap script in <head> reads it
      // synchronously, which is the whole anti-flash mechanism.
      await page.addInitScript((value) => {
        localStorage.setItem('nuxt-color-mode', value)
      }, preference)

      await page.goto('/')

      /*
       * Read on `domcontentloaded` rather than after the app settles: if the
       * class only arrived with Vue, this would still pass later and hide the
       * flash it is here to prevent.
       */
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${preference}\\b`))
    })
  }

  /*
   * One context per scheme, rather than one page emulating both.
   *
   * The first attempt flipped the media query on a live page, which tested a
   * race with hydration. The second set it before each `goto` — better, and
   * still flaky about one run in four: `emulateMedia` lands on a page that is
   * already navigating, and the inline script in <head> reads matchMedia
   * before the emulation has taken. `test.use` puts it in the context options,
   * where there is nothing left to race with.
   */
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`with the system set to ${scheme}`, () => {
      test.use({ colorScheme: scheme })

      test('no stored choice follows the operating system', async ({ page }) => {
        await page.goto('/')
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${scheme}\\b`))
      })
    })
  }
})

test.describe('a theme commits in both directions', () => {
  /**
   * Every ground the app paints, including the recessed one.
   *
   * "Lighter than the text" is not the assertion — n-800 clears n-900 and is
   * still a black tile. The bar is that a ground in the light theme is on the
   * light half of the ramp at all, which is exactly what the hard-coded
   * `--fid-n-800` failed.
   */
  const GROUNDS = ['--fid-bg', '--fid-surface', '--fid-surface-raised', '--fid-inset']

  for (const [scheme, side] of [
    ['light', 'above'],
    ['dark', 'below'],
  ] as const) {
    test(`in ${scheme} mode every ground sits ${side} the middle`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('nuxt-color-mode', value)
      }, scheme)

      await page.goto('/')
      await expect(page.locator('main')).toBeVisible()

      const grounds = await page.evaluate((names) => {
        const style = getComputedStyle(document.documentElement)
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]))
      }, GROUNDS)

      for (const [name, value] of Object.entries(grounds)) {
        const lightness = await lightnessOf(value)
        if (scheme === 'light') expect(lightness, `${name} im Hellmodus`).toBeGreaterThan(0.5)
        else expect(lightness, `${name} im Dunkelmodus`).toBeLessThan(0.5)
      }
    })
  }

  test('the browser chrome is repainted with it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nuxt-color-mode', 'light'))
    await page.goto('/')

    // The manifest can only name one theme_color, so the tag has to move.
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#faf8f6')
  })
})

/*
 * The iPhone profile minus its browser choice — `defaultBrowserType` cannot be
 * set per describe block, and the projects already pin the engines. What is
 * wanted from it here is the touch flag: `pointer: coarse` is the condition the
 * field rule is written against.
 */
const { defaultBrowserType: _engine, ...IPHONE } = devices['iPhone 15']

test.describe('on a phone', () => {
  test.use(IPHONE)

  test('no field is small enough to make iOS zoom in', async ({ page }) => {
    await page.goto('/')

    /*
     * Two fields now, and both matter: the demo's on the landing page, and the
     * token behind the setup button. The token one is the reason this test
     * exists — Safari zoomed on it and never zoomed back — but the demo field
     * is the first one a stranger touches.
     */
    const demoField = page.locator('#demo-url')
    // Behind a summary now: the covers are the invitation and the paste field
    // is for the minority who arrive with a URL already in hand.
    await page.getByText('Oder einen eigenen Discogs-Link einfügen').click()
    await expect(demoField).toBeVisible()
    expect(
      await demoField.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16)

    await page.getByRole('button', { name: /Einrichten/ }).click()
    const field = page.locator('#discogs-token')
    await expect(field).toBeVisible()

    /*
     * Under 16px, Safari zooms the page on focus and never zooms back out —
     * which is what entering the token used to do. The alternative fix is
     * `maximum-scale=1`, which kills pinch-to-zoom app-wide and fails
     * WCAG 2.2 SC 1.4.4, so the floor lives on the fields instead.
     */
    const size = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(16)
  })

  test('double-tap zoom is off, pinch zoom is not', async ({ page }) => {
    await page.goto('/')

    const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction)

    // `manipulation` removes double-tap and nothing else. `none` or
    // `pan-x pan-y` would take pinch with it.
    expect(touchAction).toBe('manipulation')

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/)
    expect(viewport).not.toMatch(/maximum-scale/)
  })
})
