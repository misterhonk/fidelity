import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { videoId } from '~/composables/useAudioPreview'

/**
 * The audio preview and the conditions under which ADR-012 allows it.
 *
 * The most important of them is invisible: **before the first deliberate tap,
 * no byte goes to Google** — no script, no frame, no request, not even when
 * the switch has long been thrown. That is the difference between a named
 * exception and a back door, and a running app does not show it.
 */
const COMPOSABLE = readFileSync('app/composables/useAudioPreview.ts', 'utf8')
const PAGE = readFileSync('app/pages/stack.vue', 'utf8')
const CARD = readFileSync('app/components/StackCard.vue', 'utf8')
const DEFAULTS = readFileSync('db/meta.ts', 'utf8')
const LEGAL = readFileSync('app/i18n/legal.ts', 'utf8')

const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('nothing reaches Google before somebody asks', () => {
  /**
   * The script is created **inside a function body**, not at import.
   *
   * A `<script src>` at module level or an `<iframe>` in the template would
   * load as soon as the screen appears — and then the exception would no
   * longer be a decision but a default.
   */
  it('creates the script only inside the function that a tap calls', () => {
    const bare = code(COMPOSABLE)
    expect(bare).toMatch(/function boot\(/)

    const boot = bare.slice(bare.indexOf('function boot('))
    expect(boot).toMatch(/createElement\('script'\)/)

    // And nowhere else — nothing may be created before `boot`.
    const before = bare.slice(0, bare.indexOf('function boot('))
    expect(before).not.toMatch(/createElement|document\.head|new .*Player/)
  })

  /** The template has an empty div and no `<iframe>`. */
  it('has no iframe in the markup', () => {
    expect(code(PAGE)).not.toMatch(/<iframe/i)
    expect(code(CARD)).not.toMatch(/<iframe/i)
    expect(code(PAGE)).toMatch(/ref="mount"/)
  })

  /**
   * And the button appears only when both hold: switch on **and** previews
   * available. A button that plays nothing still loads.
   */
  it('offers the button only when the switch is on and there is something to play', () => {
    expect(code(PAGE)).toMatch(/audioOn\.value && !audio\.failed\.value/)
    expect(code(PAGE)).toMatch(/card\.value\?\.videos\?\.length \?\? 0\) > 0/)
  })
})

/**
 * And the screen does not claim it is *the* record.
 *
 * People enter Discogs' videos: under a 12" there is sometimes an album rip, a
 * live version or a different record. The player shows YouTube's own picture
 * and its own title — without the line below it, that looks as though the two
 * belonged together. Noticed on 2026-09-11, because exactly that impression
 * arose (on a fixture that hung three clips round-robin on every match — but
 * the impression was real).
 */
describe('what is actually playing', () => {
  /**
   * And the frame disappears as soon as nothing is playing.
   *
   * Hung off `armed` — so off whether anybody had ever tapped — it stayed
   * standing after stopping and showed the previous record's still under the
   * new card. A still is not sound, but it claims the same thing.
   */
  it('hides the player as soon as nothing is playing', () => {
    expect(code(PAGE)).toMatch(/v-show="audio\.playing\.value"/)
    expect(code(PAGE)).not.toMatch(/v-show="audio\.armed\.value"/)
  })

  it('names the clip, not the record on the card', () => {
    expect(code(PAGE)).toMatch(/card\.value\?\.videos\?\.\[0\]\?\.title/)
    expect(code(PAGE)).toMatch(/v-if="hearing"/)
  })
})

describe('the switch', () => {
  it('is off to begin with', () => {
    expect(code(DEFAULTS)).toMatch(/audioPreview: false/)
  })

  /** Nothing hangs off it: the stack works completely without sound. */
  it('leaves the stack working without it', () => {
    // The card knows nothing of sound — it shows cover, reason and price.
    expect(code(CARD)).not.toMatch(/audio|youtube/i)
  })
})

describe('the promise that had to change', () => {
  /**
   * The promise is **changed**, not silently stretched.
   *
   * A section of its own with a heading of its own, not half a sentence in the
   * paragraph above — otherwise it would be hidden, and ADR-012 allows the
   * exception on precisely that condition.
   */
  it('says so on the privacy page, in both languages', () => {
    const hits = [...LEGAL.matchAll(/^\s{4}audioBody:$/gm)]
    expect(hits).toHaveLength(2)

    expect(LEGAL).toMatch(/YouTube/)
    // And names what does *not* happen — otherwise the exception sounds bigger
    // than it is.
    expect(LEGAL).toMatch(/collection, wantlist and token stay here/)
    expect(LEGAL).toMatch(/Sammlung, Wantlist und Token bleiben hier/)
  })

  it('is a heading of its own on the page', () => {
    const page = readFileSync('app/pages/privacy.vue', 'utf8')
    expect(page).toMatch(/l\.privacy\.audio\b/)
    expect(page).toMatch(/l\.privacy\.audioBody/)
  })
})

/**
 * And the module's one computation: an id out of a Discogs address.
 *
 * Discogs stores what people have entered — sometimes `watch?v=`, sometimes
 * `youtu.be`. Anything that does not fit must give `null`: a guessed id would
 * play somebody else's video.
 */
describe('reading a video address', () => {
  it('reads the two shapes Discogs actually stores', () => {
    expect(videoId('https://www.youtube.com/watch?v=MpmbntGDyNE')).toBe('MpmbntGDyNE')
    expect(videoId('https://youtu.be/Cawyll0pOI4')).toBe('Cawyll0pOI4')
  })

  it('refuses anything that is not YouTube', () => {
    expect(videoId('https://evil.test/watch?v=abc')).toBeNull()
    // Der naive Test `includes('youtube.com')` fällt auf beide herein.
    expect(videoId('https://www.youtube.com.evil.test/watch?v=abc')).toBeNull()
    expect(videoId('https://evil.test/?a=https://www.youtube.com/watch?v=abc')).toBeNull()
  })

  it('gives null instead of a guess', () => {
    expect(videoId('nicht mal eine adresse')).toBeNull()
    expect(videoId('https://www.youtube.com/')).toBeNull()
  })
})
