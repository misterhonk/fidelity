import { describe, expect, it } from 'vitest'

import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'
import { buildLookup, labelLift } from '~~/worker/horizon/lookup'
import {
  artistGap,
  catalogueRun,
  creditGraph,
  formatUpgrade,
  wantlistPressing,
} from '~~/worker/match/signals'

function chunk(
  over: Partial<HorizonChunk> & Pick<HorizonChunk, 'kind' | 'entityId'>,
): HorizonChunk {
  const ids = over.releaseIds ?? Int32Array.from([])
  return {
    key: `${over.kind}:${over.entityId}`,
    name: 'Entität',
    fetchedAt: 0,
    complete: true,
    requests: 1,
    releaseIds: ids,
    roles: over.roles ?? new Uint8Array(ids.length),
    years: over.years ?? new Int16Array(ids.length),
    ...over,
  } as HorizonChunk
}

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 1,
    masterId: 0,
    title: 'Platte',
    artistIds: [],
    artistNorms: [],
    artistNames: [],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 2000,
    rating: 0,
    addedAt: '',
    ...over,
  }
}

const listing = (over: Partial<Parameters<typeof artistGap>[0]> = {}) => ({
  releaseId: 500,
  catno: null,
  format: '12"',
  year: 2004,
  ...over,
})

describe('S2 — same album, different pressing', () => {
  const master = chunk({
    kind: 'master',
    entityId: 77,
    name: 'Dummy',
    releaseIds: Int32Array.from([500, 501]),
    years: Int16Array.from([1994, 2017]),
  })
  const wantlist = [
    record({ releaseId: 999, masterId: 77, title: 'Dummy', year: 1994 }),
  ] as WantlistItem[]
  const lookup = buildLookup([master], [], wantlist)

  it('fires for another pressing of a wantlist album', () => {
    const signal = wantlistPressing(listing({ year: 1994 }), lookup, false)
    expect(signal?.type).toBe('WANTLIST_PRESSING')
    expect(signal?.confidence).toBe(0.9)
  })

  it('is suspicious of a pressing far younger than the one wanted', () => {
    // A 2017 cut of a 1994 album is a reissue, and a reissue is not what was
    // asked for.
    expect(
      wantlistPressing(listing({ releaseId: 501, year: 2017 }), lookup, false)?.confidence,
    ).toBe(0.6)
  })

  it('stays out of the way when the exact release is already a match', () => {
    expect(wantlistPressing(listing(), lookup, true)).toBeNull()
  })

  it('says nothing about an album that is not wanted', () => {
    const other = buildLookup([master], [], [])
    expect(wantlistPressing(listing(), other, false)).toBeNull()
  })
})

describe('S4 — the discography gap', () => {
  // Six main releases, four of them owned.
  const artist = chunk({
    kind: 'artist',
    entityId: 40135,
    name: 'Robag Wruhme',
    releaseIds: Int32Array.from([1, 2, 3, 4, 500, 600]),
    roles: Uint8Array.from([0, 0, 0, 0, 0, 0]),
    years: Int16Array.from([2002, 2003, 2004, 2005, 2006, 2020]),
  })
  const collection = [1, 2, 3, 4].map((id) => record({ releaseId: id, year: 2000 + id }))
  const lookup = buildLookup([artist], collection, [])

  it('fires when you have most of it and this closes the gap', () => {
    const signal = artistGap(listing({ releaseId: 500, year: 2006 }), lookup)
    expect(signal?.type).toBe('ARTIST_GAP')
    expect(signal?.confidence).toBeCloseTo(4 / 6)
    expect(signal?.evidence).toMatchObject({ owned: 4, total: 6 })
  })

  it('ignores a record far outside the years you actually collect', () => {
    // Somebody who only owns early Robag does not want the 2020 record.
    expect(artistGap(listing({ releaseId: 600, year: 2020 }), lookup)).toBeNull()
  })

  it('needs more than a couple of records before it calls anything a run', () => {
    const thin = buildLookup([artist], [record({ releaseId: 1 })], [])
    expect(artistGap(listing({ releaseId: 500 }), thin)).toBeNull()
  })

  it('counts only main credits, not production work', () => {
    const producer = chunk({
      kind: 'artist',
      entityId: 40135,
      name: 'Conny Plank',
      releaseIds: Int32Array.from([1, 2, 3, 500]),
      roles: Uint8Array.from([0, 0, 0, 1]),
      years: Int16Array.from([1973, 1974, 1975, 1976]),
    })
    const owned = [1, 2, 3].map((id) => record({ releaseId: id, year: 1972 + id }))
    // Producing someone else's record is not a hole in your own shelf.
    expect(
      artistGap(listing({ releaseId: 500, year: 1976 }), buildLookup([producer], owned, [])),
    ).toBeNull()
  })
})

describe('S6 — the catalogue series', () => {
  const label = chunk({
    kind: 'label',
    entityId: 5,
    name: 'Brain',
    releaseIds: Int32Array.from([1, 2, 3, 4, 500]),
    catnoNums: Int32Array.from([1001, 1002, 1004, 1005, 1031]),
    catnoPrefix: 'BRAIN',
  })
  const collection = [1, 2, 3, 4].map((id) => record({ releaseId: id }))
  const lookup = buildLookup([label], collection, [])

  it('fires for a number sitting among ones you own', () => {
    const signal = catalogueRun(listing({ releaseId: 500, catno: 'BRAIN 1031' }), lookup)
    expect(signal?.type).toBe('CATALOG_RUN')
    expect(signal?.evidence).toMatchObject({ label: 'Brain', prefix: 'BRAIN', number: 1031 })
  })

  it('says nothing when you own nothing nearby', () => {
    const lonely = buildLookup([label], [record({ releaseId: 1 })], [])
    expect(catalogueRun(listing({ releaseId: 500, catno: 'BRAIN 1031' }), lonely)).toBeNull()
  })

  it('needs a catalogue number it can actually read', () => {
    expect(catalogueRun(listing({ releaseId: 500, catno: 'none' }), lookup)).toBeNull()
    expect(catalogueRun(listing({ releaseId: 500, catno: null }), lookup)).toBeNull()
  })
})

describe('S8 — the credit graph', () => {
  const producer = chunk({
    kind: 'artist',
    entityId: 40135,
    name: 'Conny Plank',
    releaseIds: Int32Array.from([1, 2, 500]),
    roles: Uint8Array.from([0, 0, 1]),
    years: Int16Array.from([1973, 1974, 1975]),
  })
  const lookup = buildLookup(
    [producer],
    [record({ releaseId: 1 }), record({ releaseId: 2 })],
    [],
  )

  it('fires when somebody you collect worked on it', () => {
    const signal = creditGraph(listing({ releaseId: 500 }), lookup)
    expect(signal?.type).toBe('CREDIT_GRAPH')
    expect(signal?.evidence).toMatchObject({ person: 'Conny Plank', owned: 2 })
  })

  it('leaves a main credit to S3, where it belongs', () => {
    expect(creditGraph(listing({ releaseId: 1 }), lookup)).toBeNull()
  })
})

describe('S9 — the format upgrade', () => {
  const master = chunk({
    kind: 'master',
    entityId: 88,
    name: 'Homework',
    releaseIds: Int32Array.from([500]),
  })
  const onCd = [
    record({ releaseId: 1, masterId: 88, title: 'Homework', formats: ['CD', 'Album'] }),
  ]
  const lookup = buildLookup([master], onCd, [])

  it('fires for the vinyl of something you own on CD', () => {
    const signal = formatUpgrade(listing({ releaseId: 500, format: '2xLP, Album' }), lookup, [
      'Vinyl',
    ])
    expect(signal?.type).toBe('FORMAT_UPGRADE')
    expect(signal?.evidence).toMatchObject({ album: 'Homework', ownedAs: 'CD, Album' })
  })

  it('is not an upgrade if this copy is a CD as well', () => {
    expect(
      formatUpgrade(listing({ releaseId: 500, format: 'CD, Album' }), lookup, ['Vinyl']),
    ).toBeNull()
  })

  it('says nothing about a record you already own on vinyl', () => {
    const onVinyl = buildLookup(
      [master],
      [record({ releaseId: 1, masterId: 88, formats: ['Vinyl', 'LP'] })],
      [],
    )
    expect(
      formatUpgrade(listing({ releaseId: 500, format: 'LP' }), onVinyl, ['Vinyl']),
    ).toBeNull()
  })
})

describe('the lift, with a denominator at last', () => {
  const lookup = buildLookup(
    [
      chunk({ kind: 'label', entityId: 1, name: 'Ohr', catalogueSize: 100 }),
      chunk({ kind: 'label', entityId: 2, name: 'Warner', catalogueSize: 100_000 }),
    ],
    [],
    [],
  )

  it('rates a small label you buy from heavily far above a huge one', () => {
    // Three Ohr records and ten Warner records.
    const owned = new Map([
      [1, 3],
      [2, 10],
    ])

    const ohr = labelLift(lookup, 1, owned)!
    const warner = labelLift(lookup, 2, owned)!

    expect(ohr).toBeGreaterThan(2)
    expect(warner).toBeLessThan(1)
    expect(ohr).toBeGreaterThan(warner * 100)
  })

  it('returns null rather than guessing when the catalogue size is unknown', () => {
    expect(labelLift(lookup, 99, new Map([[99, 5]]))).toBeNull()
  })
})
