/**
 * The band a score falls into — one table, read by every screen that shows one.
 *
 * The thresholds are docs/04 §4's own, and they lived as an inline `computed`
 * in `MatchCard.vue` while the sheet showed the bare number. Two screens, one
 * number, one of them silent about what it meant.
 *
 * **Why the band matters more than the letter.** Asked on 2026-09-14 in front
 * of a find: *"48 C? Why 48 — that feels low — and what does the C stand
 * for?"* Both halves are fair. 48 is exactly the calibration row "artist known
 * and nothing else" (docs/04 §4), which is the weakest reason the app will
 * still show — below 30 a match is not even stored. And the letter was a
 * second encoding of the same number with no legend anywhere on the screen.
 *
 * So the letter goes and the word takes its place. The word is in the packs;
 * this module answers which one.
 */

export const BANDS = ['S', 'A', 'B', 'C'] as const

export type Band = (typeof BANDS)[number]

/** The floors from docs/04 §4. Below 30 nothing is stored, so C has no floor. */
export function bandOf(score: number): Band {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  return 'C'
}

/**
 * How many rungs of four are lit.
 *
 * A ladder rather than a percentage bar: the scale is not linear in anything a
 * reader cares about — 87 is one perfect reason and 96 is two — but "one of
 * four" and "four of four" is a rank anybody can read without a legend.
 */
export function bandStep(band: Band): number {
  return BANDS.length - BANDS.indexOf(band)
}
