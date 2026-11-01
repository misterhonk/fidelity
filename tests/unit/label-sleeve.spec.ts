import { describe, expect, it } from 'vitest'

import { labelColour } from '~~/app/utils/sleeve'

// @ts-expect-error — plain ESM tooling module, no type declarations by design.
import { contrastRatio } from '../../scripts/tokens/color.mjs'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('labelColour (#220)', () => {
  it('is the same colour for the same label, whatever the case or spacing', () => {
    expect(labelColour('Warp Records')).toEqual(labelColour('Warp Records'))
    expect(labelColour(' warp records ')).toEqual(labelColour('Warp Records'))
  })

  it('pins the colour, so a refactor cannot quietly repaint every sleeve', () => {
    expect(labelColour('Warp Records')).toMatchInlineSnapshot(`
      {
        "ink": "#ffffff",
        "paper": "#4237be",
      }
    `)
    expect(labelColour(null)).toEqual(labelColour(''))
  })

  it('gives different labels different paper', () => {
    const names = [
      'Warp Records',
      'Blue Note',
      'ECM Records',
      'Apollo',
      'Go! Beat',
      'Ninja Tune',
    ]
    expect(new Set(names.map((name) => labelColour(name).paper)).size).toBe(names.length)
  })

  it('keeps the ink at 4.5:1 or better on every paper', () => {
    for (let i = 0; i < 5000; i++) {
      const { paper, ink } = labelColour(`label ${i}`)
      expect(contrastRatio(rgb(ink), rgb(paper))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
