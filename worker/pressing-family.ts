import type { DiscogsClient } from './discogs/client'
import { masterVersionsSchema } from './discogs/entities'
import { releaseDetailSchema } from './dig/enrich'
import { pressingWarnings, readPressing } from './match/pressing'
import type { PressingFamily, PressingSibling } from '#shared/types'

/**
 * The pressing in your hand, placed among all the others (docs/06 M19 #7).
 *
 * The roadmap had this down as a hub job — the whole catalogue's identifiers,
 * ingested from the dump. Read against what the API already answers, the hub
 * would only save requests, and no feature may need it (rule 8): the run-out
 * search reaches the whole catalogue already (M13), and one request more
 * places the record among its pressings. That is what this does, on demand,
 * for one record — never in a loop (rule 2).
 *
 * Two requests. `/releases/{id}` is M7's reading: stated reissue, country,
 * year, the marks in the run-out. `/masters/{id}/versions`, sorted by release
 * date, is what M7 lacked beyond the horizon — the album's own first year,
 * and which pressings carry it. A record without a master is only itself,
 * and the profile still says what it says.
 */

/** One page, earliest first. Nobody needs the second hundred to know the first year. */
const PER_PAGE = 100

/** How many first pressings are worth listing. */
const MAX_FIRST = 6

export async function pressingFamily(
  client: DiscogsClient,
  releaseId: number,
  signal?: AbortSignal,
): Promise<PressingFamily | null> {
  let release
  try {
    release = await client.get(`/releases/${releaseId}`, releaseDetailSchema, { signal })
  } catch {
    // No answer is a candidate row without a verdict, not an error in the
    // shop: everything the row already said came from the search.
    return null
  }

  const masterId = release.master_id && release.master_id > 0 ? release.master_id : null
  let siblings: PressingSibling[] = []
  let total = 0

  if (masterId !== null) {
    try {
      const versions = await client.get(`/masters/${masterId}/versions`, masterVersionsSchema, {
        query: { per_page: PER_PAGE, sort: 'released', sort_order: 'asc' },
        signal,
      })
      total = versions.pagination.items
      siblings = versions.versions.map((version) => ({
        releaseId: version.id,
        year: yearOf(version.released),
        country: version.country ?? '',
        label: version.label ?? '',
        catno: version.catno ?? '',
        format: [...(version.major_formats ?? []), version.format ?? '']
          .filter(Boolean)
          .join(', '),
      }))
    } catch {
      // The versions are the second half; the first half stands on its own.
    }
  }

  const firstYear = siblings.reduce<number | null>(
    (first, sibling) =>
      sibling.year !== null && (first === null || sibling.year < first) ? sibling.year : first,
    null,
  )

  // Its own medium first: somebody holding a record wants the first vinyl,
  // and the 1994 cassette from India is the first pressing only on paper.
  const medium = mediumOf(release.formats?.map((format) => format.name ?? '') ?? [])
  const fromFirstYear = siblings.filter((sibling) => sibling.year === firstYear)
  const sameMedium = medium ? fromFirstYear.filter((s) => mediumOf([s.format]) === medium) : []
  const first = (sameMedium.length > 0 ? sameMedium : fromFirstYear).slice(0, MAX_FIRST)

  const profile = readPressing(release, firstYear)

  return {
    releaseId,
    masterId,
    profile,
    warnings: pressingWarnings(profile),
    total,
    firstYear,
    first,
    amongFirst: firstYear !== null && fromFirstYear.some((s) => s.releaseId === releaseId),
  }
}

/** "1994-08-22" and "1994" both mean 1994; "0" and "" mean nobody knows. */
export function yearOf(released: string | undefined): number | null {
  const year = Number.parseInt(released ?? '', 10)
  return year > 1880 ? year : null
}

/** The medium behind a format string, or null when it says none. */
export function mediumOf(formats: string[]): 'vinyl' | 'cd' | 'cassette' | null {
  const text = formats.join(' ').toLowerCase()
  if (/vinyl|\blp\b|12"|10"|7"/.test(text)) return 'vinyl'
  if (/\bcd\b|compact disc/.test(text)) return 'cd'
  if (/cassette|\bmc\b/.test(text)) return 'cassette'
  return null
}
