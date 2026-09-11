import { getMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { CollectionItem, Place, WantlistItem } from '#shared/types'

/**
 * The collection and the wantlist as CSV (docs/06 M19 #5).
 *
 * Discogs' own export leaves out genres, styles, release ids and the master
 * — the four columns people write scripts to put back. Everything here is
 * already on the device: the CC0 catalogue fields the sync mirrored, plus
 * what is yours alone — rating, folder, the three condition fields, and the
 * place a record sits in, which Discogs has no field for at all.
 *
 * **No prices, no estimate.** Both are marketplace data and may not be
 * passed on (docs/09 §1.3), and a file is exactly that — the same reason the
 * JSON backup strips them. The roadmap called values "optional"; read
 * against the terms they are not, so they are not here.
 *
 * Plain RFC 4180: comma-separated, every field quoted, quotes doubled, a
 * UTF-8 byte-order mark in front so Excel reads the umlauts. Lists inside a
 * cell — two artists, three styles — are joined with "; ", which is what the
 * Discogs export does with its own multi-valued columns.
 */

const BOM = '﻿'
const LIST = '; '

/** One cell: always quoted, quotes doubled. `null` and `undefined` are empty. */
export function cell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(','))
  return BOM + lines.join('\r\n') + '\r\n'
}

/** Discogs' three fields carry the same ids on every account (db/schema.ts). */
const FIELD_NAMES: Record<number, string> = {
  1: 'Media Condition',
  2: 'Sleeve Condition',
  3: 'Notes',
}

/** What both lists share — the CC0 catalogue fields the sync mirrored. */
type Catalogued = CollectionItem | WantlistItem

function catalogue(item: Catalogued): unknown[] {
  return [
    item.releaseId,
    item.masterId || '',
    item.artistNames.join(LIST),
    item.title,
    item.labelNames.join(LIST),
    item.catnos.join(LIST),
    item.formats.join(', '),
    item.year || '',
    item.genres.join(LIST),
    item.styles.join(LIST),
  ]
}

const CATALOGUE_HEADER = [
  'release_id',
  'master_id',
  'artist',
  'title',
  'label',
  'catno',
  'format',
  'year',
  'genres',
  'styles',
]

/** "Cellar › Crate 3": the names from the root down, dissolved places skipped. */
function pathOf(placeId: string | null, places: Map<string, Place>): string {
  const names: string[] = []
  let id = placeId
  let guard = 0
  while (id && guard++ < 8) {
    const place = places.get(id)
    if (!place || (place as { removedAt?: number | null }).removedAt) break
    names.unshift(place.name)
    id = place.parentId
  }
  return names.join(' › ')
}

export async function collectionCsv(): Promise<{ csv: string; rows: number }> {
  const db = await openFidelityDb()
  const [items, fieldValues, placements, places, folders, fields] = await Promise.all([
    db.getAll('collection'),
    db.getAll('fieldValues'),
    db.getAll('placements'),
    db.getAll('places'),
    getMeta('collectionFolders'),
    getMeta('collectionFields'),
  ])

  const valuesByInstance = new Map(fieldValues.map((row) => [row.instanceId, row.values]))
  const placeByInstance = new Map(placements.map((row) => [row.instanceId, row.placeId]))
  const placeById = new Map(places.map((place) => [place.id, place]))
  const folderById = new Map((folders ?? []).map((folder) => [folder.id, folder.name]))

  const fieldIds = [1, 2, 3]
  const fieldNames = fieldIds.map(
    (id) => (fields ?? []).find((field) => field.id === id)?.name ?? FIELD_NAMES[id]!,
  )

  const header = [
    'instance_id',
    ...CATALOGUE_HEADER,
    'rating',
    'folder',
    'added',
    ...fieldNames,
    'place',
  ]

  const rows = items
    .sort(
      (a, b) =>
        a.artistNames.join().localeCompare(b.artistNames.join()) ||
        a.title.localeCompare(b.title),
    )
    .map((item) => {
      const values = valuesByInstance.get(item.instanceId) ?? {}
      return [
        item.instanceId > 0 ? item.instanceId : '',
        ...catalogue(item),
        item.rating || '',
        folderById.get(item.folderId) ?? (item.folderId || ''),
        item.addedAt,
        ...fieldIds.map((id) => values[id] ?? ''),
        pathOf(placeByInstance.get(item.instanceId) ?? null, placeById),
      ]
    })

  return { csv: toCsv(header, rows), rows: rows.length }
}

export async function wantlistCsv(): Promise<{ csv: string; rows: number }> {
  const db = await openFidelityDb()
  const items = await db.getAll('wantlist')

  const header = [...CATALOGUE_HEADER, 'added', 'note']
  const rows = items
    .sort(
      (a, b) =>
        a.artistNames.join().localeCompare(b.artistNames.join()) ||
        a.title.localeCompare(b.title),
    )
    .map((item) => [...catalogue(item), item.addedAt, item.note ?? ''])

  return { csv: toCsv(header, rows), rows: rows.length }
}
