import { openFidelityDb } from '~~/db/open'
import type { ShelfRecord, ShelfSort, ShelfView } from '#shared/types'

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
  sort?: ShelfSort
  offset?: number
  limit?: number
}

export async function shelfView({
  query = '',
  sort = 'added',
  offset = 0,
  limit = PAGE_SIZE,
}: ShelfQuery): Promise<ShelfView> {
  const db = await openFidelityDb()
  const all = await db.getAll('collection')

  const needles = tokens(norm(query)).filter((token) => token.length > 0)
  const filtered = needles.length
    ? all.filter((item) => {
        const haystack = `${item.artistNorms.join(' ')} ${norm(item.title)} ${item.labelNorms.join(' ')}`
        return needles.every((needle) => haystack.includes(needle))
      })
    : all

  const records: ShelfRecord[] = filtered.map((item) => ({
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

  sortRecords(records, sort)

  return {
    records: records.slice(offset, offset + limit),
    total: records.length,
    /** Of the whole collection, not of the filtered set — the denominator. */
    collection: all.length,
  }
}

function sortRecords(records: ShelfRecord[], sort: ShelfSort): void {
  const byArtist = (a: ShelfRecord, b: ShelfRecord) =>
    a.artist.localeCompare(b.artist, 'de') ||
    a.year - b.year ||
    a.title.localeCompare(b.title, 'de')

  switch (sort) {
    case 'artist':
      records.sort(byArtist)
      break
    case 'year':
      // Oldest first, because a shelf sorted by year is a timeline and
      // timelines run forwards.
      records.sort((a, b) => a.year - b.year || byArtist(a, b))
      break
    case 'rating':
      // Unrated last rather than first: a 0 here means "never said", not "bad".
      records.sort(
        (a, b) => (b.rating || -1) - (a.rating || -1) || a.artist.localeCompare(b.artist, 'de'),
      )
      break
    default:
      // Newest addition first. What you just bought is what you want to see.
      records.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byArtist(a, b))
  }
}
