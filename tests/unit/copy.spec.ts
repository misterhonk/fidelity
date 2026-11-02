import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import { copyOf, parseCents, setCopy } from '~~/worker/collection/copy'
import { placeRecord, placeRecords } from '~~/worker/places'
import type { CollectionItem } from '#shared/types'

/** Your copy (M41, ADR-019): paid and arrival beside the placement, and what waits for Discogs. */
const copy = (instanceId: number, releaseId: number, addedAt: string): CollectionItem => ({
  releaseId,
  instanceId,
  folderId: 1,
  masterId: 0,
  title: 'Probe',
  artistIds: [],
  artistNames: ['Probe'],
  artistNorms: ['probe'],
  labelIds: [],
  labelNames: [],
  labelNorms: [],
  catnos: [],
  genres: [],
  styles: [],
  formats: ['Vinyl'],
  year: 1999,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  addedAt,
})

beforeEach(async () => {
  const db = await openFidelityDb()
  for (const store of ['placements', 'collection', 'outbox'] as const) await db.clear(store)
})

describe('parseCents', () => {
  it('reads a typed price into integer cents', () => {
    expect(parseCents('18')).toBe(1800)
    expect(parseCents('18,5')).toBe(1850)
    expect(parseCents(' 18.05 ')).toBe(1805)
    expect(parseCents('')).toBeNull()
    expect(parseCents('18.555')).toBeUndefined()
    expect(parseCents('-3')).toBeUndefined()
    expect(parseCents('abc')).toBeUndefined()
  })
})

describe('your copy', () => {
  it('lists every copy of the release, oldest first', async () => {
    const db = await openFidelityDb()
    await db.put('collection', copy(2, 7, '2024-05-01T00:00:00Z'))
    await db.put('collection', copy(1, 7, '2023-01-01T00:00:00Z'))
    await db.put('collection', copy(3, 8, '2022-01-01T00:00:00Z'))

    expect((await copyOf(2)).copies).toEqual([1, 2])
    expect((await copyOf(3)).copies).toEqual([3])
  })

  it('keeps paid and arrival when the record is put somewhere else', async () => {
    expect(await setCopy(5, { paid: { amount: '18,50', currency: 'eur' } })).toBe(true)
    expect(await setCopy(5, { arrivedOn: '2024-03-02' })).toBe(true)
    await placeRecord(5, 'shelf')
    await placeRecords([5], 'crate')

    const state = await copyOf(5)
    expect(state.paid).toEqual({ cents: 1850, currency: 'EUR' })
    expect(state.arrivedOn).toBe('2024-03-02')
    expect((await (await openFidelityDb()).get('placements', 5))?.placeId).toBe('crate')
  })

  it('refuses what is not a price or a day, and clears on empty', async () => {
    await setCopy(5, { paid: { amount: '20', currency: 'EUR' } })
    expect(await setCopy(5, { paid: { amount: 'twenty', currency: 'EUR' } })).toBe(false)
    expect(await setCopy(5, { paid: { amount: '20', currency: 'euro' } })).toBe(false)
    expect(await setCopy(5, { arrivedOn: 'yesterday' })).toBe(false)
    expect((await copyOf(5)).paid).toEqual({ cents: 2000, currency: 'EUR' })

    await setCopy(5, { paid: { amount: '', currency: '' } })
    expect((await copyOf(5)).paid).toBeNull()
  })

  it('counts the changes to this copy still waiting for Discogs', async () => {
    const job = { payload: {}, revert: {}, queuedAt: 1 }
    await queueJob({ ...job, id: 'collection.rating:5', kind: 'collection.rating' })
    await queueJob({ ...job, id: 'collection.field:5:1', kind: 'collection.field' })
    await queueJob({ ...job, id: 'collection.rating:55', kind: 'collection.rating' })
    await queueJob({ ...job, id: 'collection.add:5', kind: 'collection.add' })
    // A wantlist job is keyed by release; release 5 is not copy 5.
    await queueJob({ ...job, id: 'wantlist.add:5', kind: 'wantlist.add' })

    expect(await copyOf(5)).toMatchObject({ waiting: 2, failing: false })
    expect(await copyOf(6)).toMatchObject({ waiting: 0, failing: false })
  })
})
