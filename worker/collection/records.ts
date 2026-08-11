import { openFidelityDb } from '~~/db/open'
import { DEFAULT_SHELF_DIRECTION } from '#shared/types'
import type { ShelfRecord, ShelfSort, ShelfView, SortDirection } from '#shared/types'

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
  direction?: SortDirection
  offset?: number
  limit?: number
}

export async function shelfView({
  query = '',
  sort = 'added',
  // Ohne Angabe die Vorgabe des Schlüssels — so verhält sich jeder Aufruf, der
  // die Richtung nicht kennt, exakt wie vorher.
  direction,
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

  sortRecords(records, sort, direction ?? DEFAULT_SHELF_DIRECTION[sort])

  return {
    records: records.slice(offset, offset + limit),
    total: records.length,
    /** Of the whole collection, not of the filtered set — the denominator. */
    collection: all.length,
  }
}

/**
 * Sortiert, und dreht danach um, wenn es verlangt ist.
 *
 * Umdrehen statt zwei Vergleicher je Schlüssel: der Vergleicher entscheidet
 * die *Reihenfolge*, die Richtung nur, von welchem Ende man sie liest. Zwei
 * Vergleicher wären zwei Stellen, an denen die Nebensortierung — bei gleichem
 * Jahr nach Künstler — auseinanderlaufen kann.
 *
 * Die Vorgabe je Schlüssel steht in `DEFAULT_SHELF_DIRECTION`; hier ist sie
 * die eine Richtung, die *nicht* umdreht.
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
      // Ältestes zuerst, weil eine nach Jahren sortierte Sammlung eine
      // Zeitachse ist und Zeitachsen vorwärts laufen.
      records.sort((a, b) => a.year - b.year || byArtist(a, b))
      break
    case 'rating':
      // Unbewertet ans Ende statt an den Anfang: eine 0 heißt hier „nie etwas
      // gesagt", nicht „schlecht".
      records.sort(
        (a, b) => (b.rating || -1) - (a.rating || -1) || a.artist.localeCompare(b.artist, 'de'),
      )
      break
    default:
      // Neueste Anschaffung zuerst. Was man gerade gekauft hat, will man sehen.
      records.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byArtist(a, b))
  }

  // Der Vergleicher oben liefert die Vorgabe-Richtung dieses Schlüssels. Ist
  // die andere verlangt, wird dieselbe Reihenfolge von hinten gelesen.
  if (direction !== DEFAULT_SHELF_DIRECTION[sort]) records.reverse()
}
