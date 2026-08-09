import { describe, expect, it } from 'vitest'

// @ts-expect-error — plain ESM build script, no type declarations by design.
import { buildTokensCss } from '../../scripts/tokens/build.mjs'

const css: string = await buildTokensCss()

describe('design token build', () => {
  it('emits the neutral ramp as Tailwind colours', () => {
    expect(css).toContain('--color-fid-n-990: oklch(0.105 0.008 70);')
    expect(css).toContain('--color-fid-accent-500: oklch(0.74 0.165 58);')
  })

  it('resolves semantic roles into a single light-dark() declaration', () => {
    expect(css).toContain(
      '--color-fid-bg: light-dark(var(--color-fid-n-50), var(--color-fid-n-990));',
    )
  })

  it('exposes the short names used throughout the design system docs', () => {
    expect(css).toContain('--fid-n-50: var(--color-fid-n-50);')
    expect(css).toContain('--fid-bg: var(--color-fid-bg);')
    expect(css).toContain('--fid-radius-cover: var(--radius-fid-cover);')
  })

  it('keeps a rem term in every fluid font size (WCAG 1.4.4)', () => {
    const sizes = [...css.matchAll(/--text-fid-[\w-]+: (clamp\([^;]+\));/g)].map((m) => m[1]!)
    expect(sizes).toHaveLength(6)
    for (const size of sizes) {
      expect(size).toMatch(/clamp\([\d.]+rem, [\d.]+rem \+ [\d.]+vw, [\d.]+rem\)/)
    }
  })

  it('carries one colour per signal, ten for eleven signals', () => {
    const signals = [...css.matchAll(/--color-fid-sig-([\w-]+):/g)].map((m) => m[1]!)
    expect(signals).toEqual([
      'wantlist',
      'gap',
      'credit',
      'artist',
      'label',
      'catalog',
      'style',
      'price',
      'scarcity',
      'upgrade',
    ])
  })
})
