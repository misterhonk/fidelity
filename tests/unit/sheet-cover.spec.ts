import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The cover in the two sheets: as large as it goes, and with no false promise.
 *
 * Both were measured on 2026-08-14, and both measurements contradict what the
 * source said before:
 *
 * 1. **There is no sharper image.** `images[0]` from `/releases/{id}` is the
 *    same version as `cover_image`, and the CDN path is signed — rewritten to
 *    `h:1200/w:1200` it answers 403. Showing the cover larger means upscaling;
 *    that is the deliberate decision, not an oversight.
 *
 * 2. **`600w` was a lie.** The CDN fits into a 600 square without inflating:
 *    release 512 comes out as 313 × 238. The `w` descriptor is a promise about
 *    actual width, and that promise did not hold for any cover whose original
 *    is smaller.
 *
 * The 150 candidate beside it was never picked anyway: in these screens'
 * narrowest case — 320 px of window, 100vw, 2× — the browser needs 640 device
 * pixels and, measured, picks the cover. Two candidates, one of which never
 * wins, are a choice without a choice.
 *
 * The shape is what is checked, because there is no computation here: `srcset`
 * is markup, and what can go wrong with it is a line coming back.
 */
const SHELF = readFileSync('app/components/ShelfSheet.vue', 'utf8')
const RELEASE = readFileSync('app/components/ReleaseSheet.vue', 'utf8')

/** Without comments — this file explains what it checks, and so do the sheets. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

describe.each([
  ['the shelf sheet', SHELF],
  ['the release sheet', RELEASE],
])('%s', (_name, source) => {
  /**
   * No `srcset`, and therefore no promise about width that nobody keeps.
   *
   * The alternative would be to carry the real dimensions along — `images[0]`
   * supplies `width` and `height`. That costs a field in the cover store and
   * so a schema version, for a choice between two candidates whose outcome is
   * already settled.
   */
  it('makes no promise about a width it cannot keep', () => {
    expect(code(source)).not.toMatch(/srcset/)
    expect(code(source)).not.toMatch(/600w/)
    // `sizes` without `srcset` does nothing and reads as though it did something.
    expect(code(source)).not.toMatch(/\bsizes=/)
  })

  /**
   * The largest image available, and the 150 only where there is none.
   *
   * Pinned to `:src` and not merely to an occurrence: `v-if="… coverUrl ||
   * … thumbUrl"` stands a line above and satisfies any looser pattern along
   * with it. A mutation probe showed exactly that — `:src` switched to the
   * thumbnail, and the test stayed green because it was reading the other
   * line.
   */
  it('shows the cover, and falls back to the thumb only when there is none', () => {
    expect(code(source)).toMatch(/:src="\w+\.coverUrl \|\| \w+\.thumbUrl"/)
  })

  /**
   * And it is still not fetched actively.
   *
   * Images have their own limit at Cloudflare (~30–40/min, `docs/02`), running
   * separately from the API budget. `loading="lazy"` is the rule under which
   * the app may show covers at all — a larger image changes nothing about
   * that.
   */
  it('still waits to be scrolled into view', () => {
    expect(code(source)).toMatch(/loading="lazy"/)
  })
})

/**
 * The sizes themselves, so that shrinking stays a decision.
 *
 * Measured in the browser on 2026-08-14: sheet 768 px from 1280 px of window,
 * cover inside it 384 px on the shelf and 320 px in the find list. The shelf
 * sheet may be larger — it has only the facts list beside it, and at 319 px
 * that kept every line to one line.
 */
describe('the cover sizes', () => {
  it('grows with the sheet instead of staying at the phone size', () => {
    expect(SHELF).toMatch(/sm:size-56 sm:w-56 lg:size-80 lg:w-80 xl:size-96 xl:w-96/)
    expect(RELEASE).toMatch(/sm:size-56 sm:w-56 lg:size-72 lg:w-72 xl:size-80 xl:w-80/)
  })

  /** And the sheet itself has the room for it — or the cover would be the sheet. */
  it('has a sheet wide enough to hold it', () => {
    for (const source of [SHELF, RELEASE]) {
      expect(source).toMatch(/max-w-lg .*lg:max-w-2xl xl:max-w-3xl/)
    }
  })
})
