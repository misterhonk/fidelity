import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { dealerStock } from '~~/worker/dealers/stock'
import type { Dig, StockRow } from '#shared/types'

/**
 * A shop's inventory, filtered by one bar.
 *
 * The numbers under "labels in stock" were dead information: you could see
 * that a shop carries thirteen records on Kompakt, and could reach none of
 * them. The interesting case is precisely the one the find list cannot speak
 * to — a label you own nothing by produces no match and may still be exactly
 * what you are looking for.
 */
afterEach(async () => {
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000

const dig = (id: string, over: Partial<Dig> = {}): Dig =>
  ({
    id,
    dealer: 'fatplastics',
    status: 'done',
    startedAt: NOW,
    finishedAt: NOW,
    expiresAt: NOW + 6 * 60 * 60 * 1000,
    listingsTotal: 3,
    listingsScanned: 3,
    uniqueSeen: 3,
    coverage: 1,
    depth: 'normal',
    truncated: false,
    matchCount: 0,
    apiRequests: 1,
    cursor: null,
    ...over,
  }) as Dig

const row = (digId: string, listingId: number, over: Partial<StockRow> = {}): StockRow => ({
  digId,
  listingId,
  releaseId: listingId * 10,
  label: 'Warp Records',
  decade: 1990,
  title: `Platte ${listingId}`,
  artist: 'Autechre',
  catno: null,
  format: 'Vinyl',
  year: 1994,
  condition: 'VG+',
  price: 1200,
  currency: 'EUR',
  ...over,
})

async function seed(rows: StockRow[], digs: Dig[] = [dig('01J')]) {
  const db = await openFidelityDb()
  for (const one of digs) await db.put('digs', one)
  for (const one of rows) await db.put('stock', one)
}

describe('the stock behind a bar', () => {
  it('hands back only the chosen label', async () => {
    await seed([row('01J', 1), row('01J', 2), row('01J', 3, { label: 'Kompakt' })])

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.total).toBe(2)
    expect(page.rows.map((r) => r.listingId).sort()).toEqual([1, 2])
  })

  it('hands back only the chosen decade', async () => {
    await seed([row('01J', 1), row('01J', 2, { decade: 1980, year: 1985 })])

    const page = await dealerStock({ dealer: 'fatplastics', decade: 1980 })

    expect(page.total).toBe(1)
    expect(page.rows[0]?.year).toBe(1985)
  })

  /**
   * Two shops must not bleed into each other.
   *
   * The dig comes first in both index keys, and precisely for this: without
   * it, "Warp at fatplastics" would be the same set as "Warp anywhere".
   */
  it('never mixes two shops', async () => {
    await seed(
      [row('01J', 1), row('01K', 2)],
      [dig('01J'), dig('01K', { dealer: 'spirax.records' })],
    )

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.rows.map((r) => r.listingId)).toEqual([1])
  })

  /**
   * An expired dig does not count — and does not simply stay silent.
   *
   * The inventory is marketplace data and lives six hours (rule 4); after that
   * the rows are deleted, not stale. An empty list with no `scannedAt` means
   * "we do not know right now" and must not appear on screen as "the shop does
   * not carry that".
   */
  it('says nothing rather than something wrong once the dig is expired', async () => {
    await seed([row('01J', 1)], [dig('01J', { status: 'expired' })])

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.rows).toEqual([])
    expect(page.total).toBe(0)
    expect(page.scannedAt).toBeNull()
  })

  /** And the newest dig wins: ULIDs are lexicographically chronological. */
  it('reads the newest dig of that shop', async () => {
    await seed([row('01J', 1), row('01K', 2)], [dig('01J'), dig('01K')])

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.rows.map((r) => r.listingId)).toEqual([2])
  })

  /**
   * In portions — the whole reason a large shop stays affordable.
   *
   * Fetching twenty thousand rows to show fifty would be noticeable on a
   * phone. `total` still tells the truth, or nobody would know there is more.
   */
  it('loads a page at a time and still counts them all', async () => {
    await seed(Array.from({ length: 7 }, (_, i) => row('01J', i + 1)))

    const first = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records', limit: 3 })
    expect(first.rows).toHaveLength(3)
    expect(first.total).toBe(7)

    const second = await dealerStock({
      dealer: 'fatplastics',
      label: 'Warp Records',
      offset: 3,
      limit: 3,
    })
    expect(second.rows).toHaveLength(3)

    const overlap = new Set([...first.rows, ...second.rows].map((r) => r.listingId))
    expect(overlap.size).toBe(6)
  })

  it('is empty for a shop nobody has scanned', async () => {
    await seed([row('01J', 1)])

    const page = await dealerStock({ dealer: 'niemand', label: 'Warp Records' })

    expect(page).toEqual({ rows: [], total: 0, scannedAt: null })
  })
})
