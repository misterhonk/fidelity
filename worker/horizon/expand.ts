import type { HorizonChunk, Kin } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import {
  artistProfileSchema,
  artistReleasesSchema,
  labelReleasesSchema,
  masterVersionsSchema,
  type ArtistProfile,
} from '../discogs/entities'

import { packChunk, parseCatno, roleIndex, type Edge } from './pack'
import { LABEL_PAGE_LIMIT, type Candidate } from './select'

export const PER_PAGE = 100

/** Nobody's discography justifies more than this many requests. */
export const MAX_PAGES_PER_ENTITY = 15

/**
 * How much of a catalogue has to arrive before the chunk counts as complete.
 * Not 1.0: a handful of duplicates across pages is normal and harmless.
 */
export const COMPLETENESS_THRESHOLD = 0.95

/**
 * How many other names one artist may bring along.
 *
 * An orchestra lists a hundred members and a session band every name that
 * ever sat in. Past this it is a roster, not a lexicon — and the aliases come
 * first, because they are the same person and the members are not.
 */
export const MAX_KIN = 100

export interface ExpandResult {
  chunk: HorizonChunk
  requests: number
  /** What the endpoint says the entity has in total, for the lift. */
  catalogueSize: number
}

interface ExpandOptions {
  client: DiscogsClient
  signal?: AbortSignal
  now?: () => number
}

/**
 * Expands one entity into release-id edges.
 *
 * Artists come back mixed: `type: "master"` rows carry `main_release`, which
 * is the pressing almost everybody owns, and `type: "release"` rows are direct.
 * Stage one takes both for free. Stage two — asking a master for all its
 * versions — happens on demand after a dig, so the horizon gets better with
 * use instead of costing thirteen minutes more up front (docs/11 §4).
 */
export async function expandEntity(
  candidate: Candidate,
  { client, signal, now = Date.now }: ExpandOptions,
): Promise<ExpandResult> {
  const edges: Edge[] = []
  let requests = 0
  let pages = 1
  let catalogueSize = 0
  let complete = true

  for (let page = 1; page <= Math.min(pages, MAX_PAGES_PER_ENTITY); page++) {
    signal?.throwIfAborted()

    if (candidate.kind === 'artist') {
      const response = await client.get(
        `/artists/${candidate.id}/releases`,
        artistReleasesSchema,
        { query: { page, per_page: PER_PAGE }, signal },
      )
      requests += 1
      ;({ pages } = response.pagination)
      catalogueSize = response.pagination.items

      for (const row of response.releases) {
        // A master row points at its main pressing; a release row is itself.
        const releaseId = row.type === 'master' ? (row.main_release ?? 0) : row.id
        if (releaseId > 0) {
          edges.push({ releaseId, role: roleIndex(row.role), year: row.year ?? 0 })
        }
      }
    } else if (candidate.kind === 'label') {
      const response = await client.get(
        `/labels/${candidate.id}/releases`,
        labelReleasesSchema,
        {
          query: { page, per_page: PER_PAGE },
          signal,
        },
      )
      requests += 1
      ;({ pages } = response.pagination)
      catalogueSize = response.pagination.items

      // docs/11 §3 wants labels under 1.500 releases. The size only arrives
      // with the first page, so an oversized label is cut short here and
      // marked incomplete rather than paged through fifteen times — a
      // catalogue that large says nothing about taste anyway.
      if (catalogueSize >= LABEL_PAGE_LIMIT) complete = false

      for (const row of response.releases) {
        const catno = parseCatno(row.catno)
        edges.push({
          releaseId: row.id,
          role: 0,
          year: row.year ?? 0,
          catnoNum: catno?.num,
          catnoPrefix: catno?.prefix,
        })
      }

      if (!complete) break
    } else {
      const response = await client.get(
        `/masters/${candidate.id}/versions`,
        masterVersionsSchema,
        { query: { page, per_page: PER_PAGE }, signal },
      )
      requests += 1
      ;({ pages } = response.pagination)
      catalogueSize = response.pagination.items

      for (const row of response.versions) {
        const catno = parseCatno(row.catno)
        edges.push({
          releaseId: row.id,
          role: 0,
          year: Number.parseInt(row.released ?? '', 10) || 0,
          catnoNum: catno?.num,
          catnoPrefix: catno?.prefix,
        })
      }
    }
  }

  if (pages > MAX_PAGES_PER_ENTITY) complete = false

  // The lexicon: one more request for an artist, none for anything else.
  // Part of the same expansion on purpose — a chunk with the discography and
  // no names is the state this feature found, and it is "due" until it has
  // both (revalidate.ts).
  let kin: Kin[] | undefined
  if (candidate.kind === 'artist') {
    signal?.throwIfAborted()
    const profile = await client.get(`/artists/${candidate.id}`, artistProfileSchema, {
      signal,
    })
    requests += 1
    kin = kinOf(profile)
  }

  const chunk = packChunk(candidate.kind, candidate.id, candidate.name, edges, {
    fetchedAt: now(),
    complete,
    requests,
  })

  // Completeness is judged by what actually arrived, not by page arithmetic.
  //
  // Discogs' pagination is a claim, not a promise — docs/02 records that
  // `pagination.pages` lies for inventories, and label listings turn out to
  // repeat releases across pages: Cocoon Recordings reports 1.499 items and
  // yields 947 distinct ones over all fifteen pages. Trusting the header would
  // mark that chunk complete and quietly under-report the label forever.
  if (catalogueSize > 0 && chunk.releaseIds.length < catalogueSize * COMPLETENESS_THRESHOLD) {
    chunk.complete = false
  }

  if (kin) chunk.kin = kin

  return { chunk, requests, catalogueSize }
}

/**
 * Every other name an artist answers to, the same person first.
 *
 * Name variations and aliases are both "alias" here: for matching a string
 * from an inventory the difference between a spelling and a side project is
 * none — Discogs says it is the same person either way. Members and groups
 * keep their direction, because the sentence has to say who is part of whom.
 */
export function kinOf(profile: ArtistProfile): Kin[] {
  const kin: Kin[] = []
  const seen = new Set<string>()

  const add = (name: string, relation: Kin['relation']) => {
    const trimmed = name.trim()
    const key = trimmed.toLowerCase()
    if (trimmed.length === 0 || seen.has(key) || kin.length >= MAX_KIN) return
    seen.add(key)
    kin.push({ name: trimmed, relation })
  }

  for (const name of profile.namevariations ?? []) add(name, 'alias')
  for (const alias of profile.aliases ?? []) add(alias.name, 'alias')
  for (const member of profile.members ?? []) add(member.name, 'member')
  for (const group of profile.groups ?? []) add(group.name, 'group')

  return kin
}
