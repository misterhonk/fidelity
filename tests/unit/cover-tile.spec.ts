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
    expect(TILE).toMatch(/:is="open \? 'button'/)
    expect(TILE).toMatch(/@click="open\?\.\(\)"/)
  })

  it('renders a link when it leads somewhere, and a plain box otherwise', () => {
    expect(TILE).toMatch(/:is="open \? 'button' : href \? 'a' : 'div'"/)
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
   * A record of your own opens here, not at Discogs.
   *
   * Both rails used to lead outward, and for the shelf that was the app
   * sending somebody away from the one screen that knows more than Discogs
   * does: the rating they gave it, the condition they noted, the folder it
   * sits in. The wantlist keeps its outward link — a record you do not own has
   * no page here, and Discogs is where you would go to buy it.
   */
  it('opens your own record in the app and only sends the wantlist outward', () => {
    expect(INDEX).toMatch(/:open="\(\) => \(openInstance = record\.instanceId\)"/)
    expect(INDEX).toMatch(/<ShelfSheet/)

    const outward = INDEX.match(/:href="`https:\/\/www\.discogs\.com\/release\//g) ?? []
    expect(outward).toHaveLength(1)
  })

  it('lets every shop lead to its own profile', () => {
    expect(INDEX).toMatch(/path: '\/dealers', query: \{ dealer: shop\.username \}/)
  })
})
