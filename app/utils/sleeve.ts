/**
 * The colour of a record label, made up from its name (#220).
 *
 * Inventory rows carry no picture (docs/02), so most finds have nothing to
 * show. A die-cut sleeve with the label showing through says more than a grey
 * square: the same label is the same colour on every screen and every visit,
 * because the colour comes from the name and nothing else.
 *
 * The ink is black or white, whichever stands further off the paper. The
 * worst case of that choice is a luminance of about 0.18, where both sit at
 * 4.58:1 — so every label clears WCAG AA (4.5:1) without a lookup table.
 */
export interface LabelColour {
  paper: string
  ink: string
}

/** FNV-1a, 32 bit: tiny, stable across engines, and spreads short names well. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function hslToRgb(hue: number, saturation: number, lightness: number): number[] {
  const a = saturation * Math.min(lightness, 1 - lightness)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

function luminance(rgb: number[]): number {
  const [r = 0, g = 0, b = 0] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const hex = (rgb: number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`

export function labelColour(name: string | null | undefined): LabelColour {
  const h = hash((name ?? '').trim().toLowerCase())
  // Hue from the low bits, a little lightness from the high ones: two labels
  // a few degrees apart still read as different paper.
  const rgb = hslToRgb(h % 360, 0.55, 0.36 + ((h >>> 16) % 5) * 0.06)
  const lum = luminance(rgb)
  // White paper-ink contrast vs black: (1.05)/(L+0.05) against (L+0.05)/0.05.
  const ink = 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? '#ffffff' : '#000000'
  return { paper: hex(rgb), ink }
}
