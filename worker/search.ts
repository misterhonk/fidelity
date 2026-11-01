import { openFidelityDb } from '~~/db/open'
import { distinctReleases } from '~~/db/collection'
import type { Match, RecordHit, RecordSearch } from '#shared/types'

import { norm, tokens } from './match/normalize'
import { MIN_QUERY_LENGTH } from './collection/shelf'

/**
 * ⌘K's record search (#215): shelf, wantlist and the last dig, by artist,
 * title, label or catalogue number.
 *
 * Every word has to appear, like the shelf search beside it — somebody typing
 * watches the list and adds a letter; a fuzzy hit would name the wrong record.
 */

/** Per group: a palette that scrolls forever is a list, not a palette. */
export const RECORD_LIMIT = 8

const EMPTY: RecordSearch = { shelf: [], wantlist: [], dig: [] }

export async function searchRecords(query: string, matches: Match[]): Promise<RecordSearch> {
  const needles = tokens(norm(query))
  if (needles.length === 0 || query.trim().length < MIN_QUERY_LENGTH) return EMPTY

  const hit = (fields: (string | null | undefined)[]) => {
    const haystack = fields.map(norm).join(' ')
    // Catalogue numbers are typed with and without their space: "bst84167".
    const squashed = haystack.replace(/ /g, '')
    return needles.every((needle) => haystack.includes(needle) || squashed.includes(needle))
  }

  const db = await openFidelityDb()
  const [collection, wantlist] = await Promise.all([distinctReleases(), db.getAll('wantlist')])

  const fromItem =
    (source: 'shelf' | 'wantlist') =>
    (item: (typeof collection)[number] | (typeof wantlist)[number]): RecordHit => ({
      source,
      releaseId: item.releaseId,
      artist: item.artistNames[0] ?? '',
      title: item.title,
      label: item.labelNames[0] ?? '',
      catno: item.catnos[0] ?? '',
    })
  const itemHit = (item: (typeof collection)[number] | (typeof wantlist)[number]) =>
    hit([...item.artistNames, item.title, ...item.labelNames, ...item.catnos])

  return {
    shelf: collection.filter(itemHit).slice(0, RECORD_LIMIT).map(fromItem('shelf')),
    wantlist: wantlist.filter(itemHit).slice(0, RECORD_LIMIT).map(fromItem('wantlist')),
    dig: matches
      .filter((match) => hit([match.artist, match.title, match.label, match.catno]))
      .slice(0, RECORD_LIMIT)
      .map((match) => ({
        source: 'dig',
        releaseId: match.releaseId,
        artist: match.artist ?? '',
        title: match.title ?? '',
        label: match.label ?? '',
        catno: match.catno ?? '',
        digId: match.digId,
        listingId: match.listingId,
      })),
  }
}
