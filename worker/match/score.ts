import type { Signal, SignalType } from '#shared/types'

/**
 * The Barry score (docs/04-MATCHING-ENGINE.md §4).
 *
 * SCALE and SECONDARY are constants and they stay constants. Retuning them
 * per milestone would make scores incomparable over time and the golden file
 * worthless — which is the whole reason the golden file exists.
 */
export const WEIGHTS: Record<SignalType, number> = {
  WANTLIST_EXACT: 100,
  WANTLIST_PRESSING: 75,
  ARTIST_GAP: 70,
  CREDIT_GRAPH: 65,
  CATALOG_RUN: 60,
  ARTIST_KNOWN: 55,
  LABEL_AFFINITY: 45,
  FORMAT_UPGRADE: 40,
  PRICE_SIGNAL: 35,
  STYLE_ADJACENT: 30,
  SCARCITY: 30,
}

/** How much the runners-up count. */
export const SECONDARY = 0.3

/** raw = 115 → score 100. */
export const SCALE = 115

/** Below this a match is not even stored. */
export const MIN_STORED_SCORE = 30

export interface ScoreContext {
  /** Per-user tuning, multiplied onto the weight. */
  userWeights?: Partial<Record<SignalType, number>>
  /** Below the preferred media condition. */
  conditionBelowPreference?: boolean
  /** Above the comfortable price but inside the budget. */
  priceAboveTarget?: boolean
  /** Clearly above the going rate. */
  priceSignalNegative?: boolean
  /**
   * A reissue, when the collector said they prefer originals.
   *
   * docs/03 §2 lists `excludeReissues` under the hard criteria, and it cannot
   * be one: whether a record is a reissue comes out of `/releases/{id}`, which
   * the scan never calls (CLAUDE.md rule 2). It is known only for the fifty
   * records the enrichment pass looks at, and only afterwards.
   *
   * So it dampens rather than discards. That keeps docs/04 §2's rule intact —
   * a criterion is one or the other, never both — and the interface says
   * "zählt weniger" rather than promising something the data cannot deliver.
   */
  reissueAgainstPreference?: boolean
  alreadyInBasket?: boolean
}

export function barryScore(signals: Signal[], ctx: ScoreContext = {}): number {
  const values = signals
    .map(
      (signal) =>
        WEIGHTS[signal.type] * signal.confidence * (ctx.userWeights?.[signal.type] ?? 1),
    )
    .sort((a, b) => b - a)

  if (values.length === 0) return 0

  // The strongest reason dominates; the rest count, but dampened. A plain sum
  // would float matches with many weak signals to the top, and one perfect
  // reason should outweigh five mediocre ones.
  const [primary = 0, ...rest] = values
  const raw = primary + SECONDARY * rest.reduce((sum, value) => sum + value, 0)

  // Linear with a cap. No saturation term needed — step one already bounds
  // how much the extras can add.
  let score = Math.min(100, (raw / SCALE) * 100)

  // Soft dampeners only. Everything hard was filtered out before scoring, so
  // nothing here is dead code (docs/04 §2).
  if (ctx.conditionBelowPreference) score *= 0.4
  if (ctx.priceAboveTarget) score *= 0.55
  if (ctx.priceSignalNegative) score *= 0.75
  if (ctx.reissueAgainstPreference) score *= 0.6
  if (ctx.alreadyInBasket) score = 0

  return Math.round(score)
}

export type ScoreBand = 'S' | 'A' | 'B' | 'C'

/** null means "not worth keeping" (docs/04 §4, score bands). */
export function scoreBand(score: number): ScoreBand | null {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  if (score >= MIN_STORED_SCORE) return 'C'
  return null
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  S: 'Side One, Track One',
  A: 'Top Five',
  B: 'Solide',
  C: 'Randnotiz',
}
