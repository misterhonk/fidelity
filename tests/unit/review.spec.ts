import { describe, expect, it } from 'vitest'

import type { CollectionItem, Dig, Feedback, HorizonChunk } from '#shared/types'
import { buildLookup } from '~~/worker/horizon/lookup'
import { reviewYear, yearOf } from '~~/worker/collection/review'

/**
 * A year on the shelf (docs/06 M19 #8), read off what the device holds.
 *
 * The shape the numbers take is what is pinned: copies rather than releases,
 * "new to the shelf" meaning the artist's first record ever, the pressing
 * years of the additions rather than of the whole collection, and the
 * horizon's credits matched against exactly those records.
 */

let instance = 0
function copy(over: Partial<CollectionItem> & { addedAt: string }): CollectionItem {
  instance += 1
  return {
    instanceId: instance,
    folderId: 1,
    releaseId: instance,
    masterId: 0,
    title: `Record ${instance}`,
    artistIds: [1],
    artistNorms: ['neu'],
    artistNames: ['Neu!'],
    labelIds: [5],
    labelNorms: ['brain'],
    labelNames: ['Brain'],
    catnos: [],
    genres: ['Rock'],
    styles: ['Krautrock'],
    formats: ['Vinyl', 'LP'],
    year: 1973,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    ...over,
  }
}

const dig = (dealer: string, startedAt: number, matchCount: number): Dig =>
  ({ id: `${dealer}-${startedAt}`, dealer, startedAt, matchCount, status: 'done' }) as Dig

const bought = (at: number): Feedback =>
  ({
    listingId: at,
    releaseId: 1,
    verdict: 'bought',
    createdAt: at,
    signals: [],
    score: 50,
  }) as Feedback

const JUNE_2025 = Date.UTC(2025, 5, 15)
const MARCH_2026 = Date.UTC(2026, 2, 1)

describe('a year on the shelf', () => {
  it('is nothing on an empty shelf', () => {
    expect(reviewYear({ copies: [], digs: [], feedback: [], lookup: null }, null)).toBeNull()
  })

  it('takes the latest year when none is asked for, and every year as chips', () => {
    const copies = [
      copy({ addedAt: '2024-03-02T10:00:00-00:00' }),
      copy({ addedAt: '2026-01-05T10:00:00-00:00' }),
      copy({ addedAt: '2019-03-01T00:00:00-00:00' }),
    ]
    const review = reviewYear({ copies, digs: [], feedback: [], lookup: null }, null)
    expect(review?.year).toBe(2026)
    expect(review?.years).toEqual([2026, 2024, 2019])
    // A year the shelf never saw falls back rather than reading as empty.
    expect(reviewYear({ copies, digs: [], feedback: [], lookup: null }, 2020)?.year).toBe(2026)
  })

  it('counts copies by month and against the year before', () => {
    const copies = [
      copy({ addedAt: '2025-11-20T10:00:00-00:00' }),
      copy({ addedAt: '2026-01-05T10:00:00-00:00' }),
      copy({ addedAt: '2026-01-25T10:00:00-00:00' }),
      // A second copy of the same record is something that arrived.
      copy({ addedAt: '2026-04-01T10:00:00-00:00', releaseId: 2 }),
      copy({ addedAt: '2026-04-02T10:00:00-00:00', releaseId: 2 }),
    ]
    const review = reviewYear({ copies, digs: [], feedback: [], lookup: null }, 2026)
    expect(review?.added).toBe(4)
    expect(review?.addedBefore).toBe(1)
    expect(review?.byMonth).toEqual([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('reads the year off the string, so no time zone moves a New Year’s Eve', () => {
    expect(yearOf('2025-12-31T23:30:00-07:00')).toBe(2025)
    expect(yearOf('')).toBe(0)
  })

  it('calls an artist new only when their first record ever arrived that year', () => {
    const copies = [
      copy({ addedAt: '2024-05-01T10:00:00-00:00', artistIds: [1], artistNames: ['Neu!'] }),
      copy({ addedAt: '2026-05-01T10:00:00-00:00', artistIds: [1], artistNames: ['Neu!'] }),
      copy({ addedAt: '2026-06-01T10:00:00-00:00', artistIds: [2], artistNames: ['Cluster'] }),
      copy({ addedAt: '2026-07-01T10:00:00-00:00', artistIds: [2], artistNames: ['Cluster'] }),
    ]
    const review = reviewYear({ copies, digs: [], feedback: [], lookup: null }, 2026)
    expect(review?.newArtists).toBe(1)
    expect(review?.newArtistNames).toEqual(['Cluster'])
    // The bars are over this year's additions, not the whole shelf.
    expect(review?.artists.map((f) => [f.name, f.n])).toEqual([
      ['Cluster', 2],
      ['Neu!', 1],
    ])
  })

  it('knows where the additions come from and on what', () => {
    const copies = [
      copy({
        addedAt: '2026-01-01T10:00:00-00:00',
        year: 1959,
        title: 'Kind Of Blue',
        artistNames: ['Miles Davis'],
      }),
      copy({ addedAt: '2026-02-01T10:00:00-00:00', year: 1973 }),
      copy({
        addedAt: '2026-03-01T10:00:00-00:00',
        year: 2026,
        title: 'Fresh',
        formats: ['CD', 'Album'],
      }),
      copy({ addedAt: '2026-03-02T10:00:00-00:00', year: 0 }),
    ]
    const review = reviewYear({ copies, digs: [], feedback: [], lookup: null }, 2026)
    expect(review?.decades.map((f) => [f.name, f.n])).toEqual([
      ['1950er', 1],
      ['1970er', 1],
      ['2020er', 1],
    ])
    expect(review?.media.map((f) => [f.name, f.n])).toEqual([
      ['Vinyl', 3],
      ['CD', 1],
    ])
    expect(review?.oldest).toMatchObject({
      title: 'Kind Of Blue',
      artist: 'Miles Davis',
      year: 1959,
    })
    expect(review?.newest).toMatchObject({ title: 'Fresh', year: 2026 })
  })

  it('has no newest when one record is all there is to date', () => {
    const copies = [copy({ addedAt: '2026-01-01T10:00:00-00:00', year: 1959 })]
    const review = reviewYear({ copies, digs: [], feedback: [], lookup: null }, 2026)
    expect(review?.oldest).not.toBeNull()
    expect(review?.newest).toBeNull()
  })

  it('counts the stars and what Fidelity had to do with it', () => {
    const copies = [
      copy({ addedAt: '2026-01-01T10:00:00-00:00', rating: 5 }),
      copy({ addedAt: '2026-01-02T10:00:00-00:00', rating: 3 }),
      copy({ addedAt: '2026-01-03T10:00:00-00:00' }),
    ]
    const digs = [
      dig('plattenkiste', MARCH_2026, 7),
      dig('plattenkiste', MARCH_2026 + 1, 2),
      dig('waxstand', MARCH_2026 + 2, 4),
      dig('waxstand', JUNE_2025, 40),
    ]
    const feedback = [bought(MARCH_2026), bought(JUNE_2025)]
    const review = reviewYear({ copies, digs, feedback, lookup: null }, 2026)
    expect(review?.loved).toBe(1)
    expect(review?.rated).toBe(2)
    expect(review?.digs).toEqual({ runs: 3, shops: 2, finds: 13, bought: 1 })
  })

  it('names who shaped the additions, from the horizon, main credits aside', () => {
    const copies = [
      copy({ addedAt: '2026-01-01T10:00:00-00:00', releaseId: 100 }),
      copy({ addedAt: '2026-01-02T10:00:00-00:00', releaseId: 101 }),
      copy({ addedAt: '2025-01-02T10:00:00-00:00', releaseId: 102 }),
    ]
    const plank: HorizonChunk = {
      key: 'artist:40135',
      kind: 'artist',
      entityId: 40135,
      name: 'Conny Plank',
      fetchedAt: 0,
      complete: true,
      requests: 1,
      releaseIds: Int32Array.from([100, 101, 102]),
      // Producer, Producer, and a main credit on the third.
      roles: Uint8Array.from([1, 1, 0]),
      years: Int16Array.from([1973, 1974, 1975]),
    }
    const neu: HorizonChunk = {
      ...plank,
      key: 'artist:1',
      entityId: 1,
      name: 'Neu!',
      releaseIds: Int32Array.from([100, 101]),
      roles: Uint8Array.from([0, 0]),
      years: Int16Array.from([1973, 1974]),
    }
    const lookup = buildLookup([plank, neu], copies, [])
    const review = reviewYear({ copies, digs: [], feedback: [], lookup }, 2026)
    expect(review?.people).toEqual([{ name: 'Conny Plank', n: 2, role: 'Producer' }])
  })
})
