import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { THEME_COLORS } from '~/composables/useTheme'

// @ts-expect-error — plain ESM tooling module, no type declarations by design.
import { contrastRatio, oklchToRgb } from '../../scripts/tokens/color.mjs'

/**
 * WCAG 2.2 AA for body text. The design system is dark first and uses
 * light-dark(), so every role has to clear the bar in *both* schemes — an
 * accent that only works on a dark ground is half a token.
 *
 * This caught --fid-accent at 3.10:1 in light mode once. It is here so it
 * cannot happen again silently: a colour tweak in tokens/*.json that breaks
 * contrast fails the unit suite, not a screen review three weeks later.
 */
const AA_BODY_TEXT = 4.5

const core = JSON.parse(readFileSync('tokens/core.json', 'utf8'))
const semantic = JSON.parse(readFileSync('tokens/semantic.json', 'utf8'))

function resolve(reference: string): number[] {
  const path = reference.replace(/[{}]/g, '').split('.')
  const token = path.reduce<Record<string, never>>((node, key) => node[key], {
    color: core.color,
  } as Record<string, never>)
  return (token as { $value: { components: number[] } }).$value.components
}

function role(name: string, scheme: 'light' | 'dark'): number[] {
  const token = semantic.role[name]
  const reference =
    scheme === 'dark' ? token.$extensions['de.fidelity.dark'] : (token.$value as string)
  return oklchToRgb(resolve(reference))
}

const FOREGROUNDS = ['text', 'text-muted', 'accent']
const BACKGROUNDS = ['bg', 'surface', 'surface-raised']

describe.each(['light', 'dark'] as const)('semantic roles in %s mode', (scheme) => {
  it.each(
    FOREGROUNDS.flatMap((foreground) =>
      BACKGROUNDS.map((background) => ({ foreground, background })),
    ),
  )('$foreground on $background clears AA', ({ foreground, background }) => {
    const ratio = contrastRatio(role(foreground, scheme), role(background, scheme))
    expect(ratio).toBeGreaterThanOrEqual(AA_BODY_TEXT)
  })

  /**
   * `inset` is the odd one out and gets its own case.
   *
   * It is a *recessed* ground — progress track, empty cover, unfilled grid
   * cell — so it sits closer to the text than the raised surfaces do, and
   * accent on it reaches only 3.62:1 in light mode. That is fine as long as
   * nothing writes an accent-coloured label on it, which the next test is
   * there to keep true.
   */
  it.each(['text', 'text-muted'])('%s on inset clears AA', (foreground) => {
    const ratio = contrastRatio(role(foreground, scheme), role('inset', scheme))
    expect(ratio).toBeGreaterThanOrEqual(AA_BODY_TEXT)
  })
})

describe('the one thing inset may not carry', () => {
  /**
   * The measurement above is only worth something if no screen contradicts it.
   * A comment cannot enforce that; reading the markup can.
   */
  it('never puts accent text on an inset ground', () => {
    const screens = readdirSync('app', { recursive: true, encoding: 'utf8' }).filter((file) =>
      file.endsWith('.vue'),
    )

    const offenders = screens.filter((file) => {
      const source = readFileSync(`app/${file}`, 'utf8')
      // Every class attribute, static or bound, as one string each.
      const attributes = source.match(/:?class="[^"]*"/gs) ?? []
      return attributes.some(
        (attribute) =>
          attribute.includes('bg-fid-inset') && attribute.includes('text-fid-accent'),
      )
    })

    expect(offenders).toEqual([])
  })
})

describe('the colour the browser chrome is painted', () => {
  /**
   * `<meta name="theme-color">` is read before any stylesheet, so those two
   * values are hex literals rather than tokens — the one place in the app that
   * repeats a colour instead of referencing it. This is the check that keeps
   * the copy in step with the original.
   */
  it('matches both ends of the neutral ramp', () => {
    const hex = (reference: string) =>
      `#${oklchToRgb(resolve(reference))
        .map((channel: number) => Math.round(channel).toString(16).padStart(2, '0'))
        .join('')}`

    expect(THEME_COLORS.light).toBe(hex('{color.n.50}'))
    expect(THEME_COLORS.dark).toBe(hex('{color.n.990}'))
  })
})

describe('the signal palette', () => {
  /**
   * Ten colours in a narrow lightness band so no signal outweighs its
   * neighbours (docs/05-DESIGN-SYSTEM.md §2.3). Chips draw their text with
   * contrast-color(), so the requirement here is even weight, not contrast.
   */
  it('keeps every signal inside L 0.70–0.78 and C 0.11–0.18', () => {
    const signals = Object.entries<{ $value: { components: number[] } }>(core.color.sig).filter(
      ([key]) => !key.startsWith('$'),
    )

    expect(signals).toHaveLength(10)

    for (const [name, token] of signals) {
      const [lightness, chroma] = token.$value.components
      expect(lightness, `${name} lightness`).toBeGreaterThanOrEqual(0.7)
      expect(lightness, `${name} lightness`).toBeLessThanOrEqual(0.78)
      expect(chroma, `${name} chroma`).toBeGreaterThanOrEqual(0.11)
      expect(chroma, `${name} chroma`).toBeLessThanOrEqual(0.18)
    }
  })
})
