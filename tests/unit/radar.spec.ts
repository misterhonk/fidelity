import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { selectCandidates } from '~~/worker/horizon/select'
import { buildIndex, evaluate, type MatchFilters } from '~~/worker/match'
import { computeTasteProfile } from '~~/worker/match/taste'
import { follow, listFollowed, unfollow } from '~~/worker/followed'
import type { CollectionItem, FollowedArtist, HorizonChunk, Listing } from '#shared/types'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * The radar — S3b, `ARTIST_FOLLOWED` (M29).
 *
 * "Exit North, I think they are great, have no record by them, but I would
 * like to be shown one if it turns up." Before this, a band you owned nothing
 * by did not exist for the engine: the artist map comes from the taste
 * profile, which is computed from the collection alone.
 *
 * What has to hold: the name is recognised, the sentence never counts records
 * that are not there, and the shelf wins where the two overlap.
 */
const NOW = 1_800_000_000_000

function record(releaseId: number, artist: string, artistId: number): CollectionItem {
  return {
    releaseId,
    masterId: 0,
    title: `Release ${releaseId}`,
    artistIds: [artistId],
    artistNorms: [],
    artistNames: [artist],
    labelIds: [500],
    labelNames: ['Some Label'],
    labelNorms: [],
    catnos: [],
    genres: ['Electronic'],
    styles: ['Ambient'],
    formats: ['Vinyl', 'LP'],
    year: 2018,
    rating: 0,
    addedAt: '2026-08-01T00:00:00-07:00',
  }
}

const collection = [record(1, 'Robag Wruhme', 100), record(2, 'Robag Wruhme', 100)]
const taste = computeTasteProfile(collection, 0)

const filters: MatchFilters = {
  formatsAllow: ['Vinyl'],
  maxPrice: null,
  shipsFromBlock: [],
  prefMediaCondition: 'Very Good Plus (VG+)',
  targetPrice: null,
}

const listing = (artist: string): Listing => ({
  listingId: 5,
  releaseId: 9_999,
  title: 'Book Of Romance And Dust',
  artist,
  label: 'Glitchhouse',
  catno: null,
  format: 'Vinyl, LP',
  year: 2018,
  condition: 'Near Mint (NM or M-)',
  sleeve: null,
  price: 25,
  currency: 'EUR',
  shipsFrom: 'Germany',
  comments: null,
  thumbUrl: null,
  postedAt: null,
})

const radar = (artistId: number, name: string): FollowedArtist => ({
  artistId,
  name,
  followedAt: NOW,
})

const signalsFor = (artist: string, followed: FollowedArtist[], chunks: HorizonChunk[] = []) =>
  evaluate(listing(artist), buildIndex(collection, [], taste, chunks, followed), filters)
    ?.signals ?? []

describe('a band on the radar', () => {
  it('is recognised although nothing of theirs is on the shelf', () => {
    const signals = signalsFor('Exit North', [radar(555, 'Exit North')])
    const found = signals.find((s) => s.type === 'ARTIST_FOLLOWED')

    expect(found).toBeDefined()
    expect(found?.confidence).toBe(1)
    expect(found?.evidence).toMatchObject({ artist: 'Exit North', owned: 0 })
    // And never as the signal whose sentence counts records.
    expect(signals.some((s) => s.type === 'ARTIST_KNOWN')).toBe(false)
  })

  it('is found under its other names too, once the horizon has expanded it', () => {
    const chunks: HorizonChunk[] = [
      {
        key: 'artist:555',
        kind: 'artist',
        entityId: 555,
        name: 'Exit North',
        fetchedAt: NOW,
        complete: true,
        requests: 2,
        releaseIds: new Int32Array(0),
        roles: new Uint8Array(0),
        years: new Int16Array(0),
        // A name that does not normalise to the same key, or the exact stage
        // would answer first and the lexicon would never be asked.
        kin: [{ name: 'Northern Exit', relation: 'alias' }],
      },
    ]

    const found = signalsFor('Northern Exit', [radar(555, 'Exit North')], chunks).find(
      (s) => s.type === 'ARTIST_FOLLOWED',
    )

    // The sentence names the band as it is spelt on the radar, whatever the
    // listing said — the same rule S3 follows.
    expect(found?.evidence).toMatchObject({ artist: 'Exit North', via: 'Northern Exit' })
  })

  it('lets the shelf win where the two overlap', () => {
    // Following somebody you already collect changes nothing: "you have 2
    // records by them" is the truer sentence.
    const signals = signalsFor('Robag Wruhme', [radar(100, 'Robag Wruhme')])

    expect(signals.some((s) => s.type === 'ARTIST_KNOWN')).toBe(true)
    expect(signals.some((s) => s.type === 'ARTIST_FOLLOWED')).toBe(false)
  })

  it('changes nothing at all on a device that follows nobody', () => {
    expect(signalsFor('Exit North', [])).toEqual([])
  })

  it('joins the horizon, high up, and only once', () => {
    const candidates = selectCandidates(
      collection,
      [],
      [
        radar(555, 'Exit North'),
        // Already collected: the owned entry carries the better ordering, and
        // expanding the same entity twice would be two requests for one chunk.
        radar(100, 'Robag Wruhme'),
      ],
    )

    const ids = candidates.filter((c) => c.kind === 'artist').map((c) => c.id)
    expect(ids).toEqual([555, 100])
    expect(candidates.find((c) => c.id === 555)?.owned).toBe(0)
  })

  it('remembers when it was first put on, and forgets on the way out', async () => {
    await follow(555, 'Exit North', NOW)
    await follow(555, 'Exit North', NOW + 60_000)

    const [only] = await listFollowed()
    expect(only).toMatchObject({ artistId: 555, followedAt: NOW, updatedAt: NOW + 60_000 })

    await follow(556, 'Another Band', NOW)
    expect((await listFollowed()).map((a) => a.name)).toEqual(['Another Band', 'Exit North'])

    await unfollow(555)
    expect((await listFollowed()).map((a) => a.artistId)).toEqual([556])
    // The row is gone; what the horizon learned about them is not.
    expect(await (await openFidelityDb()).get('followed', 555)).toBeUndefined()
  })
})
