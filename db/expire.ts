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
 * Enforces the six-hour rule. Runs at app start and hourly while the app is
 * open — the only place the ToS deadline is actually applied, so it has to be
 * boring and total: it processes every expired dig, not a sample.
 */
export async function expireDigs(
  db?: FidelityDatabase,
  now: number = Date.now(),
): Promise<number> {
  const database = db ?? (await openFidelityDb())
  let expiredMatches = 0

  for (const dig of await database.getAll('digs')) {
    if (dig.status === 'expired' || dig.expiresAt > now) continue

    const tx = database.transaction(['digs', 'matches'], 'readwrite')
    const matches = tx.objectStore('matches')

    for (const match of await matches.index('by-dig-score').getAll(digRange(dig.id))) {
      if (match.expired) continue
      await matches.put(stripMarketplaceData(match))
      expiredMatches += 1
    }

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

  const tx = database.transaction(['digs', 'matches'], 'readwrite')
  const matches = tx.objectStore('matches')
  for (const id of doomed) {
    for (const key of await matches.index('by-dig-score').getAllKeys(digRange(id))) {
      await matches.delete(key)
    }
    await tx.objectStore('digs').delete(id)
  }
  await tx.done

  return doomed
}

/** Every match of one dig, via the [digId, score] index. */
function digRange(digId: Dig['id']): IDBKeyRange {
  return IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])
}
