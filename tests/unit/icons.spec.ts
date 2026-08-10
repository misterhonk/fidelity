import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { GLYPHS } from '~/utils/glyphs'
import { ICONS } from '~/utils/icons'

/**
 * Ein falscher Icon-Name zeichnet nichts, und beschwert sich nicht.
 *
 * `ICONS[name]` for a name that is not there is `undefined`, `v-for` over
 * `undefined` renders nothing, and an empty <svg> is invisible. The type
 * catches it in a component that passes a literal; it does not catch a name
 * built from data, which is how the nav bar and the tabs pass theirs.
 */
const SIZE = 24

function templates(): { file: string; source: string }[] {
  return readdirSync('app', { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.vue'))
    .map((file) => ({ file, source: readFileSync(`app/${file}`, 'utf8') }))
}

describe('the icon set', () => {
  it('answers to every name a template asks for', () => {
    const asked = new Set<string>()

    for (const { source } of templates()) {
      // <FidIcon name="search" /> and, in the data-driven cases, the entries
      // the components map over: `icon: 'kiste'`.
      for (const match of source.matchAll(/<FidIcon\s+name="([a-z0-9-]+)"/g)) {
        asked.add(match[1]!)
      }
      for (const match of source.matchAll(/icon: '([a-z0-9-]+)'/g)) {
        asked.add(match[1]!)
      }
    }

    expect(asked.size).toBeGreaterThan(0)
    expect([...asked].filter((name) => !(name in ICONS))).toEqual([])
  })

  /**
   * Six glyphs were drawn for this app. One that nothing renders is
   * decoration, and this design language is supposed to be free of it.
   */
  it('draws no glyph that no screen uses', () => {
    const rendered = templates()
      .map(({ source }) => source)
      .join('\n')

    const unused = Object.keys(GLYPHS).filter(
      (name) => !rendered.includes(`name="${name}"`) && !rendered.includes(`icon: '${name}'`),
    )

    expect(unused).toEqual([])
  })

  it('keeps every shape on the same grid', () => {
    /*
     * Lucide is 24×24 and FidIcon hard-codes that viewBox. A hand-drawn glyph
     * that strays outside it is not clipped — it is silently scaled down by
     * whatever the browser decides, and ends up a hair lighter than its
     * neighbours for reasons nobody can see.
     */
    for (const [name, shapes] of Object.entries(ICONS)) {
      for (const [tag, attributes] of shapes) {
        const numbers = Object.entries(attributes)
          .filter(([key]) => key !== 'd')
          .map(([, value]) => Number(value))
          .filter((value) => Number.isFinite(value))

        for (const value of numbers) {
          expect(value, `${name} <${tag}>`).toBeGreaterThanOrEqual(0)
          expect(value, `${name} <${tag}>`).toBeLessThanOrEqual(SIZE)
        }
      }
    }
  })
})
