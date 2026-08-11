import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Weniger, aber besser — nachgemessen statt behauptet.
 *
 * Three habits that a design system loses one commit at a time, and that no
 * type or lint rule catches: a seventh type size because one heading wanted to
 * be slightly bigger, a spacing value off the grid because 6px looked right
 * once, and a second filled accent because the new button also felt important.
 *
 * Each of these is fine in isolation. That is exactly why they need a test.
 */

const screens = readdirSync('app', { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.vue'))
  .map((file) => ({ file, source: readFileSync(`app/${file}`, 'utf8') }))

describe('the type scale', () => {
  it('has four steps and no more', () => {
    const tokens = JSON.parse(readFileSync('tokens/core.json', 'utf8'))
    const steps = Object.keys(tokens.text).filter((key) => !key.startsWith('$'))

    expect(steps).toEqual(['xs', 'sm', 'base', 'xl'])
  })

  /**
   * Named rather than derived, because `text-fid-…` is two namespaces at once:
   * `text-fid-sm` is a size and `text-fid-muted` is a colour, and nothing in
   * the class name says which. So this lists the sizes that are gone and the
   * shapes a new one would take.
   */
  it('has no leftovers of the two steps that were dropped', () => {
    const gone = /\btext-fid-(lg|2xl|3xl|xxl|\d)\b/g

    const strays = screens.flatMap(({ file, source }) =>
      [...source.matchAll(gone)].map((match) => `${file}: ${match[0]}`),
    )

    expect(strays).toEqual([])
  })
})

describe('the spacing grid', () => {
  /**
   * Tailwind's scale is 0.25rem a step, so every whole number lands on 4px and
   * every half lands between two. `gap-1.5` is six pixels, which is a number
   * nothing else in the app uses.
   */
  it('has nothing on a half step', () => {
    const strays = screens.flatMap(({ file, source }) =>
      [...source.matchAll(/\b(gap|gap-x|gap-y|p|px|py|pt|pb|m|mx|my|mt|mb)-(\d+\.\d+)\b/g)].map(
        (match) => `${file}: ${match[0]}`,
      ),
    )

    expect(strays).toEqual([])
  })
})

describe('boxes that cannot do what they are told', () => {
  /**
   * `shrink-0` mit `truncate` oder `flex-wrap` — zwei Anweisungen, die sich
   * gegenseitig aufheben.
   *
   * `truncate` only ever fires when the box is narrower than its text, and
   * `shrink-0` promises it never will be. `flex-wrap` needs the container to be
   * squeezed before it breaks a line, and `shrink-0` refuses the squeeze. Both
   * pairs look reasonable in a diff and both mean "run off the right edge".
   *
   * Found the hard way on a phone: the credits list pushed the page 94 pixels
   * wide because one role read "Coordinator [Production Coordinator],
   * Management". The layout tests missed it because they visit two routes, and
   * signed out neither of them renders a credit.
   *
   * The fix in every case is `min-w-0`: let the box shrink, then let truncate
   * or wrap do what it was asked to do.
   */
  it('never pairs shrink-0 with truncate or flex-wrap', () => {
    const offenders = screens.flatMap(({ file, source }) =>
      [...source.matchAll(/class="([^"]*)"/gs)]
        .map((match) => match[1]!)
        .filter(
          (attribute) =>
            /(^|\s)shrink-0(\s|$)/.test(attribute) &&
            /(^|\s)(truncate|flex-wrap)(\s|$)/.test(attribute),
        )
        .map((attribute) => `${file}: ${attribute.trim().slice(0, 70)}`),
    )

    expect(offenders).toEqual([])
  })
})

describe('the accent', () => {
  /**
   * One filled accent per screen — it means "this is the thing to do", and two
   * of them on one screen means neither does.
   *
   * Only *unconditional* fills count. A static `class="… bg-fid-accent …"` is
   * a claim that this button is always the one to press; a `:class` that fills
   * it depending on state is the code making exactly the choice this rule asks
   * for. The dig screen does that — an interrupted dig outranks a new one, so
   * "Dig starten" steps back to an outline while a resume is on offer.
   *
   * Progress bars are exempt: a filled bar is a measurement, not a button, and
   * only one is ever running.
   */
  /**
   * The one screen that shows one step at a time.
   *
   * The rule is about what is visible at once, and static markup cannot say
   * that: the setup's three panels are branches of a single `v-if` chain
   * inside a `<Transition>`, so its two filled buttons — "Sammlung holen" and
   * "Zur Startseite" — are each the only action of their step and never share
   * a screen. Named rather than detected, because a regex that understood
   * step flows would be the kind of cleverness this file exists to avoid. A
   * second entry here should take an argument, not a commit.
   */
  const STEP_FLOWS = ['pages/welcome.vue']

  it('fills at most one surface per screen unconditionally', () => {
    const busy = screens
      .filter(({ file }) => !STEP_FLOWS.includes(file))
      .map(({ file, source }) => {
        const statics = [...source.matchAll(/(?<!:)class="([^"]*)"/gs)].map(
          (match) => match[1]!,
        )
        const actions = statics.filter(
          (attribute) =>
            /bg-fid-accent(?![/\w-])/.test(attribute) &&
            !attribute.includes('transition-[width]'),
        )
        return { file, actions: actions.length }
      })
      .filter((screen) => screen.actions > 1)

    expect(busy).toEqual([])
  })
})

/**
 * A badge counts; it does not help build the layout.
 *
 * The basket count sat in the nav link as an ordinary third child. On a phone
 * that link is a column, so the badge became a third *row*: the basket tab
 * grew taller than its four neighbours and shoved its own icon and label out
 * of the line they share. On a desktop it did the same sideways.
 *
 * A count is an annotation on a thing. The moment it takes part in the layout,
 * the bar it lives in reshapes itself around a number that changes.
 */
describe('the basket badge', () => {
  const NAV = readFileSync('app/components/AppNav.vue', 'utf8')
  const code = NAV.replace(/<!--[\s\S]*?-->/g, '')

  it('is positioned rather than laid out', () => {
    const badge = code.slice(code.indexOf('basketCount > 0'))
    expect(badge).toMatch(/absolute/)
  })

  it('hangs on the icon, not on the whole tab', () => {
    // Pinned to the link, it would drift to the corner of a wide desktop tab
    // and stop being a mark on the basket at all.
    expect(code).toMatch(/<span class="relative flex shrink-0">\s*<FidIcon/)
  })

  it('never intercepts the tap meant for the tab', () => {
    const badge = code.slice(code.indexOf('basketCount > 0'))
    expect(badge).toMatch(/pointer-events-none/)
  })

  /**
   * Die Icons stehen auf einer Linie.
   *
   * The gear has no label, so centring it in a bar sized for icon-plus-word
   * dropped its glyph eleven pixels below the other five. Measured rather than
   * guessed at the time; kept here as the shape that produced it, because a
   * unit test cannot read a bounding box.
   */
  it('starts the unlabelled tab at the same height as the labelled ones', () => {
    const gear = code.slice(code.indexOf('to="/settings"'))
    for (const rule of ['max-md:flex-col', 'max-md:justify-start', 'max-md:py-2']) {
      expect(gear.slice(0, 600)).toContain(rule)
    }
  })
})
