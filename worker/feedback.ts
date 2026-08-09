import { openFidelityDb } from '~~/db/open'
import type { Feedback, Match, Verdict } from '#shared/types'

/**
 * Feedback — the only way Barry ever gets calibrated.
 *
 * The verdict alone would be worthless six months from now: signal weights
 * move, the horizon grows, a record that scored 71 on three signals today
 * might score 71 on entirely different ones next spring. So each verdict
 * carries the signals *as they were when it was given* (docs/03 §7). That
 * snapshot is what makes the whole store analysable later — which signals
 * actually correlate with "interessant" — and it is the reason this is stored
 * at all rather than being a piece of interface state.
 *
 * Deliberately not marketplace content: no price, no condition, no dealer. So
 * this outlives the six-hour window and is the one part of a dig that is meant
 * to be permanent.
 */

export async function recordFeedback(
  match: Pick<Match, 'listingId' | 'releaseId' | 'signals' | 'score'>,
  verdict: Verdict,
  now: number,
): Promise<Feedback> {
  const db = await openFidelityDb()

  const entry: Feedback = {
    listingId: match.listingId,
    releaseId: match.releaseId,
    verdict,
    // Copied, not referenced. The style pass rewrites match.signals in place
    // after the scan, and a snapshot that changes afterwards is not one.
    signals: match.signals.map((signal) => ({ ...signal })),
    score: match.score,
    createdAt: now,
  }

  await db.put('feedback', entry)
  return entry
}

export async function clearFeedback(listingId: number): Promise<void> {
  const db = await openFidelityDb()
  await db.delete('feedback', listingId)
}

/** Every verdict given so far, keyed by listing — what the UI needs to render. */
export async function feedbackVerdicts(): Promise<Record<number, Verdict>> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')

  const verdicts: Record<number, Verdict> = {}
  for (const entry of all) verdicts[entry.listingId] = entry.verdict
  return verdicts
}

/**
 * The whole store, newest first, for the offline analysis docs/03 §7 describes.
 * Stays on this machine unless somebody exports it by hand.
 */
export async function allFeedback(): Promise<Feedback[]> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
