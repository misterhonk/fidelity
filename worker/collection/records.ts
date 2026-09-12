import { openFidelityDb } from '~~/db/open'
import { DEFAULT_SHELF_DIRECTION } from '#shared/types'
import type {
  CollectionItem,
  ShelfRecord,
  ShelfSort,
  ShelfView,
  SortDirection,
} from '#shared/types'

import { norm, tokens } from '../match/normalize'

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
}

export async function shelfView({
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
}: ShelfQuery): Promise<ShelfView> {
  const db = await openFidelityDb()
  const all = await db.getAll('collection')

  /*
   * "Not placed yet" is a row without a placement, or with one that points
   * nowhere — or at a place another device has dissolved. The wall counts
   * only living places, and so does this.
   */
  const placed = new Set<number>()
  if (unplaced) {
    const [placements, places] = await Promise.all([
      db.getAll('placements'),
      db.getAll('places'),
    ])
    const alive = new Set(places.filter((place) => !place.removedAt).map((place) => place.id))
    for (const placement of placements) {
      if (placement.placeId && alive.has(placement.placeId)) placed.add(placement.instanceId)
    }
  }

  const needles = tokens(norm(query)).filter((token) => token.length > 0)
  const wantedLabel = norm(label)
  const wantedArtist = norm(artist)

  const filtered = all.filter((item) => {
    if (unplaced && placed.has(item.instanceId)) return false
    if (wantedLabel && !item.labelNorms.includes(wantedLabel)) return false
    if (wantedArtist && !item.artistNorms.includes(wantedArtist)) return false
    if (!needles.length) return true

    const haystack = `${item.artistNorms.join(' ')} ${norm(item.title)} ${item.labelNorms.join(' ')}`
    return needles.every((needle) => haystack.includes(needle))
  })

  const records: ShelfRecord[] = filtered.map((item) => ({
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
  }))

  sortRecords(records, sort, direction ?? DEFAULT_SHELF_DIRECTION[sort])

  return {
    records: records.slice(offset, offset + limit),
    total: records.length,
    /** Of the whole collection, not of the filtered set — the denominator. */
    collection: all.length,
  }
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
