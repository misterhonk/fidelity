import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

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
const SECTION = readFileSync('app/components/ListenSection.vue', 'utf8')
const DEFAULTS = readFileSync('db/meta.ts', 'utf8')
const LEGAL = readFileSync('app/i18n/legal.ts', 'utf8')

describe('nothing reaches Google before somebody asks', () => {
  /**
   * The script is created **inside a function body**, not at import.
   *
   * A `<script src>` at module level or an `<iframe>` in the template would
   * load as soon as the screen appears — and then the exception would no
   * longer be a decision but a default.
   */
  it('creates the script only inside the function that a tap calls', () => {
    const bare = withoutComments(COMPOSABLE)
    expect(bare).toMatch(/function boot\(/)

    const boot = bare.slice(bare.indexOf('function boot('))
    expect(boot).toMatch(/createElement\('script'\)/)

    // And nowhere else — nothing may be created before `boot`.
    const before = bare.slice(0, bare.indexOf('function boot('))
    expect(before).not.toMatch(/createElement|document\.head|new .*Player/)
  })

  /** The template has an empty div and no `<iframe>`. */
  it('has no iframe in the markup', () => {
    expect(withoutComments(PAGE)).not.toMatch(/<iframe/i)
    expect(withoutComments(CARD)).not.toMatch(/<iframe/i)
    expect(withoutComments(SECTION)).not.toMatch(/<iframe/i)
    expect(withoutComments(PAGE)).toMatch(/ref="mount"/)
    expect(withoutComments(SECTION)).toMatch(/ref="mount"/)
  })

  /**
   * And the button appears only when both hold: switch on **and** previews
   * available. A button that plays nothing still loads.
   */
  it('offers the button only when the switch is on and there is something to play', () => {
    expect(withoutComments(PAGE)).toMatch(/audioOn\.value && !audio\.failed\.value/)
    expect(withoutComments(PAGE)).toMatch(/card\.value\?\.videos\?\.length \?\? 0\) > 0/)
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
    expect(withoutComments(PAGE)).toMatch(/v-show="audio\.playing\.value"/)
    expect(withoutComments(PAGE)).not.toMatch(/v-show="audio\.armed\.value"/)
  })

  it('names the clip, not the record on the card', () => {
    expect(withoutComments(PAGE)).toMatch(/card\.value\?\.videos\?\.\[0\]\?\.title/)
    expect(withoutComments(PAGE)).toMatch(/v-if="hearing"/)
  })
})

describe('the switch', () => {
  it('is off to begin with', () => {
    expect(withoutComments(DEFAULTS)).toMatch(/audioPreview: false/)
  })

  /** Nothing hangs off it: the stack works completely without sound. */
  it('leaves the stack working without it', () => {
    // The card knows nothing of sound — it shows cover, reason and price.
    expect(withoutComments(CARD)).not.toMatch(/audio|youtube/i)
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
    // The naive check `includes('youtube.com')` falls for both.
    expect(videoId('https://www.youtube.com.evil.test/watch?v=abc')).toBeNull()
    expect(videoId('https://evil.test/?a=https://www.youtube.com/watch?v=abc')).toBeNull()
  })

  it('gives null instead of a guess', () => {
    expect(videoId('not even an address')).toBeNull()
    expect(videoId('https://www.youtube.com/')).toBeNull()
  })
})

/**
 * The same conditions, on the two sheets where a record is actually decided
 * about (M31).
 *
 * The stack had the sound and the sheets had a search link — so the screen
 * where somebody weighs up a find was the one screen that could not play it.
 * Moving it there changes nothing about ADR-012, and this says so.
 */
describe('the same exception on the sheets', () => {
  const bare = withoutComments(SECTION)

  /**
   * The switch decides the *kind of element*, not just whether it works.
   *
   * With the preview off the clip is an ordinary link to YouTube — the reader
   * navigates there themselves, which is what ADR-012 says happens without the
   * switch. Only with it on is there a button that embeds anything.
   */
  it('offers a button only with the switch on, and a link without it', () => {
    /*
     * Two places now: a play control on a track that has a clip, and the
     * loose recordings underneath. Both have to make the same promise — a
     * button that embeds only where the switch is on, and an ordinary link
     * out where it is not.
     */
    expect(bare).toMatch(/v-if="onTracks\.perTrack\[index\] && preview"/)
    expect(bare).toMatch(/v-else-if="onTracks\.perTrack\[index\]"/)
    expect(bare).toMatch(/<button\s+v-if="preview"/)

    // Every `v-else` alternative is a link that leaves the app, properly
    // detached from this window.
    const links = [...bare.matchAll(/<a\n\s+v-else[^>]*>/gs)]
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const [markup] of links) {
      expect(markup).toMatch(/rel="noopener noreferrer"/)
      expect(markup).toMatch(/target="_blank"/)
    }
  })

  /** And that switch is read from the preferences, not assumed. */
  it('reads the switch rather than assuming it', () => {
    expect(bare).toMatch(/preview\.value = prefs\.audioPreview/)
    expect(bare).toMatch(/const preview = ref\(false\)/)
  })

  it('shows the frame only while something plays', () => {
    expect(bare).toMatch(/v-show="audio\.playing\.value"/)
  })

  /**
   * And hands the player back when the sheet closes.
   *
   * A sheet takes its element with it. The frame goes too, but the player
   * object does not know that — the next tap would load into a frame that is
   * no longer in the document, and what was playing could never be stopped.
   */
  it('releases the player when the sheet goes', () => {
    expect(bare).toMatch(/onBeforeUnmount\(\(\) => audio\.release\(mount\.value\)\)/)
    expect(withoutComments(PAGE)).toMatch(
      /onBeforeUnmount\(\(\) => audio\.release\(mount\.value\)\)/,
    )
  })

  /**
   * One player, not one per screen.
   *
   * The state used to be created inside `useAudioPreview()`, so every caller
   * had its own. Harmless while the stack was the only one — wrong the moment
   * a sheet offers the same button, because then one screen says "playing"
   * over a frame the other one thinks it owns.
   */
  it('keeps one player for the whole app', () => {
    const module = withoutComments(COMPOSABLE)
    const setup = module.slice(module.indexOf('export function useAudioPreview'))
    expect(setup).not.toMatch(/ref\(false\)|ref<string \| null>/)
    expect(module).toMatch(/^const playing = ref<string \| null>\(null\)$/m)
  })

  /**
   * And it says where the sound comes from.
   *
   * The picker above it can say Deezer while the clip below it is YouTube's —
   * they are two different things, and a screen that shows them together owes
   * the reader that difference.
   */
  it('names YouTube even when the picker says something else', () => {
    expect(bare).toMatch(/m\.listen\.source/)
    const en = readFileSync('app/i18n/en.ts', 'utf8')
    const de = readFileSync('app/i18n/de.ts', 'utf8')
    expect(en).toMatch(/source: 'Playing from YouTube'/)
    expect(de).toMatch(/source: 'Läuft über YouTube'/)
  })
})

/**
 * And the one request this feature is allowed to spend.
 *
 * A dig fills `videos[]` for the top fifty and nothing below. Looking one up
 * is the same bargain the covers make — one release, once, for something on
 * the screen — and it must stay that: a lookup per row of a list would be rule
 * 2 by another name.
 */
describe('looking up the clips a find came without', () => {
  const bare = withoutComments(SECTION)

  it('asks only when the caller handed over nothing', () => {
    const mounted = bare.slice(bare.indexOf('onMounted'))
    expect(mounted).toMatch(/if \(props\.videos\?\.length \|\| !props\.releaseId\) return/)
  })

  it('asks for one release, not for a list of them', () => {
    const calls = [...bare.matchAll(/call\('([^']+)'/g)].map((match) => match[1])
    expect(calls).toEqual(['preferences.get', 'release.detail'])
    expect(bare).toMatch(/releaseId: props\.releaseId/)
  })

  /** And says it is happening, rather than showing an empty block. */
  it('says that it is asking', () => {
    expect(bare).toMatch(/v-if="asking"/)
    expect(bare).toMatch(/aria-live="polite"/)
  })

  /** A refusal is a shorter section, not an error on the screen. */
  it('treats a refusal as no clips', () => {
    const caught = bare.slice(bare.indexOf('} catch {'), bare.indexOf('} finally {'))
    expect(caught).toMatch(/found\.value = \[\]/)
  })
})

/**
 * One row per video, not one per address.
 *
 * Discogs stores what people entered, and the same clip gets entered twice —
 * `youtube.com/watch?v=X` and `youtu.be/X` are one video and were two rows.
 * Reported on 2026-09-14 as links turning up twice, on a record with fourteen
 * of them.
 */
describe('the clip list', () => {
  const bare = withoutComments(SECTION)

  it('counts videos rather than addresses', () => {
    // The two shapes resolve to one id — which is the whole point of the
    // deduplication, and is checked against the same function the list uses.
    expect(videoId('https://www.youtube.com/watch?v=Cawyll0pOI4')).toBe(
      videoId('https://youtu.be/Cawyll0pOI4'),
    )
    expect(bare).toMatch(/const id = videoId\(video\.uri\) \?\? video\.uri/)
    expect(bare).toMatch(/seen\.has\(id\)/)
  })

  /** And the cut is the component's, so both sheets show the same record. */
  it('cuts at six wherever it is used, and says so', () => {
    expect(bare).toMatch(/const LIMIT = 6/)
    expect(bare).toMatch(/\.slice\(0, LIMIT\)/)
    expect(bare).toMatch(/v-if="looseTotal > loose\.length"/)

    const shelf = withoutComments(readFileSync('app/components/ShelfSheet.vue', 'utf8'))
    expect(shelf).not.toMatch(/videos\.slice\(0, 6\)/)
  })

  /**
   * And the matching runs over every clip, not over the six that are shown.
   *
   * A record with fourteen would otherwise hand the first six to the first six
   * tracks and call the other eight recordings.
   */
  it('matches the tracks against all of them, not against the six on screen', () => {
    expect(bare).toMatch(/clipsOnTracks\(props\.tracks \?\? \[\], distinct\.value\)/)
  })
})
