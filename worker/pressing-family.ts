import { getPreferences } from '~~/db/meta'
import type { DiscogsClient } from './discogs/client'
import { masterVersionsSchema } from './discogs/entities'
import { releaseDetailSchema } from './dig/enrich'
import { catalogueSource } from './catalogue/client'
import { createHubClient, type HubClient } from './hub/client'
import type { CatalogueSource } from '#shared/ports'
import { preferHub } from './hub/fallback'
import { pressingWarnings, readPressing } from './match/pressing'
import type { PressingFamily, PressingFamilyFacts, PressingSibling } from '#shared/types'
import { mediumOf } from '#shared/format'

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

/** Pressings are added, never taken away: a month-old family is still right. */
export const FAMILY_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface FamilyOptions {
  signal?: AbortSignal
  now?: () => number
  /** Normally read from the preferences; a test hands one in. */
  hub?: HubClient | null
  /** The catalogue (ADR-013), asked before the hub; a test hands one in. */
  catalogue?: CatalogueSource | null
}

/**
 * The versions list, from the hub when it has it (M20 #7), else from Discogs
 * — and then offered back, so the next person is spared the request. The
 * catalogue hub of docs/14 in miniature, on the hub that already runs.
 */
export async function familyFacts(
  client: DiscogsClient,
  masterId: number,
  { signal, now = Date.now, hub, catalogue }: FamilyOptions = {},
): Promise<PressingFamilyFacts> {
  /*
   * The catalogue first (docs/16 §6): its answer is the dump's, valid for the
   * build's month and the same for everybody — nothing to contribute back.
   * Null means "not configured" and "does not know" alike, and both fall
   * through to the hub and then to Discogs exactly as before.
   */
  if (catalogue) {
    const known = await catalogue.family(masterId)
    if (known) return known
  }

  const fromDiscogs = async (): Promise<PressingFamilyFacts> => {
    const versions = await client.get(`/masters/${masterId}/versions`, masterVersionsSchema, {
      query: { per_page: PER_PAGE, sort: 'released', sort_order: 'asc' },
      signal,
    })
    return {
      masterId,
      total: versions.pagination.items,
      fetchedAt: now(),
      siblings: versions.versions.map((version) => ({
        releaseId: version.id,
        year: yearOf(version.released),
        country: version.country ?? '',
        label: version.label ?? '',
        catno: version.catno ?? '',
        format: [...(version.major_formats ?? []), version.format ?? '']
          .filter(Boolean)
          .join(', '),
      })),
    }
  }

  return preferHub(fromDiscogs, {
    hub: hub
      ? async () => {
          const cached = await hub.family(masterId)
          // A family older than a month is a miss: it is still right, but a
          // month of new pressings is worth one request.
          return cached && now() - cached.fetchedAt < FAMILY_TTL_MS ? cached : null
        }
      : null,
    contribute: hub ? (fresh) => hub.contributeFamily(fresh) : null,
  })
}

export async function pressingFamily(
  client: DiscogsClient,
  releaseId: number,
  options: FamilyOptions | AbortSignal = {},
): Promise<PressingFamily | null> {
  const opts: FamilyOptions = options instanceof AbortSignal ? { signal: options } : options
  const { signal } = opts
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
      const hub =
        opts.hub === undefined
          ? await (async () => {
              const preferences = await getPreferences()
              return createHubClient({
                baseUrl: preferences.hubUrl,
                secret: preferences.hubSecret,
              })
            })()
          : opts.hub
      const catalogue = opts.catalogue === undefined ? await catalogueSource() : opts.catalogue
      const facts = await familyFacts(client, masterId, { ...opts, hub, catalogue })
      total = facts.total
      siblings = facts.siblings
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
  const medium = mediumOf(
    release.formats?.map((format) => format.name ?? '').join(', ') ?? null,
  )
  const fromFirstYear = siblings.filter((sibling) => sibling.year === firstYear)
  const sameMedium = medium ? fromFirstYear.filter((s) => mediumOf(s.format) === medium) : []
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
