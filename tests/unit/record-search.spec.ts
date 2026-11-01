import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Match } from '#shared/types'
import { handlers } from '~~/worker/handlers'
import { RECORD_LIMIT, searchRecords } from '~~/worker/search'

afterEach(async () => {
  await deleteFidelityDb()
})

async function shelve(store: 'collection' | 'wantlist', over: Record<string, unknown> = {}) {
  const db = await openFidelityDb()
  const releaseId = Number(over.releaseId ?? 1)
  await db.put(store, {
    releaseId,
    instanceId: releaseId,
    folderId: 1,
    masterId: 0,
    title: 'Speak No Evil',
    artistIds: [],
    artistNames: ['Wayne Shorter'],
    artistNorms: ['wayne shorter'],
    labelIds: [],
    labelNames: ['Blue Note'],
    labelNorms: ['blue note'],
    catnos: ['BST 84194'],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 1966,
    rating: 5,
    addedAt: '2019-03-01T00:00:00Z',
    ...over,
  } as never)
}

const find = {
  digId: 'DIG1',
  listingId: 77,
  releaseId: 9,
  title: 'Point of Departure',
  artist: 'Andrew Hill',
  label: 'Blue Note',
  catno: 'BST 84167',
} as Match

describe('the palette record search (#215)', () => {
  it('finds by artist, title, label and catalogue number', async () => {
    await shelve('collection')

    for (const query of ['shorter', 'speak evil', 'blue', 'BST 84194', 'bst84194']) {
      expect((await searchRecords(query, [])).shelf, query).toHaveLength(1)
    }
    expect((await searchRecords('shorter coltrane', [])).shelf).toHaveLength(0)
  })

  it('groups shelf, wantlist and the last dig', async () => {
    await shelve('collection')
    await shelve('wantlist', { releaseId: 2, title: 'Juju', want: 5, note: '' })

    const found = await searchRecords('blue', [find])
    expect(found.shelf.map((hit) => hit.title)).toEqual(['Speak No Evil'])
    expect(found.wantlist.map((hit) => hit.title)).toEqual(['Juju'])
    expect(found.dig).toEqual([
      expect.objectContaining({
        source: 'dig',
        title: 'Point of Departure',
        digId: 'DIG1',
        listingId: 77,
      }),
    ])
  })

  it('answers nothing to a single letter, and caps each group', async () => {
    for (let id = 1; id <= RECORD_LIMIT + 3; id++) await shelve('collection', { releaseId: id })

    expect((await searchRecords('b', [])).shelf).toHaveLength(0)
    expect((await searchRecords('blue', [])).shelf).toHaveLength(RECORD_LIMIT)
  })

  it('is a worker message', async () => {
    await shelve('collection')
    const context = { report: () => {}, signal: new AbortController().signal }

    const found = await handlers['records.search']({ query: 'blue note' }, context)
    expect(found.shelf).toHaveLength(1)
    expect(found.dig).toEqual([])
  })
})
