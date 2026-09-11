import { afterEach, describe, expect, it } from 'vitest'

import { setMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem } from '#shared/types'
import { cell, collectionCsv, toCsv, wantlistCsv } from '~~/worker/csv'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * The collection as a spreadsheet (docs/06 M19 #5).
 *
 * The thing most likely to go wrong in a CSV is a cell that breaks the row —
 * a title with a comma, a note with a quote, a line break somebody pasted
 * into a condition field. That is pinned first. Then that the columns
 * Discogs' export lacks are there, and the ones the terms forbid are not.
 */

function item(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    instanceId: 501,
    folderId: 1,
    releaseId: 1,
    masterId: 10,
    title: 'Platte',
    artistIds: [1],
    artistNorms: ['neu'],
    artistNames: ['Neu!'],
    labelIds: [5],
    labelNorms: ['brain'],
    labelNames: ['Brain'],
    catnos: ['BRAIN 1004'],
    genres: ['Rock'],
    styles: ['Krautrock', 'Experimental'],
    formats: ['Vinyl', 'LP', 'Album'],
    year: 1973,
    thumbUrl: '',
    coverUrl: '',
    rating: 5,
    addedAt: '2026-08-01T10:00:00-07:00',
    ...over,
  } as CollectionItem
}

describe('a cell', () => {
  it('is always quoted, with quotes doubled and line breaks kept', () => {
    expect(cell('plain')).toBe('"plain"')
    expect(cell('Tago Mago, Part 2')).toBe('"Tago Mago, Part 2"')
    expect(cell('"Ohr" reissue')).toBe('"""Ohr"" reissue"')
    expect(cell('two\nlines')).toBe('"two\nlines"')
    expect(cell(null)).toBe('""')
    expect(cell(0)).toBe('"0"')
  })

  it('makes rows a sheet can read back', () => {
    const csv = toCsv(['a', 'b'], [['x, y', 'say "hi"']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('"a","b"\r\n"x, y","say ""hi"""\r\n')
  })
})

describe('the collection sheet', () => {
  it('carries the columns Discogs leaves out, and what is yours alone', async () => {
    const db = await openFidelityDb()
    await db.put('collection', item())
    await db.put('fieldValues', {
      instanceId: 501,
      values: { 1: 'Near Mint (NM or M-)', 3: 'gatefold' },
    })
    await db.put('places', { id: 'p1', name: 'Cellar', parentId: null, createdAt: 1 })
    await db.put('places', { id: 'p2', name: 'Crate 3', parentId: 'p1', createdAt: 2 })
    await db.put('placements', { instanceId: 501, placeId: 'p2', at: 3 })
    await setMeta('collectionFolders', [{ id: 1, name: 'Uncategorized', count: 1 }])

    const { csv, rows } = await collectionCsv()
    const [header, row] = csv.slice(1).split('\r\n')

    expect(rows).toBe(1)
    expect(header).toBe(
      '"instance_id","release_id","master_id","artist","title","label","catno","format","year","genres","styles","rating","folder","added","Media Condition","Sleeve Condition","Notes","place"',
    )
    expect(row).toBe(
      '"501","1","10","Neu!","Platte","Brain","BRAIN 1004","Vinyl, LP, Album","1973","Rock","Krautrock; Experimental","5","Uncategorized","2026-08-01T10:00:00-07:00","Near Mint (NM or M-)","","gatefold","Cellar › Crate 3"',
    )
  })

  it('names the condition columns the way the account does', async () => {
    const db = await openFidelityDb()
    await db.put('collection', item())
    await setMeta('collectionFields', [
      { id: 1, name: 'Zustand Platte', type: 'dropdown', options: [] },
      { id: 2, name: 'Zustand Hülle', type: 'dropdown', options: [] },
      { id: 3, name: 'Notizen', type: 'text', options: [] },
    ])

    const { csv } = await collectionCsv()
    expect(csv).toContain('"Zustand Platte","Zustand Hülle","Notizen"')
  })

  it('holds no price and no estimate', async () => {
    const db = await openFidelityDb()
    await db.put('collection', item())
    const { csv } = await collectionCsv()
    expect(csv.toLowerCase()).not.toMatch(/price|value|estimate|€/)
  })
})

describe('the wantlist sheet', () => {
  it('has the note and no copy columns', async () => {
    const db = await openFidelityDb()
    const { rating: _r, instanceId: _i, folderId: _f, ...wanted } = item({ title: 'Neu! 2' })
    await db.put('wantlist', { ...wanted, note: 'the 1973 original, please', want: 1 })

    const { csv } = await wantlistCsv()
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header).toBe(
      '"release_id","master_id","artist","title","label","catno","format","year","genres","styles","added","note"',
    )
    expect(row).toContain('"Neu! 2"')
    expect(row?.endsWith('"the 1973 original, please"')).toBe(true)
  })
})
