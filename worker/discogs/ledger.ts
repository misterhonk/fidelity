/**
 * What this device has asked Discogs for, and what it was spared (M31.9).
 *
 * **Discogs' own counter is unreadable from a browser.** `x-discogs-ratelimit-*`
 * is missing from `access-control-expose-headers` and a 429 arrives without
 * CORS headers at all (docs/02), so nothing here is Discogs' number — it is
 * this app's own record of what it put on the wire. Which is the more useful
 * number anyway, because it can be broken down by what caused it.
 *
 * Two things get counted, and the difference between them is the whole point:
 *
 * - **spent** — a request that went to Discogs and used one of the sixty
 *   slots a minute allows.
 * - **saved** — an answer that came from the catalogue or the hub instead. No
 *   slot, no waiting. This is what those two are *for*, and until now nobody
 *   could see it.
 *
 * In memory, for the life of this worker. Nothing is written to the database:
 * the screen says "this session" rather than "today", which is both simpler
 * and true. A ring bounded by an hour keeps it to a few thousand numbers.
 */

import { REQUEST_PURPOSES, type RateLedger, type RequestPurpose } from '#shared/types'

export type Purpose = RequestPurpose
export const PURPOSES = REQUEST_PURPOSES

export interface LedgerEntry {
  at: number
  purpose: Purpose
  /** True where the answer did not come from Discogs. */
  free: boolean
}

export type LedgerSnapshot = Omit<RateLedger, 'ceiling'>

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

let ring: LedgerEntry[] = []
/** When the client expects to be allowed to ask again, while it is waiting. */
let waitingUntil: number | null = null
const spent = blank()
const saved = blank()
let since: number | null = null

function blank(): Record<Purpose, number> {
  return { dig: 0, horizon: 0, record: 0, watch: 0, sync: 0, other: 0 }
}

/**
 * What a path was for, without asking the caller.
 *
 * Every request already carries its purpose in its address, so tagging each
 * call site would be forty edits for a fact the URL states. Ordered longest
 * first: `/users/{u}/inventory` is a dig and `/users/{u}` on its own is the
 * watcher asking how big a shop is.
 */
export function purposeOf(path: string): Purpose {
  if (path.includes('/inventory')) return 'dig'
  if (path.startsWith('/marketplace/')) return 'dig'
  if (path.startsWith('/releases/')) return 'record'
  if (path.startsWith('/masters/') || path.startsWith('/artists/')) return 'horizon'
  if (path.startsWith('/labels/') || path.startsWith('/database/search')) return 'horizon'
  if (path.includes('/collection') || path.includes('/wants')) return 'sync'
  if (path.includes('/orders')) return 'sync'
  if (path.startsWith('/users/')) return 'watch'
  return 'other'
}

/** One request, gone to Discogs. */
export function note(path: string, at = Date.now()): void {
  add({ at, purpose: purposeOf(path), free: false })
}

/**
 * One answer that cost no slot — the catalogue or the hub had it.
 *
 * Counted with the purpose it would have had, so the two bars line up: the
 * saved column of "horizon" is exactly the requests the catalogue took over.
 */
export function noteFree(purpose: Purpose, count = 1, at = Date.now()): void {
  for (let i = 0; i < count; i += 1) add({ at, purpose, free: true })
}

function add(entry: LedgerEntry): void {
  since ??= entry.at
  ring.push(entry)
  ;(entry.free ? saved : spent)[entry.purpose] += 1

  // Bounded by an hour, and only swept when it has grown — a filter on every
  // request would be a copy of the whole ring fifty times a minute.
  if (ring.length > 4000) ring = ring.filter((row) => row.at > entry.at - HOUR_MS)
}

/**
 * The client has been told to wait (M32.5).
 *
 * A browser never sees the 429 itself — Cloudflare serves it without CORS
 * headers, so `fetch()` simply rejects (docs/02) — and the client's answer is
 * to sleep a minute and try again. From the outside that is a progress bar
 * that stops moving, which reads as "broken" rather than "waiting", and on a
 * big shop it is the difference between a dig somebody finishes and a dig
 * somebody gives up on.
 *
 * Recorded here because this is already the module both the meter and the
 * worker read, and it costs one number.
 */
export function noteBackoff(until: number): void {
  waitingUntil = until
}

export function ledger(now = Date.now()): LedgerSnapshot {
  const from = now - MINUTE_MS
  if (waitingUntil !== null && waitingUntil <= now) waitingUntil = null
  return {
    waitingUntil,
    minute: ring.filter((row) => row.at > from),
    spent: { ...spent },
    saved: { ...saved },
    spentTotal: total(spent),
    savedTotal: total(saved),
    since,
  }
}

function total(counts: Record<Purpose, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

/** For tests: back to an empty sheet. */
export function forgetLedger(): void {
  ring = []
  since = null
  waitingUntil = null
  for (const purpose of PURPOSES) {
    spent[purpose] = 0
    saved[purpose] = 0
  }
}
