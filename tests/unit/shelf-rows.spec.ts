import { describe, expect, it } from 'vitest'

import { gradeFieldIds, isWorn } from '#shared/grades'
import type { CollectionField, CollectionItem } from '#shared/types'
import { shelve, type ShelfStores } from '~~/worker/collection/records'

/**
 * The shelf as rows (#236): the columns a dense table edits, and the five
 * chips that narrow it. Pure, so it runs without IndexedDB and can be timed.
 */

const FIELDS: CollectionField[] = [
  { id: 1, name: 'Media Condition', type: 'dropdown', options: [] },
  { id: 2, name: 'Sleeve Condition', type: 'dropdown', options: [] },
  { id: 3, name: 'Notes', type: 'text', options: [] },
]

function item(instanceId: number, over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: instanceId,
    masterId: 0,
    title: `Record ${instanceId}`,
    artistIds: [],
    artistNames: ['Someone'],
    artistNorms: ['someone'],
    labelIds: [],
    labelNames: ['Label'],
    labelNorms: ['label'],
    catnos: [`CAT ${instanceId}`],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 2000,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2020-01-01T00:00:00Z',
    instanceId,
    folderId: 1,
    ...over,
  }
}

function stores(over: Partial<ShelfStores> = {}): ShelfStores {
  return {
    items: [
      item(1),
      // A double of release 1.
      item(2, { releaseId: 1 }),
      // Two pressings of one master.
      item(3, { masterId: 50 }),
      item(4, { masterId: 50 }),
      item(5),
    ],
    placements: [
      { instanceId: 1, placeId: 'shelf' },
      // Points at a dissolved place: counts as unplaced.
      { instanceId: 3, placeId: 'gone' },
    ],
    places: [{ id: 'shelf' }, { id: 'gone', removedAt: 1 }],
    fieldRows: [
      { instanceId: 1, values: { 1: 'Near Mint (NM or M-)', 2: 'Very Good (VG)' } },
      { instanceId: 3, values: { 1: 'Very Good Plus (VG+)', 2: 'Generic' } },
      { instanceId: 4, values: { 1: 'Good Plus (G+)' } },
    ],
    jobs: [
      { id: 'collection.rate:1', kind: 'collection.rate', attempts: 0 },
      { id: 'collection.field:1:1', kind: 'collection.field', attempts: 2, lastError: 'x' },
      // Keyed by release, not by copy: never counted against a row.
      { id: 'collection.add:5', kind: 'collection.add', attempts: 0 },
    ],
    fields: FIELDS,
    ...over,
  }
}

const ids = (view: { records: { instanceId: number }[] }) =>
  view.records.map((record) => record.instanceId).sort((a, b) => a - b)

describe('the shelf as rows', () => {
  it('carries what every column shows', () => {
    const one = shelve(stores(), {}).records.find((record) => record.instanceId === 1)
    expect(one).toMatchObject({
      catno: 'CAT 1',
      folderId: 1,
      placeId: 'shelf',
      media: 'Near Mint (NM or M-)',
      sleeve: 'Very Good (VG)',
      waiting: 2,
      failing: true,
    })
    const three = shelve(stores(), {}).records.find((record) => record.instanceId === 3)
    expect(three).toMatchObject({ placeId: null, waiting: 0, failing: false })
  })

  it('narrows by each chip', () => {
    expect(ids(shelve(stores(), { only: ['unplaced'] }))).toEqual([2, 3, 4, 5])
    expect(ids(shelve(stores(), { only: ['ungraded'] }))).toEqual([2, 5])
    expect(ids(shelve(stores(), { only: ['doubles'] }))).toEqual([1, 2])
    expect(ids(shelve(stores(), { only: ['otherPressing'] }))).toEqual([3, 4])
    expect(ids(shelve(stores(), { only: ['worn'] }))).toEqual([1, 4])
  })

  it('combines chips, and keeps the old unplaced flag', () => {
    expect(ids(shelve(stores(), { only: ['doubles', 'unplaced'] }))).toEqual([2])
    expect(ids(shelve(stores(), { only: ['doubles'], unplaced: true }))).toEqual([2])
  })

  it('finds the grade fields by name, by order, or by Discogs default', () => {
    expect(gradeFieldIds(FIELDS)).toEqual({ media: 1, sleeve: 2 })
    expect(
      gradeFieldIds([
        { id: 9, name: 'Sleeve', type: 'dropdown', options: [] },
        { id: 7, name: 'Media', type: 'dropdown', options: [] },
      ]),
    ).toEqual({ media: 7, sleeve: 9 })
    expect(gradeFieldIds(null)).toEqual({ media: 1, sleeve: 2 })
  })

  it('reads wear from the bracket, and ignores what is not a grade', () => {
    expect(isWorn('Very Good (VG)')).toBe(true)
    expect(isWorn('Poor (P)')).toBe(true)
    expect(isWorn('Very Good Plus (VG+)', 'Near Mint (NM or M-)')).toBe(false)
    expect(isWorn('', 'Generic', 'Not Graded', 'No Cover')).toBe(false)
  })

  it('builds 20,000 rows with every chip in under 250 ms', () => {
    const items = Array.from({ length: 20_000 }, (_, i) =>
      item(i + 1, { releaseId: (i % 15_000) + 1, masterId: i % 3 === 0 ? (i % 4_000) + 1 : 0 }),
    )
    const big = stores({
      items,
      placements: items
        .filter((_, i) => i % 2 === 0)
        .map((row) => ({ instanceId: row.instanceId, placeId: 'shelf' })),
      fieldRows: items
        .filter((_, i) => i % 5 === 0)
        .map((row) => ({ instanceId: row.instanceId, values: { 1: 'Very Good (VG)' } })),
    })

    const started = performance.now()
    shelve(big, { sort: 'artist' })
    shelve(big, { only: ['unplaced', 'ungraded', 'doubles', 'otherPressing', 'worn'] })
    expect(performance.now() - started).toBeLessThan(250)
  })
})
