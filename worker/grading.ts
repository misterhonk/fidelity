import { openFidelityDb } from '~~/db/open'
import type { GradingRecord } from '#shared/types'

/**
 * Does this shop grade honestly? (M14)
 *
 * **The gap Discogs structurally cannot close.** Feedback there measures
 * "quality of transaction" and says nothing about grading accuracy; negative
 * ratings for overgrading are removed on the seller's complaint. What is left
 * is superstition — "never buy under 100 %".
 *
 * What is built here is not a rating of somebody else and not a pillory, but a
 * **private record of one's own purchases**: at this shop, seven records out
 * of eight were as described.
 *
 * **The promised grade is stored nowhere.** It would be Discogs content and
 * could not be shown after six hours (`docs/09` §1.1). Only the comparison is
 * stored — derived data, the same category as scores and the fingerprint.
 *
 * Costs no request: all of it is in the `feedback` store.
 */

/**
 * Below this count no rate is shown.
 *
 * Two out of two is 100 %, and that reads like a verdict on a shop one knows
 * nothing about. From five the number carries something; below it, the bare
 * count stands instead, which misleads nobody.
 */
export const MIN_FOR_RATE = 5

/**
 * How soon after a purchase the question is asked at the earliest.
 *
 * A tick at "bought" means ordered, not arrived. Somebody asked the same
 * evening how the record was learns within a week to read past the question —
 * and then never enough accumulates to carry a rate.
 *
 * Ten days is not a measured value but a deliberately generous bound:
 * international record post regularly takes two weeks, and asked too early is
 * more expensive than asked too late. **This applies only to the question
 * asking itself.** On the purchase list it stands from the first day — anyone
 * already holding the record should be allowed to answer.
 */
export const ASK_AFTER_MS = 10 * 24 * 60 * 60 * 1000

export async function gradingFor(dealer: string): Promise<GradingRecord> {
  const db = await openFidelityDb()
  // Through the index (M34.4): one shop's rows, not every row this device has judged.
  const rows = await db.getAllFromIndex('feedback', 'by-dealer', dealer)

  const mine = rows.filter((row) => row.arrived)
  const asDescribed = mine.filter((row) => row.arrived === 'as-described').length
  const better = mine.filter((row) => row.arrived === 'better').length
  const worse = mine.filter((row) => row.arrived === 'worse').length

  return {
    dealer,
    judged: mine.length,
    asDescribed,
    better,
    worse,
    /*
     * "Better than described" counts as honest too.
     *
     * Anyone understating has not disappointed you — and a shop whose records
     * regularly arrive better than announced is precisely the opposite of the
     * problem this is about.
     */
    rate: mine.length >= MIN_FOR_RATE ? (asDescribed + better) / mine.length : null,
  }
}

/** How a bought record arrived. From the buyer only, on this device only. */
export async function recordArrival(
  listingId: number,
  arrived: 'as-described' | 'better' | 'worse' | null,
): Promise<void> {
  const db = await openFidelityDb()
  const row = await db.get('feedback', listingId)
  if (!row) return

  await db.put('feedback', {
    ...row,
    arrived,
    arrivedAt: arrived ? Date.now() : null,
    updatedAt: Date.now(),
  })
}

/**
 * What is bought, long enough ago and not yet judged — the open question.
 *
 * The time bound belongs here and not in a screen: "when is the question due"
 * is a decision about the data, and one that has to be checkable.
 */
export async function awaitingArrival(
  now = Date.now(),
): Promise<
  { listingId: number; dealer: string | null; artist: string | null; title: string | null }[]
> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')

  return all
    .filter(
      (row) => row.verdict === 'bought' && !row.arrived && now - row.createdAt >= ASK_AFTER_MS,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((row) => ({
      listingId: row.listingId,
      dealer: row.dealer ?? null,
      artist: row.artist ?? null,
      title: row.title ?? null,
    }))
}
