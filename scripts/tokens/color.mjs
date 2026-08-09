/**
 * Colour maths for the token tooling. Lives outside the app bundle: the icon
 * generator and the contrast test use it, the browser never does.
 *
 * The design system is OKLCH throughout (docs/05-DESIGN-SYSTEM.md §2), but
 * both PNG output and the WCAG contrast formula want sRGB.
 */

/** OKLCH components → linear sRGB, clamped to gamut. */
export function oklchToLinearRgb([lightness, chroma, hue]) {
  const h = (hue * Math.PI) / 180
  const a = chroma * Math.cos(h)
  const b = chroma * Math.sin(h)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)))
}

const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** OKLCH components → 8-bit sRGB. */
export function oklchToRgb(components) {
  return oklchToLinearRgb(components).map((c) => Math.round(encode(c) * 255))
}

export const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`

/**
 * WCAG 2.2 relative luminance. Deliberately computed from the *encoded* sRGB
 * values and decoded again rather than from the linear ones — WCAG defines it
 * on 8-bit channels, and rounding there moves the third decimal of a ratio
 * that decides pass or fail.
 */
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const channel = v / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.2 contrast ratio, 1–21. AA wants ≥ 4.5 for body text. */
export function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  )
  return (lighter + 0.05) / (darker + 0.05)
}
