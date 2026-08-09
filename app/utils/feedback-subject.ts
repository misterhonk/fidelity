import type { FeedbackSubject } from '#shared/protocol'
import type { Signal } from '#shared/types'

/**
 * What actually crosses the boundary when a verdict is given — spelled out,
 * not "whatever object the component happened to be holding".
 *
 * Two reasons, and the second one bites hard.
 *
 * A `Match` carries the price, the condition and the seller's note. None of
 * that belongs in a store meant to outlive the six-hour window (docs/03 §7),
 * and the protocol already says so — this makes the runtime agree with it.
 *
 * And structured clone rejects a Proxy outright. A match read out of a deeply
 * reactive ref therefore cannot be posted to the worker at all: it throws
 * DataCloneError, which the optimistic verdict button hides completely. The
 * button lights up, the verdict is never saved, and nothing anywhere says so.
 * Building a plain object here is immune to that whatever the caller holds.
 */
export function feedbackSubject(match: FeedbackSubject): FeedbackSubject {
  return {
    listingId: match.listingId,
    releaseId: match.releaseId,
    digId: match.digId,
    title: match.title,
    artist: match.artist,
    score: match.score,
    signals: match.signals.map((signal: Signal) => ({
      type: signal.type,
      confidence: signal.confidence,
      evidence: { ...signal.evidence },
    })),
  }
}
