import { openFidelityDb } from '~~/db/open'
import type { FeedbackSubject } from '#shared/protocol'
import type { Feedback, MarkedOverview, MarkedRecord, Signal, Verdict } from '#shared/types'

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
 * Deliberately no numbers off the marketplace: no price, no condition. Those
 * are the things the six-hour rule deletes, and this store is meant to be
 * permanent.
 *
 * What it does keep is what makes it readable a year later: who made the
 * record, what it is called, and which shop had it. A dig is pruned after
 * five, and a shortlist that survives as two bare integers is not a shortlist
 * — the basket has kept the title for exactly this reason since M4.
 */

export async function recordFeedback(
  match: FeedbackSubject,
  verdict: Verdict,
  now: number,
): Promise<Feedback> {
  const db = await openFidelityDb()

  // The dealer lives on the dig, not on the match — same lookup the basket
  // does, and for the same reason: you cannot go back to a shop you cannot
  // name.
  const dealer = match.digId ? ((await db.get('digs', match.digId))?.dealer ?? null) : null

  const entry: Feedback = {
    listingId: match.listingId,
    releaseId: match.releaseId,
    title: match.title ?? null,
    artist: match.artist ?? null,
    dealer,
    verdict,
    // Copied, not referenced. The style pass rewrites match.signals in place
    // after the scan, and a snapshot that changes afterwards is not one.
    signals: match.signals.map((signal: Signal) => ({ ...signal })),
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

/**
 * The shortlist: everything judged worth a second look, still findable.
 *
 * Grouped by shop, because buying is per shop — postage is per shipment, and
 * three records at one dealer is a different proposition from three records at
 * three. Within a shop, newest first: the dig you ran this morning is the one
 * you are still thinking about.
 *
 * Rows written before this store kept titles have none, and say so rather than
 * inventing one. Their release id still links out to Discogs.
 */
export async function markedOverview(): Promise<MarkedOverview> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')

  const marked = all.filter((entry) => entry.verdict === 'interesting').map(toMarked)
  const bought = all
    .filter((entry) => entry.verdict === 'bought')
    .map(toMarked)
    .sort((a, b) => b.createdAt - a.createdAt)

  const byDealer = new Map<string, MarkedRecord[]>()
  for (const record of marked) {
    const key = record.dealer ?? ''
    const group = byDealer.get(key)
    if (group) group.push(record)
    else byDealer.set(key, [record])
  }

  const groups = [...byDealer.entries()]
    .map(([dealer, records]) => ({
      dealer: dealer || null,
      records: records.sort((a, b) => b.createdAt - a.createdAt),
      // What a stock check would cost here, so the interface can say it.
      open: records.filter((record) => record.soldAt === null).length,
    }))
    // Most records at one shop first: that is where an order is worth
    // assembling, and where the postage argument actually bites.
    .sort((a, b) => b.records.length - a.records.length)

  return {
    groups,
    bought,
    total: marked.length,
    stillOpen: marked.filter((record) => record.soldAt === null).length,
  }
}

function toMarked(entry: Feedback): MarkedRecord {
  return {
    listingId: entry.listingId,
    releaseId: entry.releaseId,
    title: entry.title ?? null,
    artist: entry.artist ?? null,
    dealer: entry.dealer ?? null,
    score: entry.score,
    createdAt: entry.createdAt,
    soldAt: entry.soldAt ?? null,
  }
}
