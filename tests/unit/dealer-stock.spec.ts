import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { dealerStock } from '~~/worker/dealers/stock'
import type { Dig, StockRow } from '#shared/types'

/**
 * Das Sortiment eines Ladens, nach einem Balken gefiltert.
 *
 * Die Zahlen unter „Labels in stock" waren tote Auskunft: man sah, dass ein
 * Laden dreizehn Platten auf Kompakt führt, und kam an keine davon heran. Der
 * interessante Fall ist gerade der, in dem die Fundliste nichts sagen kann —
 * ein Label ohne eigene Platten erzeugt keinen Treffer und ist trotzdem
 * womöglich genau das Gesuchte.
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
   * Zwei Läden dürfen sich nicht vermischen.
   *
   * Der Dig steht in beiden Indexschlüsseln vorn, und genau dafür: ohne ihn
   * wäre „Warp bei fatplastics" dieselbe Menge wie „Warp überall".
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
   * Ein abgelaufener Dig zählt nicht — und schweigt nicht einfach.
   *
   * Das Sortiment ist ein Marktplatzdatum und lebt sechs Stunden (Regel 4);
   * danach sind die Zeilen gelöscht, nicht veraltet. Eine leere Liste ohne
   * `scannedAt` heißt „wir wissen es gerade nicht" und darf auf dem Schirm
   * nicht als „der Laden führt das nicht" erscheinen.
   */
  it('says nothing rather than something wrong once the dig is expired', async () => {
    await seed([row('01J', 1)], [dig('01J', { status: 'expired' })])

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.rows).toEqual([])
    expect(page.total).toBe(0)
    expect(page.scannedAt).toBeNull()
  })

  /** Und der jüngste Dig gewinnt: ULIDs sind lexikographisch chronologisch. */
  it('reads the newest dig of that shop', async () => {
    await seed([row('01J', 1), row('01K', 2)], [dig('01J'), dig('01K')])

    const page = await dealerStock({ dealer: 'fatplastics', label: 'Warp Records' })

    expect(page.rows.map((r) => r.listingId)).toEqual([2])
  })

  /**
   * Portionsweise — der ganze Grund, warum ein großer Laden bezahlbar bleibt.
   *
   * Zwanzigtausend Zeilen zu holen, um fünfzig zu zeigen, wäre auf einem
   * Telefon spürbar. `total` sagt trotzdem die Wahrheit, sonst wüsste niemand,
   * dass es weitergeht.
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
