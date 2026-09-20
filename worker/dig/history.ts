import type { Dig, DigBrief, DigVisit } from '#shared/types'
import { openFidelityDb, type FidelityDatabase } from '~~/db/open'

/**
 * A dig is a visit to a shop; the history is the shop's story (M36).
 *
 * Until 2026-09-20 the screen listed the last five digs as one flat row of
 * chips, and a round wrote a dig per watched shop whether or not anything
 * had arrived. Martin's screen showed five chips, four of them "only what
 * was new", three of them the same empty minute. What somebody asks of an
 * earlier dig is three things: what did I find, what has happened since, and
 * is it worth going back. This module answers the second — what a full dig
 * no longer sees, and which check-ins saw nothing — and builds the list.
 */

const digRange = (digId: string) => IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])

const isFull = (dig: Pick<Dig, 'depth'>) => (dig.depth ?? 'normal') !== 'neu'
const finished = (dig: Pick<Dig, 'status'>) => dig.status === 'done' || dig.status === 'expired'

/**
 * A check-in that saw nothing new leaves no dig behind.
 *
 * The row was written when the run started, so a closed tab could resume
 * it; a run that reached the known stock on its first page has nothing to
 * resume and nothing to show. The shop remembers the look instead: when,
 * and how many looks in a row were quiet.
 */
export async function discardQuietCheck(
  db: FidelityDatabase,
  dig: Dig,
  now: number,
): Promise<void> {
  await db.delete('digs', dig.id)
  const dealer = await db.get('dealers', dig.dealer)
  if (!dealer) return
  await db.put('dealers', {
    ...dealer,
    checkedAt: now,
    quietChecks: (dealer.quietChecks ?? 0) + 1,
  })
}

/** Something arrived, or a full dig ran: the quiet streak is over. */
export async function noteChange(db: FidelityDatabase, username: string, now: number) {
  const dealer = await db.get('dealers', username)
  if (!dealer) return
  await db.put('dealers', { ...dealer, checkedAt: now, quietChecks: 0 })
}

/**
 * What the previous full dig found that this one no longer saw.
 *
 * Only a dig that saw the whole shop may say so: a run cut off at the
 * 10,000 wall has not seen what it did not reach. Compared against the
 * stock this dig wrote — every listing it saw, not only the finds — so a
 * record that is still there but no longer matches is not called gone. Sold
 * or taken down cannot be told apart, and `goneAt` does not claim to.
 */
export async function markGone(db: FidelityDatabase, dig: Dig, now: number): Promise<number> {
  if (!isFull(dig) || dig.truncated || dig.coverage < 0.99) return 0

  const previous = (await db.getAll('digs'))
    .filter((d) => d.dealer === dig.dealer && d.id < dig.id && isFull(d) && finished(d))
    .sort((a, b) => b.id.localeCompare(a.id))[0]

  let marked = 0
  if (previous) {
    const still = new Set((await db.getAllKeys('stock', digRange(dig.id))).map((key) => key[1]))
    const tx = db.transaction('matches', 'readwrite')
    for (const match of await tx.store.index('by-dig-score').getAll(digRange(previous.id))) {
      if (match.goneAt || still.has(match.listingId)) continue
      await tx.store.put({ ...match, goneAt: now })
      marked += 1
    }
    await tx.done
  }

  await db.put('digs', { ...dig, checkedGone: true })
  return marked
}

// ---------------------------------------------------------------------------

function brief(dig: Dig, gone: number | null): DigBrief {
  return {
    id: dig.id,
    startedAt: dig.startedAt,
    kind: dig.depth === 'neu' ? 'new' : dig.depth === 'deep' ? 'deep' : 'full',
    status: dig.status,
    matchCount: dig.matchCount,
    listingsTotal: dig.listingsTotal,
    coverage: dig.coverage,
    gone,
  }
}

/** The shops and their visits, the shop visited last first. */
export async function digVisits(db?: FidelityDatabase): Promise<DigVisit[]> {
  const database = db ?? (await openFidelityDb())
  const digs = (await database.getAll('digs')).sort((a, b) => b.id.localeCompare(a.id))
  const dealers = new Map((await database.getAll('dealers')).map((d) => [d.username, d]))

  const byDealer = new Map<string, Dig[]>()
  for (const dig of digs) {
    const list = byDealer.get(dig.dealer)
    if (list) list.push(dig)
    else byDealer.set(dig.dealer, [dig])
  }

  const visits: DigVisit[] = []
  for (const [username, own] of byDealer) {
    const runs: DigBrief[] = []
    for (const dig of own) {
      // Marked by the next full dig; until one has looked, nobody knows.
      const looked = own.some(
        (later) => later.id > dig.id && isFull(later) && later.checkedGone,
      )
      const gone =
        isFull(dig) && looked
          ? (
              await database
                .transaction('matches')
                .store.index('by-dig-score')
                .getAll(digRange(dig.id))
            ).filter((match) => match.goneAt).length
          : null
      runs.push(brief(dig, gone))
    }

    const fullIndex = own.findIndex((dig) => isFull(dig))
    const full = fullIndex === -1 ? null : runs[fullIndex]!
    const since = fullIndex === -1 ? runs : runs.slice(0, fullIndex)
    const dealer = dealers.get(username)

    visits.push({
      dealer: username,
      displayName: dealer?.displayName || username,
      full,
      since,
      newFinds: since.reduce((sum, run) => sum + run.matchCount, 0),
      quietChecks: dealer?.quietChecks ?? 0,
      checkedAt: dealer?.checkedAt ?? null,
      runs,
    })
  }

  return visits
}
