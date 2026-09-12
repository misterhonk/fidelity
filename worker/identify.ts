import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from './discogs/client'
import type { CatalogueSource } from '#shared/ports'
import type { CollectionItem, Identified, WantlistItem } from '#shared/types'

/**
 * Recognising a record you are holding (M13, stage 1: barcode).
 *
 * **A barcode is not unique, and that is the most important finding here.**
 * Measured 2026-09-11: `5012394144777` returns **eight** releases across five
 * countries — UK, Italy, France, Portugal, Europe — and the release the
 * barcode came from is seventh. A barcode names a *release*, not a *pressing*.
 *
 * For Fidelity's question that changes nothing, quite the opposite: "do I
 * already have this?" is a question about the record and not about the
 * pressing plant anyway. The interface just must not pretend the answer is
 * one.
 *
 * **And not every record has one.** A sample of ten records from a real
 * collection: eight yes, two no — a club 12" and a white label. Precisely the
 * cases stage 2 (recognising the sleeve) is meant for.
 */

const searchSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string().optional(),
        year: z.union([z.number().int(), z.string()]).optional(),
        country: z.string().optional(),
        thumb: z.string().optional(),
        format: z.array(z.string()).optional(),
        /** Every company on the record, the label first (measured 2026-09-11). */
        label: z.array(z.string()).optional(),
        catno: z.string().optional(),
        /** On every row where the release has one (measured 2026-09-11, 8 of 8). */
        master_id: z.number().int().nullable().optional(),
      }),
    )
    .default([]),
})

/** Enough to show the choice without filling a page with it. */
const MAX_CANDIDATES = 12

/** Digits only — a scanner sometimes hands over spaces or hyphens too. */
export function cleanBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // EAN-8 through EAN-13/UPC-A. Anything shorter is not a barcode, anything
  // longer is not one a record carries.
  return digits.length >= 8 && digits.length <= 14 ? digits : null
}

/**
 * Barcode or run-out groove? The field takes both, so somebody has to decide.
 *
 * Digits only (plus the spaces and hyphens as they appear on the sleeve) is a
 * barcode. Anything else is a run-out — those nearly always carry letters,
 * often a mastering signature like `PHRUPMASTERGENERAL`.
 *
 * As a function and not as an expression in a template: a mutation probe
 * showed that a test which only reads the source never sees the decision —
 * nailed to `true`, it stayed green.
 */
export function looksLikeBarcode(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && /^[\d\s-]+$/.test(trimmed)
}

/**
 * The catalogue first (M21.6): an index over every identifier in the dump,
 * no request. Null is "no catalogue"; an empty list is "the build does not
 * carry this stamp" — a record newer than the dump, or a typo — and both
 * fall through to the search request that always was. Only exact stamps;
 * fragments are the search's job, as measured on 2026-09-11.
 */
async function fromCatalogue(
  catalogue: CatalogueSource | null | undefined,
  code: string,
  query: { barcode?: string; runout?: string },
): Promise<Identified | null> {
  if (!catalogue) return null
  const ids = await catalogue.identify(query)
  if (!ids || ids.length === 0) return null
  const rows = []
  for (const id of ids.slice(0, MAX_CANDIDATES)) {
    const release = await catalogue.release(id)
    if (!release) continue
    rows.push({
      id: release.id,
      title: [release.artists.join(', '), release.title].filter(Boolean).join(' - '),
      year: release.year ?? undefined,
      country: release.country,
      thumb: '',
      format: release.formats,
      label: release.labels.map((label) => label.name),
      catno: release.labels[0]?.catno,
      master_id: release.masterId || null,
    })
  }
  return rows.length > 0 ? withOwnership(code, rows) : null
}

export async function identify(
  client: DiscogsClient,
  raw: string,
  signal?: AbortSignal,
  catalogue?: CatalogueSource | null,
): Promise<Identified> {
  const barcode = cleanBarcode(raw)
  if (!barcode) return nothing(raw)
  const known = await fromCatalogue(catalogue, barcode, { barcode })
  if (known) return known

  const answer = await client.get('/database/search', searchSchema, {
    query: { barcode, type: 'release', per_page: String(MAX_CANDIDATES) },
    signal,
  })

  return withOwnership(barcode, answer.results.slice(0, MAX_CANDIDATES))
}

/**
 * And the second route: the number in the run-out groove (M13, stage 2).
 *
 * **The better identifier, and that is measured.** A sample of twelve records
 * from a real collection on 2026-09-11: ten had a barcode, **eleven had a
 * run-out**, none had neither — and the two without a barcode had a run-out.
 * On club vinyl the identifier is in the run-out, not on the sleeve.
 *
 * It is also **more precise**: the full string
 * `MPO SK 032 A1 G PHRUPMASTERGENERAL T2T LONDON` returns exactly **one** hit
 * where a barcode returns eight.
 *
 * Fragments work too, but become useless quickly: `MPO SK 032 A1` gave 21
 * hits, `SK 032 A1` three thousand four hundred. A distinctive mastering
 * signature on its own (`PHRUPMASTERGENERAL T2T`) narrowed it to two. Which is
 * why the screen says how many there were — the more that is typed in, the
 * shorter the list.
 */
export async function identifyByRunout(
  client: DiscogsClient,
  runout: string,
  signal?: AbortSignal,
  catalogue?: CatalogueSource | null,
): Promise<Identified> {
  const text = runout.trim()
  // Shorter than that is not a run-out but a typo — and a search for three
  // characters fetches half the catalogue.
  if (text.length < 6) return nothing(text)
  const known = await fromCatalogue(catalogue, text, { runout: text })
  if (known) return known

  const answer = await client.get('/database/search', searchSchema, {
    query: { q: text, type: 'release', per_page: String(MAX_CANDIDATES) },
    signal,
  })

  return withOwnership(text, answer.results.slice(0, MAX_CANDIDATES))
}

/**
 * The question somebody is standing in the shop for — against the **local**
 * database.
 *
 * It costs nothing and works when the connection has gone again. **Every**
 * candidate is checked: your own pressing can be a different one from what the
 * search names first — in the measurement of 2026-09-11 it was seventh of
 * eight. Anyone checking only the first says "you do not have it" about a
 * record on their own shelf.
 */
async function withOwnership(
  code: string,
  results: {
    id: number
    title?: string
    year?: number | string
    country?: string
    thumb?: string
    format?: string[]
    label?: string[]
    catno?: string
    master_id?: number | null
  }[],
): Promise<Identified> {
  const candidates = results.map((row) => ({
    releaseId: row.id,
    title: row.title ?? '',
    year: typeof row.year === 'number' ? row.year : Number(row.year) || null,
    country: row.country ?? '',
    thumbUrl: row.thumb ?? '',
    format: (row.format ?? []).join(' · '),
    label: row.label?.[0] ?? '',
    catno: row.catno ?? '',
    masterId: row.master_id ?? 0,
  }))

  const db = await openFidelityDb()
  const owned: CollectionItem[] = []
  const wanted: WantlistItem[] = []

  for (const candidate of candidates) {
    for (const item of await db.getAllFromIndex(
      'collection',
      'by-release',
      candidate.releaseId,
    )) {
      owned.push(item)
    }
    const want = await db.get('wantlist', candidate.releaseId)
    if (want) wanted.push(want)
  }

  /*
   * And the album, not only the pressing (M20 #3).
   *
   * Measured with a real wantlist on 2026-09-11: the screen said "not on your
   * wantlist" about a record whose album stood on it three lines below, in a
   * different pressing. The master says what the exact id cannot — and it is
   * listed apart from the exact hits, because "you have this" and "you have
   * another pressing of this" are two different answers in a shop.
   */
  const exactReleases = new Set(candidates.map((candidate) => candidate.releaseId))
  const masters = [...new Set(candidates.map((c) => c.masterId).filter((id) => id > 0))]
  const ownedAlbums: CollectionItem[] = []
  const wantedAlbums: WantlistItem[] = []
  for (const masterId of masters) {
    for (const item of await db.getAllFromIndex('collection', 'by-master', masterId)) {
      if (!exactReleases.has(item.releaseId)) ownedAlbums.push(item)
    }
    for (const item of await db.getAllFromIndex('wantlist', 'by-master', masterId)) {
      if (!exactReleases.has(item.releaseId)) wantedAlbums.push(item)
    }
  }

  return { barcode: code, candidates, owned, wanted, ownedAlbums, wantedAlbums }
}

function nothing(code: string): Identified {
  return {
    barcode: code,
    candidates: [],
    owned: [],
    wanted: [],
    ownedAlbums: [],
    wantedAlbums: [],
  }
}
