import type { CollectionItem, HorizonChunk, HorizonKind, WantlistItem } from '#shared/types'

/**
 * The runtime lookup a dig consults once per listing.
 *
 * Built once from the stored chunks — about 30 ms for a few hundred thousand
 * ids — and then answered in O(1). This is the whole point of the horizon: the
 * expensive question was asked at expansion time, so the dig only has to look
 * things up.
 */

export interface HorizonHit {
  kind: HorizonKind
  entityId: number
  name: string
  /** Index into ROLE_TABLE. 0 is a main credit. */
  role: number
  year: number
  catnoNum: number
  catnoPrefix?: string
}

/** A catalogue series, e.g. Brain's 1000s or Blue Note's 4000s. */
export interface CatalogueRun {
  label: string
  prefix: string
  /** Sorted numbers that exist in the series. */
  numbers: number[]
  /** Which of them are already in the collection. */
  owned: Set<number>
}

export interface HorizonLookup {
  /** releaseId → every entity that points at it. */
  byRelease: Map<number, HorizonHit[]>
  /** Masters of wantlist albums — the basis for "same album, other pressing". */
  wantlistMasters: Map<number, { title: string; year: number }>
  /** Masters of records you own on something other than vinyl. */
  upgradeMasters: Map<number, { title: string; formats: string[] }>
  /** Per artist: how much of their main discography you already have. */
  discography: Map<
    number,
    { name: string; owned: number; total: number; from: number; to: number }
  >
  /** Per label: the catalogue series, keyed by `${labelId}:${prefix}`. */
  runs: Map<string, CatalogueRun>
  /** Per label: catalogue size, for the lift. */
  catalogueSizes: Map<number, number>
}

const EMPTY: HorizonHit[] = []

export function buildLookup(
  chunks: HorizonChunk[],
  collection: CollectionItem[],
  wantlist: WantlistItem[],
): HorizonLookup {
  const byRelease = new Map<number, HorizonHit[]>()
  const catalogueSizes = new Map<number, number>()
  const runs = new Map<string, CatalogueRun>()
  const discography = new Map<
    number,
    { name: string; owned: number; total: number; from: number; to: number }
  >()

  const ownedReleaseIds = new Set(collection.map((item) => item.releaseId))

  for (const chunk of chunks) {
    if (chunk.kind === 'label') catalogueSizes.set(chunk.entityId, chunk.catalogueSize ?? 0)

    for (let i = 0; i < chunk.releaseIds.length; i++) {
      const releaseId = chunk.releaseIds[i]!
      const hit: HorizonHit = {
        kind: chunk.kind,
        entityId: chunk.entityId,
        name: chunk.name,
        role: chunk.roles[i] ?? 0,
        year: chunk.years[i] ?? 0,
        catnoNum: chunk.catnoNums?.[i] ?? 0,
        catnoPrefix: chunk.catnoPrefix,
      }

      const existing = byRelease.get(releaseId)
      if (existing) existing.push(hit)
      else byRelease.set(releaseId, [hit])
    }

    if (chunk.kind === 'artist') {
      // Only main credits count as a discography; producing someone else's
      // record is not a gap in your own collection of that artist.
      const mainYears: number[] = []
      let owned = 0
      let total = 0

      for (let i = 0; i < chunk.releaseIds.length; i++) {
        if ((chunk.roles[i] ?? 0) !== 0) continue
        total += 1
        const year = chunk.years[i] ?? 0
        if (ownedReleaseIds.has(chunk.releaseIds[i]!)) {
          owned += 1
          if (year > 0) mainYears.push(year)
        }
      }

      discography.set(chunk.entityId, {
        name: chunk.name,
        owned,
        total,
        // The window comes from what you collect: somebody who only owns
        // sixties Miles does not want an eighties record (docs/04 §S4).
        from: mainYears.length > 0 ? Math.min(...mainYears) : 0,
        to: mainYears.length > 0 ? Math.max(...mainYears) : 0,
      })
    }

    if (chunk.kind === 'label' && chunk.catnoPrefix && chunk.catnoNums) {
      const key = `${chunk.entityId}:${chunk.catnoPrefix}`
      const numbers: number[] = []
      const owned = new Set<number>()

      for (let i = 0; i < chunk.releaseIds.length; i++) {
        const num = chunk.catnoNums[i] ?? 0
        if (num <= 0) continue
        numbers.push(num)
        if (ownedReleaseIds.has(chunk.releaseIds[i]!)) owned.add(num)
      }

      if (numbers.length > 0) {
        runs.set(key, {
          label: chunk.name,
          prefix: chunk.catnoPrefix,
          numbers: [...new Set(numbers)].sort((a, b) => a - b),
          owned,
        })
      }
    }
  }

  const wantlistMasters = new Map<number, { title: string; year: number }>()
  for (const want of wantlist) {
    if (want.masterId > 0)
      wantlistMasters.set(want.masterId, { title: want.title, year: want.year })
  }

  // "You have it on CD, here is the vinyl." Only records you own on something
  // that is not vinyl can be upgraded — the rest is just a second copy.
  const upgradeMasters = new Map<number, { title: string; formats: string[] }>()
  for (const item of collection) {
    if (item.masterId <= 0) continue
    const isVinyl = item.formats.some((format) => /vinyl|lp|12"|10"|7"/i.test(format))
    if (!isVinyl)
      upgradeMasters.set(item.masterId, { title: item.title, formats: item.formats })
  }

  return { byRelease, wantlistMasters, upgradeMasters, discography, runs, catalogueSizes }
}

export function hitsFor(lookup: HorizonLookup, releaseId: number): HorizonHit[] {
  return lookup.byRelease.get(releaseId) ?? EMPTY
}

/**
 * The lift, at last.
 *
 * docs/04 §S5 defines it as share-here over share-globally, and the global
 * denominator disappeared with the catalog dumps (ADR-007). The catalogue
 * sizes the horizon now carries give it back — not against all of Discogs,
 * which would need a corpus size nobody can measure from here, but against the
 * labels this collection actually buys from.
 *
 * Ten Warner records mean nothing because Warner's catalogue is enormous;
 * three Ohr records mean everything because Ohr's is tiny. That comparison is
 * exactly what the signal was after, and it needs no invented constant.
 */
export function labelLift(
  lookup: HorizonLookup,
  labelId: number,
  ownedCounts: Map<number, number>,
): number | null {
  const size = lookup.catalogueSizes.get(labelId)
  if (!size || size <= 0) return null

  let ownedTotal = 0
  let sizeTotal = 0
  for (const [id, owned] of ownedCounts) {
    const other = lookup.catalogueSizes.get(id)
    if (!other || other <= 0) continue
    ownedTotal += owned
    sizeTotal += other
  }

  if (ownedTotal === 0 || sizeTotal === 0) return null

  const actual = (ownedCounts.get(labelId) ?? 0) / ownedTotal
  const expected = size / sizeTotal
  return expected > 0 ? actual / expected : null
}
