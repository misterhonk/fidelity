import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Dig, StockRow } from '#shared/types'
import type { ZodType } from 'zod'

import type { DiscogsClient } from './discogs/client'
import { DiscogsError } from './discogs/errors'
import { collectionPageSchema, wantlistPageSchema } from './discogs/schemas'

/**
 * A present for a friend (#245): what they want, in the shops you scanned,
 * within a budget, minus what they already own.
 *
 * Their wantlist and collection are Restricted Data (docs/09 §1.3). They are
 * read from Discogs, held in this function's variables and dropped when it
 * returns: nothing about the friend is written to IndexedDB, the URL or a log.
 * The result names records and shops, never them.
 *
 * Exact releases only — a wantlist entry names a pressing, and a gift of the
 * wrong one is the one present that is worse than none.
 */

export interface GiftIdea {
  releaseId: number
  listingId: number
  digId: string
  dealer: string
  displayName: string
  artist: string
  title: string
  condition: string | null
  price: number
  currency: string
}

export interface GiftResult {
  /** The wantlist would not open: private, or no such user. */
  closed: boolean
  wanted: number
  /** Wants left out because they own them; null when the collection is private. */
  owned: number | null
  /** The cheapest copy of each want within the budget, cheapest first. */
  ideas: GiftIdea[]
  /** Wants in stock, but only above the budget. */
  overBudget: number
  currency: string
  /** Rule 4: the earliest expiry of the digs the ideas come from. */
  expiresAt: number | null
}

export interface GiftProgress {
  read: number
  total: number
}

/** The newest dig per shop still inside its six hours. */
export function freshDigs(digs: Dig[], now: number): Map<string, Dig> {
  const newest = new Map<string, Dig>()
  for (const dig of digs) {
    if (dig.expiresAt <= now) continue
    const held = newest.get(dig.dealer)
    if (!held || dig.startedAt > held.startedAt) newest.set(dig.dealer, dig)
  }
  return new Map([...newest.values()].map((dig) => [dig.id, dig]))
}

/** The cheapest fresh copy of each wanted record within the budget. Pure. */
export function pickIdeas(
  rows: StockRow[],
  fresh: Map<string, Dig>,
  names: Map<string, string>,
  budget: number,
  currency: string,
): { ideas: GiftIdea[]; overBudget: number } {
  const cheapest = new Map<number, StockRow>()
  const above = new Set<number>()
  for (const row of rows) {
    const dig = fresh.get(row.digId)
    if (!dig || row.price === null || row.currency !== currency) continue
    if (row.price > budget) {
      above.add(row.releaseId)
      continue
    }
    const held = cheapest.get(row.releaseId)
    if (!held || row.price! < held.price!) cheapest.set(row.releaseId, row)
  }
  const ideas = [...cheapest.values()]
    .map((row) => {
      const dealer = fresh.get(row.digId)!.dealer
      return {
        releaseId: row.releaseId,
        listingId: row.listingId,
        digId: row.digId,
        dealer,
        displayName: names.get(dealer) || dealer,
        artist: row.artist ?? '',
        title: row.title ?? '',
        condition: row.condition,
        price: row.price!,
        currency,
      }
    })
    .sort((a, b) => a.price - b.price || a.artist.localeCompare(b.artist))
  const overBudget = [...above].filter((id) => !cheapest.has(id)).length
  return { ideas, overBudget }
}

const PER_PAGE = 100

/** Every release id behind a paged list, or null when Discogs will not show it. */
async function releaseIds<T extends { pagination: { pages: number; items: number } }>(
  client: DiscogsClient,
  path: string,
  schema: ZodType<T>,
  idsOf: (page: T) => number[],
  signal: AbortSignal,
  report?: (progress: GiftProgress) => void,
): Promise<number[] | null> {
  const ids: number[] = []
  for (let page = 1, pages = 1; page <= pages; page++) {
    let body: T
    try {
      body = await client.get(path, schema, { query: { page, per_page: PER_PAGE }, signal })
    } catch (error) {
      if (error instanceof DiscogsError && [401, 403, 404].includes(error.status)) return null
      throw error
    }
    pages = body.pagination.pages
    ids.push(...idsOf(body))
    report?.({ read: ids.length, total: body.pagination.items })
  }
  return ids
}

export async function findGifts(
  client: DiscogsClient,
  username: string,
  budget: number,
  now: number,
  signal: AbortSignal,
  report?: (progress: GiftProgress) => void,
): Promise<GiftResult> {
  const { currency } = await getPreferences()
  const user = `/users/${encodeURIComponent(username)}`
  const empty: GiftResult = {
    closed: false,
    wanted: 0,
    owned: 0,
    ideas: [],
    overBudget: 0,
    currency,
    expiresAt: null,
  }

  const wanted = await releaseIds(
    client,
    `${user}/wants`,
    wantlistPageSchema,
    (page) => page.wants.map((want) => want.id),
    signal,
    report,
  )
  if (wanted === null) return { ...empty, closed: true }

  const db = await openFidelityDb()
  const [digs, dealers] = await Promise.all([db.getAll('digs'), db.getAll('dealers')])
  const fresh = freshDigs(digs, now)
  const names = new Map(dealers.map((row) => [row.username, row.displayName]))

  const index = db.transaction('stock').store.index('by-release')
  const rows: StockRow[] = []
  for (const id of new Set(wanted)) rows.push(...(await index.getAll(IDBKeyRange.only(id))))

  let { ideas, overBudget } = pickIdeas(rows, fresh, names, budget, currency)
  const result = { ...empty, wanted: new Set(wanted).size, ideas, overBudget }
  // The wants that could be a gift: a priced copy in a fresh dig, in your currency.
  const candidates = new Set(
    rows
      .filter((row) => fresh.has(row.digId) && row.price !== null && row.currency === currency)
      .map((row) => row.releaseId),
  )
  // Their shelf costs requests, so it is only read when there is something to take off it.
  if (candidates.size === 0) return result

  const owned = await releaseIds(
    client,
    `${user}/collection/folders/0/releases`,
    collectionPageSchema,
    (page) => page.releases.map((release) => release.id),
    signal,
  )
  if (owned === null) return { ...result, owned: null, expiresAt: earliest(ideas, fresh) }

  const have = new Set(owned)
  // Only what was actually taken off the list counts, not every owned want.
  const left = [...candidates].filter((id) => have.has(id))
  ;({ ideas, overBudget } = pickIdeas(
    rows.filter((row) => !have.has(row.releaseId)),
    fresh,
    names,
    budget,
    currency,
  ))
  return { ...result, owned: left.length, ideas, overBudget, expiresAt: earliest(ideas, fresh) }
}

function earliest(ideas: GiftIdea[], fresh: Map<string, Dig>): number | null {
  const times = ideas.map((idea) => fresh.get(idea.digId)!.expiresAt)
  return times.length > 0 ? Math.min(...times) : null
}
