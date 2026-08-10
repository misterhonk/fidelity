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
  const STEP_FLOWS = ['pages/willkommen.vue']

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
