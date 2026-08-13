import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Eine Kachel, die etwas tun soll, ist auch anklickbar.
 *
 * Found by walking the start screen as a user: twelve covers under "Zuletzt
 * gefunden", every one of them bound to open the release sheet, and not one of
 * them doing anything. `CoverTile` chose its element by asking
 * `$attrs.onOpen` — and Vue removes a listener from `$attrs` the moment the
 * event is declared in `defineEmits`. The test was therefore always false,
 * every tile rendered as a plain `<div>`, and the sheet was unreachable from
 * the home screen for as long as the rail existed.
 *
 * Nothing about that is visible: the markup reads correctly, the handler is
 * bound, and the only symptom is a click that does nothing. So the guard is
 * on the shape rather than the behaviour — a callback prop cannot be passed
 * without making the tile a button, because it is the same fact.
 */
const TILE = readFileSync('app/components/CoverTile.vue', 'utf8')

/**
 * Comments stripped, because this file explains the bug it fixes by name and a
 * check that reads prose would fail on its own explanation.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

describe('a cover tile', () => {
  it('decides what it is from its own props, not from $attrs', () => {
    // `$attrs.onOpen` is the bug. Any reading of it is the bug coming back.
    expect(code(TILE)).not.toMatch(/\$attrs\.onOpen/)
  })

  it('does not declare the click as an emit', () => {
    // An emit is exactly what removes the listener from `$attrs`, and it is
    // what made the two facts — "is bound" and "is interactive" — able to
    // disagree.
    expect(code(TILE)).not.toMatch(/defineEmits/)
  })

  it('renders a button when it has something to do', () => {
    expect(TILE).toMatch(/props\.open \? 'button'/)
    expect(TILE).toMatch(/@click="open\?\.\(\)"/)
  })

  /**
   * The element is decided in setup, never in the template.
   *
   * `resolveComponent('NuxtLink')` inside a template expression looks right
   * and is not: in a production build it silently returns the *string*
   * `'NuxtLink'`, so `<component :is>` renders a literal `<nuxtlink>` — no
   * error, no warning, a cover that does nothing. Shipped for the length of
   * one build on 2026-08-13, and this file could not see it, because the
   * source read exactly as intended. `tests/e2e/start-rails.spec.ts` is the
   * guard that can; this one only keeps the trap shut.
   */
  it('never resolves a component from the template', () => {
    const template = TILE.slice(TILE.indexOf('<template>'))
    expect(template).not.toMatch(/resolveComponent/)
    expect(TILE).toMatch(/:is="tag"/)
  })

  /**
   * And the two link kinds are not interchangeable.
   *
   * An address inside the app must not carry `target="_blank"`: a record of
   * your own opening in a second tab is the same "you are leaving now" gesture
   * as an outward link, only quieter.
   */
  it('opens a new tab only for the way out', () => {
    expect(TILE).toMatch(/:target="open \|\| to \? undefined : href \? '_blank'/)
    expect(TILE).toMatch(/:rel="open \|\| to \? undefined : href \? 'noopener noreferrer'/)
  })

  /**
   * Every clickable tile says what it is.
   *
   * The title sits *under* the button, not inside it, so without an explicit
   * label a screen reader announces four tiles in a row as "button", "button",
   * "button", "button". Found on 2026-08-13 by a test that could not find them
   * by name either — which is exactly what somebody using a screen reader
   * would have experienced.
   */
  it('has a name, whatever kind of tile it is', () => {
    expect(TILE).toMatch(/m\.common\.openRecord\(title\)/)
    expect(TILE).toMatch(/m\.common\.atDiscogs\(title\)/)
  })

  it('never opens a new tab without saying where it goes', () => {
    expect(TILE).toMatch(/noopener noreferrer/)
    // Said through the message pack, not as a literal. It used to be a German
    // string sitting in the markup, which the English build read out too.
    expect(TILE).toMatch(/m\.common\.atDiscogs\(title\)/)
    expect(code(TILE)).not.toMatch(/bei Discogs/)
  })
})

/**
 * Und die Startseite bindet es auch so.
 *
 * The component can only be right if the call site passes the prop. `@open`
 * would compile, bind nothing, and put the screen straight back where it was.
 */
describe('the start screen', () => {
  const INDEX = readFileSync('app/pages/index.vue', 'utf8')

  it('passes the callback as a prop', () => {
    expect(INDEX).toMatch(/:open="\(\) => show\(/)
    expect(INDEX).not.toMatch(/@open="show\(/)
  })

  /**
   * No cover on the start screen leads out of the app.
   *
   * Both rails used to go to Discogs. For the shelf that was the app sending
   * somebody away from the one screen that knows more than Discogs does — the
   * rating they gave it, the condition they noted, the folder it sits in.
   *
   * The wantlist was left outward on the reasoning that a record you do not
   * own has no page here. That was wrong, and it took somebody asking to see
   * it: the wantlist row carries the note you wrote about *why* you want it,
   * and the way to stop wanting it. Discogs has neither.
   *
   * So the shelf opens its sheet, the wantlist lands on its own row, and the
   * link to Discogs stays where it belongs — inside the record, next to the
   * things only Discogs can do.
   */
  it('keeps every cover inside the app', () => {
    expect(INDEX).toMatch(/:open="\(\) => \(openInstance = record\.instanceId\)"/)
    expect(INDEX).toMatch(/<ShelfSheet/)
    expect(INDEX).toMatch(/:to="`\/wantlist#want-\$\{record\.releaseId\}`"/)

    const outward = INDEX.match(/https:\/\/www\.discogs\.com\/release\//g) ?? []
    expect(outward).toEqual([])
  })

  /**
   * And the address it jumps to actually exists.
   *
   * A `#want-123` that no element answers to is a link that scrolls nowhere —
   * and looks, from the outside, exactly like a page that ignored the tap.
   */
  it('lands on a row that is really there', () => {
    const WANTLIST = readFileSync('app/pages/wantlist.vue', 'utf8')
    expect(WANTLIST).toMatch(/:id="`want-\$\{record\.releaseId\}`"/)
    // Under a sticky nav, an anchor without this lands behind it.
    expect(WANTLIST).toMatch(/scroll-mt-\d+/)
  })

  it('lets every shop lead to its own profile', () => {
    expect(INDEX).toMatch(/path: '\/dealers', query: \{ dealer: shop\.username \}/)
  })
})
