import { MARKETPLACE_FIELDS, type Dig, type Match } from '#shared/types'

import { openFidelityDb, type FidelityDatabase } from './open'

/** Marketplace data may not be displayed once it is older than this. */
export const DIG_TTL_MS = 6 * 60 * 60 * 1000

/** How many digs are kept before the oldest are dropped. */
/**
 * How many digs are kept, all shops together (M36). It was five, all shops
 * together, and four check-ins at one shop pushed out the last full dig of
 * another. Now the rule is per shop first — see `pruneDigs` — and this is the
 * ceiling over everything.
 */
export const DIG_HISTORY_LIMIT = 24

/** Full digs kept per shop: the newest, and the one before it for the tempo. */
export const FULL_DIGS_PER_SHOP = 2

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
     * Stock is deleted, not thinned out.
     *
     * On a match, the score and the signals survive expiry — that is an
     * appraisal, and it is ours. On a stock row **every** field is marketplace
     * data; after six hours what would be left is an empty shell that is not
     * allowed to say anything (rule 4). So it goes.
     */
    const stock = tx.objectStore('stock')
    for (const key of await stock.getAllKeys(digRange(dig.id))) await stock.delete(key)

    await tx.objectStore('digs').put({ ...dig, status: 'expired' })
    await tx.done
  }

  /*
   * And the rows with a clock of their own (M31.18).
   *
   * A listing refetched from inside the sheet outlives its dig's expiry on
   * purpose — its own data is new — and the loop above would never look at it
   * again, because the dig it belongs to is already marked expired. Without
   * this, one refreshed price would sit on a screen for ever, which is the
   * one thing rule 4 is about.
   */
  const tx = database.transaction('matches', 'readwrite')
  for (const match of await tx.store.getAll()) {
    if (match.expired || match.freshUntil === undefined) continue
    if (match.freshUntil > now) continue
    await tx.store.put(stripMarketplaceData(match))
    expiredMatches += 1
  }
  await tx.done

  return expiredMatches
}

/**
 * Keeps the newest digs and deletes the rest, matches included. Dig ids are
 * ULIDs, so lexicographic order is chronological order.
 */
/**
 * What stays (M36): per shop the newest two full digs and every check-in
 * newer than the older of them, then a ceiling over everything. A shop that
 * was only ever checked keeps its newest two check-ins. Oldest go first.
 */
export function digsToDrop(digs: Dig[], keep: number = DIG_HISTORY_LIMIT): string[] {
  const newestFirst = [...digs].sort((a, b) => b.id.localeCompare(a.id))
  const kept: Dig[] = []
  const byDealer = new Map<string, Dig[]>()
  for (const dig of newestFirst) {
    const list = byDealer.get(dig.dealer)
    if (list) list.push(dig)
    else byDealer.set(dig.dealer, [dig])
  }
  for (const own of byDealer.values()) {
    const full = own.filter((dig) => (dig.depth ?? 'normal') !== 'neu')
    const floor = full[FULL_DIGS_PER_SHOP - 1]
    if (floor) {
      for (const dig of own) if (dig.id >= floor.id) kept.push(dig)
    } else if (full.length > 0) {
      kept.push(...own)
    } else {
      kept.push(...own.slice(0, FULL_DIGS_PER_SHOP))
    }
  }
  const keptIds = new Set(
    kept
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, keep)
      .map((dig) => dig.id),
  )
  return newestFirst.filter((dig) => !keptIds.has(dig.id)).map((dig) => dig.id)
}

export async function pruneDigs(
  db?: FidelityDatabase,
  keep: number = DIG_HISTORY_LIMIT,
): Promise<string[]> {
  const database = db ?? (await openFidelityDb())
  const digs = await database.getAll('digs')
  const doomed = digsToDrop(digs, keep)
  if (doomed.length === 0) return []

  const tx = database.transaction(['digs', 'matches', 'stock'], 'readwrite')
  const matches = tx.objectStore('matches')
  const stock = tx.objectStore('stock')
  for (const id of doomed) {
    for (const key of await matches.index('by-dig-score').getAllKeys(digRange(id))) {
      await matches.delete(key)
    }
    // A discarded dig takes its stock with it. Left behind, storage grows by a
    // few megabytes with every scan that nobody will ever look at.
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
