import type { ZodType } from 'zod'

import { getMeta, updateSyncState } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { CollectionItem, WantlistItem } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import {
  collectionPageSchema,
  wantlistPageSchema,
  type BasicInformation,
  type CollectionPage,
  type WantlistPage,
} from '../discogs/schemas'
import { norm } from '../match/normalize'

/** The default is 50, which would double every sync. */
export const PER_PAGE = 100

export interface SyncProgress {
  kind: 'collection' | 'wantlist'
  stored: number
  /** What Discogs reports in total; a delta run stops long before it. */
  total: number
  requests: number
}

export interface SyncSummary {
  stored: number
  requests: number
  total: number
}

export interface SyncResult {
  collection: SyncSummary
  wantlist: SyncSummary
}

/**
 * Everything the matching engine needs, flattened out of basic_information and
 * normalised right here — once per record, not once per dig.
 *
 * `country` is deliberately absent: basic_information does not carry it
 * (docs/02 §4), so a sync alone cannot feed a country facet.
 */
function toItem(
  releaseId: number,
  info: BasicInformation,
  dateAdded: string,
  rating: number,
): CollectionItem {
  const artists = info.artists ?? []
  const labels = info.labels ?? []

  return {
    releaseId,
    masterId: info.master_id ?? 0,
    title: info.title,
    artistIds: artists.map((artist) => artist.id),
    artistNorms: artists.map((artist) => norm(artist.name)),
    labelIds: labels.map((label) => label.id),
    labelNorms: labels.map((label) => norm(label.name)),
    catnos: labels.map((label) => label.catno ?? '').filter((catno) => catno.length > 0),
    genres: info.genres ?? [],
    styles: info.styles ?? [],
    formats: (info.formats ?? []).flatMap((format) => [
      format.name,
      ...(format.descriptions ?? []),
    ]),
    year: info.year ?? 0,
    rating,
    addedAt: dateAdded,
  }
}

export interface SyncContext {
  client: DiscogsClient
  username: string
  report?: (progress: SyncProgress) => void
  signal?: AbortSignal
}

interface PagedOptions<TPage, TItem> {
  kind: SyncProgress['kind']
  path: string
  schema: ZodType<TPage>
  pagination: (page: TPage) => { pages: number; items: number }
  rows: (page: TPage) => { dateAdded: string; item: TItem }[]
  write: (items: TItem[]) => Promise<void>
  /**
   * Stop at the first record already known. null means walk everything.
   */
  knownSince: string | null
}

/**
 * Pages newest-first and stops early.
 *
 * Discogs has no `updated_since`, but it does sort by date added. Walking from
 * the newest and stopping at the first record we already have turns the daily
 * sync into a single request; a full walk only happens the first time.
 */
async function syncPaged<TPage, TItem>(
  { report, signal, client }: SyncContext,
  options: PagedOptions<TPage, TItem>,
): Promise<SyncSummary & { newest: string | null }> {
  let page = 1
  let pages = 1
  let items = 0
  let requests = 0
  let stored = 0
  let newest: string | null = null
  let reachedKnown = false

  while (page <= pages && !reachedKnown) {
    signal?.throwIfAborted()

    const response = await client.get(options.path, options.schema, {
      query: { page, per_page: PER_PAGE, sort: 'added', sort_order: 'desc' },
      signal,
    })
    requests += 1
    ;({ pages, items } = options.pagination(response))

    const fresh: TItem[] = []
    for (const { dateAdded, item } of options.rows(response)) {
      newest ??= dateAdded
      if (options.knownSince !== null && dateAdded <= options.knownSince) {
        reachedKnown = true
        break
      }
      fresh.push(item)
    }

    if (fresh.length > 0) {
      await options.write(fresh)
      stored += fresh.length
    }

    report?.({ kind: options.kind, stored, total: items, requests })
    page += 1
  }

  return { stored, requests, total: items, newest }
}

export async function syncCollection(context: SyncContext): Promise<SyncSummary> {
  const syncState = await getMeta('syncState')
  const db = await openFidelityDb()

  const result = await syncPaged<CollectionPage, CollectionItem>(context, {
    kind: 'collection',
    path: `/users/${encodeURIComponent(context.username)}/collection/folders/0/releases`,
    schema: collectionPageSchema,
    pagination: (page) => page.pagination,
    rows: (page) =>
      page.releases.map((row) => ({
        dateAdded: row.date_added,
        item: toItem(row.id, row.basic_information, row.date_added, row.rating ?? 0),
      })),
    write: async (items) => {
      const tx = db.transaction('collection', 'readwrite')
      for (const item of items) await tx.store.put(item)
      await tx.done
    },
    knownSince: syncState?.lastCollectionAdd ?? null,
  })

  await updateSyncState({
    collectionSyncedAt: Date.now(),
    // Only ever moves forward, and only when something was actually seen.
    lastCollectionAdd: result.newest ?? syncState?.lastCollectionAdd ?? null,
  })

  return result
}

export async function syncWantlist(context: SyncContext): Promise<SyncSummary> {
  const db = await openFidelityDb()

  const result = await syncPaged<WantlistPage, WantlistItem>(context, {
    kind: 'wantlist',
    path: `/users/${encodeURIComponent(context.username)}/wants`,
    schema: wantlistPageSchema,
    pagination: (page) => page.pagination,
    rows: (page) =>
      page.wants.map((row) => {
        const { rating: _rating, ...want } = toItem(
          row.id,
          row.basic_information,
          row.date_added,
          0,
        )
        return { dateAdded: row.date_added, item: want }
      }),
    write: async (items) => {
      const tx = db.transaction('wantlist', 'readwrite')
      for (const item of items) await tx.store.put(item)
      await tx.done
    },
    // No delta here. A wantlist is small and changes in both directions —
    // stopping early would save one request and cost correctness.
    knownSince: null,
  })

  await updateSyncState({ wantlistSyncedAt: Date.now() })
  return result
}

/**
 * The trade-off worth naming: a delta sees additions, not removals. A record
 * deleted from the collection stays in the mirror until a full resync, which
 * is what signing out and back in does.
 */
export async function syncLibrary(context: SyncContext): Promise<SyncResult> {
  return {
    collection: await syncCollection(context),
    wantlist: await syncWantlist(context),
  }
}
