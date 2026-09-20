import { openFidelityDb } from '~~/db/open'
import type { DealerTempo } from '#shared/types'

/**
 * How fast a shop's finds go (M34.6, "the tempo").
 *
 * Two full digs of the same shop, and the question between them: how many of
 * the finds from the first were no longer there at the second. A find that
 * is gone has sold, or been taken down — the device cannot tell which, and
 * does not claim to. What it can say is "12 of 31 finds from 12 Sep were
 * gone nine days later", which is the one number that turns "I'll think
 * about it" into a decision.
 *
 * Only full digs count. A "new arrivals" dig (`depth: 'neu'`) stops at the
 * first listing it already knew and never sees what left, so comparing
 * against it would count everything older as gone. Expired digs count: the
 * six-hour rule strips their prices, not their listing ids.
 */
export async function tempoOf(dealer: string): Promise<DealerTempo | null> {
  const db = await openFidelityDb()
  const digs = (await db.getAll('digs'))
    .filter(
      (dig) =>
        dig.dealer === dealer &&
        (dig.status === 'done' || dig.status === 'expired') &&
        (dig.depth ?? 'normal') !== 'neu',
    )
    .sort((a, b) => a.startedAt - b.startedAt)
  if (digs.length < 2) return null

  const earlier = digs[digs.length - 2]!
  const later = digs[digs.length - 1]!

  const ids = async (digId: string) =>
    (
      await db
        .transaction('matches')
        .store.index('by-dig-score')
        .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))
    ).map((match) => match.listingId)

  const before = await ids(earlier.id)
  if (before.length === 0) return null
  const after = new Set(await ids(later.id))
  const gone = before.filter((id) => !after.has(id)).length

  return {
    of: before.length,
    gone,
    from: earlier.startedAt,
    days: Math.max(1, Math.round((later.startedAt - earlier.startedAt) / 86_400_000)),
  }
}
