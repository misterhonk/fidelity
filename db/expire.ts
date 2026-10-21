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
 * Until when a match's marketplace half may be shown (rule 4).
 *
 * The later of two clocks: the dig's, which every row of a scan shares, and
 * the row's own, which a refetch gives it (M31.18, and a whole-dig refresh
 * since 0.112). Whichever is later is the age of what the row actually says.
 */
export function showableUntil(match: Match, digExpiresAt: number | undefined): number {
  return Math.max(match.freshUntil ?? -Infinity, digExpiresAt ?? -Infinity)
}

/**
 * The match as it may be shown at `now`: as it is, or stripped.
 *
 * The screens read through this, so a price past its six hours is never handed
 * out — whether or not a sweep has already been round to delete it.
 */
export function asShown(match: Match, digExpiresAt: number | undefined, now: number): Match {
  if (match.expired || showableUntil(match, digExpiresAt) > now) return match
  return stripMarketplaceData(match)
}

/**
 * Removes marketplace data that is past six hours (rule 4).
 *
 * Called by the keeper, on arrival and every twenty minutes after — before its
 * own sign-in and busy checks, because a deadline does not wait for either —
 * and by `sweepIfDue` ahead of every request the worker answers.
 *
 * Hiding is done where data is read (`asShown`). This is the second line:
 * hiding a price satisfies the terms, deleting it is what we would want done
 * with ours. Which is why it is total rather than sampled — and why it no
 * longer trusts a dig's `expired` status. Three paths set that status without
 * stripping anything (an interrupted dig retired on open, a resume refused, a
 * refresh cut off half way), and a dig marked expired was the one place this
 * loop never looked again. Every row is judged by its own clock now.
 */
export async function expireDigs(
  db?: FidelityDatabase,
  now: number = Date.now(),
): Promise<number> {
  return (await sweep(db, now)).expired
}

async function sweep(
  db: FidelityDatabase | undefined,
  now: number,
): Promise<{ expired: number; next: number }> {
  const database = db ?? (await openFidelityDb())
  let expiredMatches = 0
  let next = Infinity

  const tx = database.transaction(['digs', 'matches', 'stock'], 'readwrite')
  const digs = tx.objectStore('digs')
  const stock = tx.objectStore('stock')
  const until = new Map<string, number>()

  for (const dig of await digs.getAll()) {
    until.set(dig.id, dig.expiresAt)
    if (dig.expiresAt > now) {
      next = Math.min(next, dig.expiresAt)
      continue
    }
    /*
     * Stock is deleted, not thinned out.
     *
     * On a match, the score and the signals survive expiry — that is an
     * appraisal, and it is ours. On a stock row **every** field is marketplace
     * data; after six hours what would be left is an empty shell that is not
     * allowed to say anything (rule 4). So it goes.
     */
    for (const key of await stock.getAllKeys(digRange(dig.id))) await stock.delete(key)
    if (dig.status !== 'expired') await digs.put({ ...dig, status: 'expired' })
  }

  const matches = tx.objectStore('matches')
  for (const match of await matches.getAll()) {
    if (match.expired) continue
    const at = showableUntil(match, until.get(match.digId))
    if (at > now) {
      next = Math.min(next, at)
      continue
    }
    await matches.put(stripMarketplaceData(match))
    expiredMatches += 1
  }
  await tx.done

  return { expired: expiredMatches, next }
}

/*
 * The sweep ahead of every answer.
 *
 * The keeper's twenty minutes leave a window, and a cold start leaves a race:
 * a screen asks for its dig before the keeper's first tick has stripped it
 * (found on 2026-10-21 — /dig showed the old prices beside the "expired"
 * notice). So the worker sweeps before it answers, but only when a deadline
 * has passed: between deadlines this is a comparison of two numbers.
 *
 * `next` is the earliest clock the last sweep saw still running. Another tab
 * can add data this worker has not seen, so it is never trusted for longer
 * than the keeper's own interval — and anything new carries six hours, far
 * beyond that, so nothing it adds can fall due unseen.
 */
const RECHECK_MS = 20 * 60 * 1000
let due = 0
let running: Promise<void> | null = null

export function sweepIfDue(now: number = Date.now()): Promise<void> {
  if (now < due) return Promise.resolve()
  running ??= sweep(undefined, now)
    .then(({ next }) => {
      due = Math.min(next, now + RECHECK_MS)
    })
    .catch(() => {
      // Storage that will not open is its own error elsewhere, and loudly.
      due = now + 60_000
    })
    .finally(() => {
      running = null
    })
  return running
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
