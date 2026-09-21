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

/**
 * The order two finds stand in when the score has stopped deciding (M33 #2).
 *
 * Twenty finds sat at 48 on the walk of 2026-09-16 and "by score" ordered
 * nothing among them. The answer is the price — two records you have the same
 * reason to want are told apart by what they cost, which is the question the
 * next click asks anyway — and then the listing id, so the same dig read twice
 * gives the same list rather than whatever the store handed over that time.
 *
 * **Here rather than in one of the three places that had it.** `byRank` in
 * `worker/match/select.ts` had this rule, `worker/basket/optimise.ts` had two
 * thirds of it, `app/utils/digview.ts` had none and inherited the first one by
 * accident: it sorted on the score alone, and `Array.sort` being stable meant
 * the worker's ordering survived underneath. That worked and was invisible —
 * a rule nobody had written down, holding a screen up. One function now, read
 * by everything that ranks finds, and a test that pins the three together.
 *
 * Not the year: a 1974 pressing and a 1974 pressing tell you nothing, and
 * where the years differ it is a preference, not a tie-break.
 *
 * A missing price goes last from either end (docs/03 §6 takes it away after
 * six hours). Compared rather than subtracted: `Infinity - Infinity` is NaN,
 * NaN is falsy, and the comparison would then work only by accident.
 */
export function byScoreThenPrice(
  a: { score: number; price: number | null; listingId: number },
  b: { score: number; price: number | null; listingId: number },
): number {
  if (b.score !== a.score) return b.score - a.score
  const priceA = a.price ?? Infinity
  const priceB = b.price ?? Infinity
  if (priceA !== priceB) return priceA - priceB
  return a.listingId - b.listingId
}
