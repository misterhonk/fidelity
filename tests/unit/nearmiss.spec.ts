import { describe, expect, it } from 'vitest'

import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'
import { buildLookup } from '~~/worker/horizon/lookup'
import { MAX_PER_DIG, NearMissAccumulator } from '~~/worker/horizon/nearmiss'
import type { Listing } from '~~/worker/match'

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

const listing = (over: Partial<Listing> = {}): Listing =>
  ({
    listingId: 1,
    releaseId: 500,
    title: 'Dummy',
    artist: 'Portishead',
    label: null,
    catno: null,
    format: '12"',
    year: 1994,
    condition: null,
    sleeve: null,
    price: 10,
    currency: 'EUR',
    shipsFrom: null,
    comments: null,
    thumbUrl: null,
    ...over,
  }) as Listing

const dummy = record({
  releaseId: 9001,
  masterId: 77,
  title: 'Dummy',
  artistNorms: ['portishead'],
  artistNames: ['Portishead'],
})

function acc(
  chunks: HorizonChunk[] = [],
  collection: CollectionItem[] = [dummy],
  wantlist: WantlistItem[] = [],
) {
  return new NearMissAccumulator(
    buildLookup(chunks, collection, wantlist),
    collection,
    wantlist,
    chunks,
  )
}

describe('stage two: which masters a dig showed were missing', () => {
  it('spots a pressing of an album the collection knows', () => {
    const a = acc()
    a.add(listing())
    expect(a.build()).toEqual([{ masterId: 77, title: 'Dummy', releaseId: 500 }])
  })

  it('ignores a release the horizon already covers', () => {
    // Whatever this is, it is not a gap.
    const covered = {
      key: 'master:77',
      kind: 'master',
      entityId: 77,
      name: 'Dummy',
      fetchedAt: 1,
      complete: true,
      requests: 1,
      releaseIds: Int32Array.from([500]),
      roles: new Uint8Array(1),
      years: new Int16Array(1),
    } as HorizonChunk

    const a = acc([covered])
    a.add(listing())
    expect(a.build()).toEqual([])
  })

  it('does not ask twice for a master already expanded', () => {
    const expanded = {
      key: 'master:77',
      kind: 'master',
      entityId: 77,
      name: 'Dummy',
      fetchedAt: 1,
      complete: true,
      requests: 1,
      releaseIds: Int32Array.from([999]),
      roles: new Uint8Array(1),
      years: new Int16Array(1),
    } as HorizonChunk

    const a = acc([expanded])
    a.add(listing({ releaseId: 500 }))
    expect(a.build()).toEqual([])
  })

  it('needs the artist to match, not only the title', () => {
    const a = acc()
    a.add(listing({ artist: 'Ganz Wer Anderes' }))
    expect(a.build()).toEqual([])
  })

  it('needs the title to read like the album, not only the artist', () => {
    const a = acc()
    a.add(listing({ title: 'Third' }))
    expect(a.build()).toEqual([])
  })

  it('sees through the decoration a marketplace bolts onto a title', () => {
    for (const title of ['Dummy (Reissue)', 'Dummy - 180g Gatefold', 'Dummy [2017]']) {
      const a = acc()
      a.add(listing({ title }))
      expect(a.build(), title).toHaveLength(1)
    }
  })

  it('still allows decoration to be most of a marketplace title', () => {
    const a = acc()
    a.add(listing({ title: 'Dummy (2017 Reissue, 180g)' }))
    expect(a.build()).toHaveLength(1)
  })

  it('refuses a title too short to carry information', () => {
    const a = acc([], [record({ masterId: 88, title: 'X', artistNorms: ['portishead'] })])
    a.add(listing({ title: 'X Marks The Spot' }))
    expect(a.build()).toEqual([])
  })

  it('will guess wrong sometimes, and that is bounded to one request', () => {
    // A short common title inside a longer, unrelated one gets through. The
    // cost of being wrong is one master expansion, and MAX_PER_DIG caps how
    // often a dig can be wrong — cheaper than a guard that does not
    // discriminate (see MIN_TITLE_LENGTH).
    const a = acc([], [record({ masterId: 88, title: 'Hits', artistNorms: ['portishead'] })])
    a.add(listing({ title: 'Greatest Hits Of Somebody Else' }))
    expect(a.build()).toHaveLength(1)
  })

  it('reads a multi-artist listing', () => {
    const a = acc()
    a.add(listing({ artist: 'Portishead / Beth Gibbons' }))
    expect(a.build()).toHaveLength(1)
  })

  it('caps what one dig may cost', () => {
    const albums = Array.from({ length: MAX_PER_DIG + 5 }, (_, i) =>
      record({
        releaseId: 9000 + i,
        masterId: 100 + i,
        title: `Album ${i}`,
        artistNorms: ['portishead'],
        artistNames: ['Portishead'],
      }),
    )
    const a = acc([], albums)

    for (let i = 0; i < albums.length; i++) {
      a.add(listing({ releaseId: 500 + i, title: `Album ${i}` }))
    }

    // A near miss is a guess. A cap keeps a wrong one cheap and lets the next
    // dig try the next eight.
    expect(a.build()).toHaveLength(MAX_PER_DIG)
    expect(a.full).toBe(true)
  })

  it('says nothing without a collection to compare against', () => {
    const a = acc([], [])
    a.add(listing())
    expect(a.build()).toEqual([])
    expect(a.full).toBe(true)
  })

  it('ignores a record with no master to expand', () => {
    const a = acc([], [record({ title: 'Dummy', artistNorms: ['portishead'], masterId: 0 })])
    a.add(listing())
    expect(a.build()).toEqual([])
  })

  it('finds the same master only once however many pressings show up', () => {
    const a = acc()
    a.add(listing({ releaseId: 500 }))
    a.add(listing({ releaseId: 501 }))
    expect(a.build()).toHaveLength(1)
  })
})
