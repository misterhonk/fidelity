import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

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
