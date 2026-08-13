import { MARKETPLACE_FIELDS, type Dig, type Match } from '#shared/types'

import { openFidelityDb, type FidelityDatabase } from './open'

/** Marketplace data may not be displayed once it is older than this. */
export const DIG_TTL_MS = 6 * 60 * 60 * 1000

/** How many digs are kept before the oldest are dropped. */
export const DIG_HISTORY_LIMIT = 5

/**
 * Strips every marketplace field but keeps our own derivations. A user still
 * sees *that* a dig found 47 matches and why — just not at what price.
 */
export function stripMarketplaceData(match: Match): Match {
  const stripped = { ...match, expired: true }
  for (const field of MARKETPLACE_FIELDS) {
    stripped[field] = null
  }
  return stripped
}

/**
 * Removes marketplace data that is past six hours (rule 4).
 *
 * Called by the keeper, on arrival and every twenty minutes after — before its
 * own sign-in and busy checks, because a deadline does not wait for either.
 *
 * It is not what *keeps* stale prices off the screen; every surface that shows
 * one checks the age itself, which is the part that has to be right even if
 * this never ran. This is the second line: hiding a price satisfies the terms,
 * deleting it is what we would want done with ours. Which is why it is total
 * rather than sampled — a function that skips some of them would leave exactly
 * the impression it is meant to remove.
 */
export async function expireDigs(
  db?: FidelityDatabase,
  now: number = Date.now(),
): Promise<number> {
  const database = db ?? (await openFidelityDb())
  let expiredMatches = 0

  for (const dig of await database.getAll('digs')) {
    if (dig.status === 'expired' || dig.expiresAt > now) continue

    const tx = database.transaction(['digs', 'matches', 'stock'], 'readwrite')
    const matches = tx.objectStore('matches')

    for (const match of await matches.index('by-dig-score').getAll(digRange(dig.id))) {
      if (match.expired) continue
      await matches.put(stripMarketplaceData(match))
      expiredMatches += 1
    }

    /*
     * Das Sortiment wird gelöscht, nicht ausgedünnt.
     *
     * Bei einem Treffer überleben Score und Signale den Ablauf — das ist eine
     * Auswertung und gehört uns. An einer Sortimentszeile ist **jedes** Feld
     * Marktplatzdatum; nach sechs Stunden bliebe eine leere Hülle übrig, die
     * nichts mehr sagen darf (Regel 4). Also weg damit.
     */
    const stock = tx.objectStore('stock')
    for (const key of await stock.getAllKeys(digRange(dig.id))) await stock.delete(key)

    await tx.objectStore('digs').put({ ...dig, status: 'expired' })
    await tx.done
  }

  return expiredMatches
}

/**
 * Keeps the newest digs and deletes the rest, matches included. Dig ids are
 * ULIDs, so lexicographic order is chronological order.
 */
export async function pruneDigs(
  db?: FidelityDatabase,
  keep: number = DIG_HISTORY_LIMIT,
): Promise<string[]> {
  const database = db ?? (await openFidelityDb())
  const digs = await database.getAll('digs')
  if (digs.length <= keep) return []

  const doomed = digs
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(keep)
    .map((dig) => dig.id)

  const tx = database.transaction(['digs', 'matches', 'stock'], 'readwrite')
  const matches = tx.objectStore('matches')
  const stock = tx.objectStore('stock')
  for (const id of doomed) {
    for (const key of await matches.index('by-dig-score').getAllKeys(digRange(id))) {
      await matches.delete(key)
    }
    // Ein weggeworfener Dig nimmt sein Sortiment mit. Bleibt es liegen, wächst
    // der Speicher mit jedem Scan um ein paar Megabyte, die niemand je sieht.
    for (const key of await stock.getAllKeys(digRange(id))) await stock.delete(key)
    await tx.objectStore('digs').delete(id)
  }
  await tx.done

  return doomed
}

/** Every match of one dig, via the [digId, score] index. */
function digRange(digId: Dig['id']): IDBKeyRange {
  return IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])
}
