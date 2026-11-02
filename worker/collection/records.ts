import { getMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { FieldValues, OutboxJob } from '~~/db/schema'
import { gradeFieldIds, isWorn } from '#shared/grades'
import { DEFAULT_SHELF_DIRECTION } from '#shared/types'
import type {
  CollectionField,
  CollectionItem,
  Place,
  Placement,
  ShelfChip,
  ShelfRecord,
  ShelfSort,
  ShelfView,
  SortDirection,
} from '#shared/types'

import { norm } from '../match/normalize'

/**
 * The collection as a shelf you can look at.
 *
 * Everything else in this app is about records you do not have yet. This is
 * the other half — and until now the only way to see your own records was on
 * Discogs.
 *
 * The filtering and sorting happen here rather than in the page for the reason
 * CLAUDE.md gives: the main thread renders and takes input, it does not walk
 * two thousand rows on every keystroke.
 */

/** One screenful of a big shelf. More arrives when the page asks. */
export const PAGE_SIZE = 120

export interface ShelfQuery {
  query?: string
  /**
   * One label, one artist — the two questions a record answers about itself.
   *
   * Separate from `query` rather than folded into it, because they promise
   * something the search box cannot: "everything on Cocoon Recordings" must
   * not also bring back a record *called* Cocoon. Matched against the whole
   * normalised list, not the first entry — a record on two labels belongs
   * under both, and the shelf only ever shows the first one.
   */
  label?: string
  artist?: string
  sort?: ShelfSort
  direction?: SortDirection
  offset?: number
  limit?: number
  /** Only what has no living place yet (M27.1c): the pile still to sort in. */
  unplaced?: boolean
  /** The chips (#236). Every one given has to hold. */
  only?: ShelfChip[]
}

export async function shelfView(params: ShelfQuery): Promise<ShelfView> {
  const db = await openFidelityDb()
  const [items, placements, places, fieldRows, jobs, fields] = await Promise.all([
    db.getAll('collection'),
    db.getAll('placements'),
    db.getAll('places'),
    db.getAll('fieldValues'),
    db.getAll('outbox'),
    getMeta('collectionFields'),
  ])
  return shelve({ items, placements, places, fieldRows, jobs, fields: fields ?? [] }, params)
}

/** What the shelf is built from: the stores, already read. */
export interface ShelfStores {
  items: CollectionItem[]
  placements: Pick<Placement, 'instanceId' | 'placeId'>[]
  places: Pick<Place, 'id' | 'removedAt'>[]
  fieldRows: FieldValues[]
  jobs: Pick<OutboxJob, 'id' | 'kind' | 'attempts' | 'lastError'>[]
  fields: CollectionField[]
}

/**
 * The shelf itself, without I/O — so 20,000 rows can be timed (#236).
 *
 * One pass to index what the chips and the row columns need, one to filter,
 * one to sort. Maps keyed by instance rather than a lookup per row.
 */
export function shelve(
  { items, placements, places, fieldRows, jobs, fields }: ShelfStores,
  {
    query = '',
    label = '',
    artist = '',
    sort = 'added',
    // With nothing given, the key's default — so every caller that does not know
    // about direction behaves exactly as before.
    direction,
    offset = 0,
    limit = PAGE_SIZE,
    unplaced = false,
    only = [],
  }: ShelfQuery,
): ShelfView {
  const chips = new Set<ShelfChip>(only)
  if (unplaced) chips.add('unplaced')

  /*
   * "Not placed yet" is a row without a placement, or with one that points
   * nowhere — or at a place another device has dissolved. The wall counts
   * only living places, and so does this.
   */
  const alive = new Set(places.filter((place) => !place.removedAt).map((place) => place.id))
  const placeOf = new Map<number, string>()
  for (const placement of placements) {
    if (placement.placeId && alive.has(placement.placeId))
      placeOf.set(placement.instanceId, placement.placeId)
  }

  const grade = gradeFieldIds(fields)
  const valuesOf = new Map(fieldRows.map((row) => [row.instanceId, row.values]))

  // Ids are `${kind}:${instanceId}` or `${kind}:${instanceId}:${field}`; an add is keyed by release.
  const outbox = new Map<number, { waiting: number; failing: boolean }>()
  for (const job of jobs) {
    if (!job.kind.startsWith('collection.') || job.kind === 'collection.add') continue
    const instanceId = Number(job.id.split(':')[1])
    const was = outbox.get(instanceId) ?? { waiting: 0, failing: false }
    outbox.set(instanceId, {
      waiting: was.waiting + 1,
      failing: was.failing || job.attempts > 0 || job.lastError !== undefined,
    })
  }

  // Copies per release, and distinct releases per master: doubles and other pressings.
  const copies = new Map<number, number>()
  const pressings = new Map<number, Set<number>>()
  for (const item of items) {
    copies.set(item.releaseId, (copies.get(item.releaseId) ?? 0) + 1)
    if (item.masterId > 0) {
      const set = pressings.get(item.masterId) ?? new Set<number>()
      set.add(item.releaseId)
      pressings.set(item.masterId, set)
    }
  }

  // A lone digit stays: "WARP 9" must not match every WARP record.
  const needles = norm(query)
    .split(' ')
    .filter((token) => token.length > 1 || /\d/.test(token))
  const wantedLabel = norm(label)
  const wantedArtist = norm(artist)

  const records: ShelfRecord[] = []
  for (const item of items) {
    if (wantedLabel && !item.labelNorms.includes(wantedLabel)) continue
    if (wantedArtist && !item.artistNorms.includes(wantedArtist)) continue
    if (needles.length) {
      const haystack = `${item.artistNorms.join(' ')} ${norm(item.title)} ${item.labelNorms.join(' ')} ${catnoText(item.catnos)}`
      if (!needles.every((needle) => haystack.includes(needle))) continue
    }

    const values = valuesOf.get(item.instanceId) ?? {}
    const media = values[grade.media] ?? ''
    const sleeve = values[grade.sleeve] ?? ''
    const placeId = placeOf.get(item.instanceId) ?? null

    if (chips.has('unplaced') && placeId) continue
    if (chips.has('ungraded') && media) continue
    if (chips.has('doubles') && (copies.get(item.releaseId) ?? 0) < 2) continue
    if (chips.has('otherPressing') && (pressings.get(item.masterId)?.size ?? 0) < 2) continue
    if (chips.has('worn') && !isWorn(media, sleeve)) continue

    const sync = item.instanceId > 0 ? outbox.get(item.instanceId) : undefined
    records.push({
      instanceId: item.instanceId,
      releaseId: item.releaseId,
      title: item.title,
      artist: item.artistNames[0] ?? '',
      label: item.labelNames[0] ?? '',
      year: item.year,
      formats: item.formats,
      rating: item.rating,
      thumbUrl: item.thumbUrl ?? '',
      coverUrl: item.coverUrl ?? '',
      addedAt: item.addedAt,
      catno: item.catnos[0] ?? '',
      folderId: item.folderId,
      placeId,
      media,
      sleeve,
      waiting: sync?.waiting ?? 0,
      failing: sync?.failing ?? false,
    })
  }

  sortRecords(records, sort, direction ?? DEFAULT_SHELF_DIRECTION[sort])

  return {
    records: records.slice(offset, offset + limit),
    total: records.length,
    /** Of the whole collection, not of the filtered set — the denominator. */
    collection: items.length,
  }
}

/**
 * Catalogue numbers as somebody types them (#246): case, dashes and spaces are
 * what differs between the sleeve and the box, so each one is there spaced and
 * squashed — "WARP LP 30" answers "warp-lp-30" and "warplp30" alike.
 */
export function catnoText(catnos: readonly string[]): string {
  return catnos
    .map((catno) => {
      const spaced = catno
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
      return `${spaced} ${spaced.replaceAll(' ', '')}`
    })
    .join(' ')
}

/**
 * Sorts, and reverses afterwards where that is asked for.
 *
 * Reversing rather than two comparators per key: the comparator decides the
 * *order*, the direction only which end you read it from. Two comparators
 * would be two places where the secondary sort — by artist within the same
 * year — could drift apart.
 *
 * The default per key is in `DEFAULT_SHELF_DIRECTION`; here it is the one
 * direction that does *not* reverse.
 */
function sortRecords(records: ShelfRecord[], sort: ShelfSort, direction: SortDirection): void {
  const byArtist = (a: ShelfRecord, b: ShelfRecord) =>
    a.artist.localeCompare(b.artist, 'de') ||
    a.year - b.year ||
    a.title.localeCompare(b.title, 'de')

  switch (sort) {
    case 'catno': {
      // Natural order, so WARP 9 comes before WARP 10; blanks last from either end,
      // and Discogs writes a blank as "none".
      const blank = (record: ShelfRecord) =>
        Number(!record.catno || /^none$/i.test(record.catno))
      const turn = direction === 'asc' ? 1 : -1
      records.sort(
        (a, b) =>
          blank(a) - blank(b) ||
          (blank(a) ? 0 : turn) *
            a.catno.localeCompare(b.catno, 'en', { numeric: true, sensitivity: 'base' }) ||
          byArtist(a, b),
      )
      return
    }
    case 'artist':
      records.sort(byArtist)
      break
    case 'year':
      // Earliest first, because a collection sorted by year is a timeline and
      // timelines run forwards.
      records.sort((a, b) => a.year - b.year || byArtist(a, b))
      break
    case 'rating':
      // Unrated to the end rather than the front: a 0 here means "never said
      // anything", not "bad".
      records.sort(
        (a, b) => (b.rating || -1) - (a.rating || -1) || a.artist.localeCompare(b.artist, 'de'),
      )
      break
    default:
      // Neueste Anschaffung zuerst. Was man gerade gekauft hat, will man sehen.
      records.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byArtist(a, b))
  }

  // The comparator above yields this key's default direction. Where the other
  // is asked for, the same order is read from the back.
  if (direction !== DEFAULT_SHELF_DIRECTION[sort]) records.reverse()
}

/**
 * One copy of your own, in full.
 *
 * The shelf grid carries a flattened row — enough for a tile, not enough for a
 * page. This reads the stored item instead, so genres, styles, every label and
 * every catalogue number are there. It costs no request: the sync wrote all of
 * it, and Discogs never has to be asked again.
 */
export async function shelfRecord(instanceId: number): Promise<CollectionItem | null> {
  const db = await openFidelityDb()
  return (await db.get('collection', instanceId)) ?? null
}
