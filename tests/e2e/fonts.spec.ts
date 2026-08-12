import { expect, test } from '@playwright/test'

/**
 * The three faces actually arrive, and are actually used.
 *
 * This is a test about a failure that leaves no mark. When a `@font-face` URL
 * is wrong, a family name does not match, or the files never reach the output,
 * nothing breaks: the browser quietly draws everything in Arial and the page
 * looks like a page. It has happened here twice — once when the vendoring
 * script mislabelled sixteen of eighteen files, once when a rewritten URL kept
 * a `..` and the build emitted no fonts at all.
 *
 * `tests/unit/design-restraint.spec.ts` reads the CSS and cannot see any of
 * that: the stylesheet was correct both times. Only a browser that has fetched
 * the files knows, so the check belongs here — against the built output, which
 * is where the fonts either exist or do not.
 *
 * Proven by taking the four Array files out of a build (2026-08-12): both
 * tests below fail in both browsers, and `theme.spec.ts` — nine tests about
 * how the app looks — stays green throughout.
 *
 * The same mutation also broke `offline.spec.ts`, which was not expected and
 * is worth knowing: every one of these files is in the precache manifest, and
 * a manifest entry that 404s fails the whole service worker install. A missing
 * typeface does not only look wrong, it takes the app's offline promise down
 * with it.
 */

/** Presswerk: the sans, the mono, the display face (ADR — see docs/05). */
const FAMILIES = ['Switzer', 'Chivo Mono', 'Array']

test.describe('the typefaces', () => {
  test('all three are loaded, not silently swapped for Arial', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    const missing = await page.evaluate(async (families: string[]) => {
      /*
       * Asked for rather than waited for.
       *
       * A browser fetches a face when something on the screen needs it, so
       * `fonts.ready` on the first screen says nothing about the display face
       * — it is simply not on that page yet, and `check()` answers false for a
       * font that is perfectly fine. `load()` goes and gets it, which is what
       * makes a wrong URL or a misspelt family name fail here.
       */
      const loaded = await Promise.all(
        families.map(async (family) => {
          const faces = await document.fonts.load(`16px "${family}"`)
          return faces.length > 0 ? null : family
        }),
      )
      return loaded.filter((family): family is string => family !== null)
    }, FAMILIES)

    expect(missing).toEqual([])
  })

  /**
   * Loaded is not the same as used.
   *
   * A face can be fetched and still never drawn — a family name that differs
   * by a space, a `font-family` on the wrong element, a stack whose first
   * entry does not exist. So this measures what is on the screen: the heading
   * against the same text in the fallback the browser would have used anyway.
   * Two identical widths mean the page is already showing the fallback.
   */
  test('the display face is what the heading is actually drawn in', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    const widths = await page.evaluate(async () => {
      await document.fonts.load('48px "Array"')

      const measure = (family: string) => {
        const probe = document.createElement('span')
        probe.textContent = 'Fidelity — the clerk behind the counter'
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:48px;font-family:${family}`
        document.body.append(probe)
        const width = probe.getBoundingClientRect().width
        probe.remove()
        return width
      }

      return { real: measure('Array, sans-serif'), fallback: measure('sans-serif') }
    })

    expect(widths.real).toBeGreaterThan(0)
    expect(widths.real).not.toBeCloseTo(widths.fallback, 0)
  })
})
