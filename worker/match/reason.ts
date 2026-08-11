import type { Signal } from '#shared/types'

import { WEIGHTS } from './score'

/**
 * Which signal leads.
 *
 * All that is left here of what used to build the Barry sentence. The wording
 * moved to `app/i18n/reason.ts` on the day the interface got a second
 * language: a sentence is read, and this thread has no idea what language it is
 * read in. What stayed is the ordering, because which signal leads is a scoring
 * decision — it reads `WEIGHTS`, the same table the score is computed from, and
 * a sentence that led with a weaker signal than the score did would be a
 * different claim than the number beside it.
 */
export function byStrength(a: Signal, b: Signal): number {
  return WEIGHTS[b.type] * b.confidence - WEIGHTS[a.type] * a.confidence
}
