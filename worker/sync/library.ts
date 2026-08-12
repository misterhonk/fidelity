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
): Omit<CollectionItem, 'instanceId' | 'folderId'> {
  const artists = info.artists ?? []
  const labels = info.labels ?? []

  return {
    releaseId,
    masterId: info.master_id ?? 0,
    title: info.title,
    artistIds: artists.map((artist) => artist.id),
    artistNorms: artists.map((artist) => norm(artist.name)),
    artistNames: artists.map((artist) => artist.name),
    labelIds: labels.map((label) => label.id),
    labelNorms: labels.map((label) => norm(label.name)),
    labelNames: labels.map((label) => label.name),
    catnos: labels.map((label) => label.catno ?? '').filter((catno) => catno.length > 0),
    genres: info.genres ?? [],
    styles: info.styles ?? [],
    formats: (info.formats ?? []).flatMap((format) => [
      format.name,
      ...(format.descriptions ?? []),
    ]),
    year: info.year ?? 0,
    // Empty rather than null when Discogs has no cover, so the shelf can ask
    // one question instead of two.
    thumbUrl: info.thumb ?? '',
    coverUrl: info.cover_image ?? '',
    rating,
    addedAt: dateAdded,
  }
}

/**
 * Was die Sammlung ohnehin mitbringt, in die gemeinsame Cover-Ablage.
 *
 * `basic_information` carries `thumb` and `cover_image`, so a synced library
 * hands over a few thousand covers for no requests at all. They are worth
 * copying out of the collection row because a dig hits a release the shelf
 * already knows more often than it looks — another pressing of something you
 * own is a signal, and now it arrives with a picture instead of a grey square.
 */
async function mirrorCovers(
  items: { releaseId: number; thumbUrl: string; coverUrl: string }[],
) {
  const { writeCovers } = await import('~~/db/covers')
  await writeCovers(
    items
      .filter((item) => item.thumbUrl || item.coverUrl)
      .map(({ releaseId, thumbUrl, coverUrl }) => ({ releaseId, thumbUrl, coverUrl })),
  )
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
        item: {
          ...toItem(row.id, row.basic_information, row.date_added, row.rating ?? 0),
          /*
           * The entry, or a stand-in that cannot be written to.
           *
           * Both fields are optional in the schema because an older response
           * carried neither. Without an id there is still a row to store, and
           * it still needs a key of its own — `-releaseId`, the same
           * convention a record added from a find uses: unique per release,
           * never confusable with a real instance (those are positive), and
           * refused by every write path.
           *
           * Folder 0 would be no better than none: it is Discogs' virtual
           * "All" and not a valid target for a write.
           */
          instanceId: row.instance_id ?? -row.id,
          folderId: row.folder_id ?? 0,
        },
      })),
    write: async (items) => {
      const tx = db.transaction('collection', 'readwrite')
      for (const item of items) {
        await tx.store.put(item)
        /*
         * And the provisional row this replaces, if there was one.
         *
         * A record put on the shelf from a find sits under `-releaseId` until
         * Discogs has been asked. Once the real entry arrives it would
         * otherwise stand beside it — the same record twice, one of them
         * un-writable, which is exactly the bug this whole change is about.
         */
        if (item.instanceId > 0) await tx.store.delete(-item.releaseId)
      }
      await tx.done
      await mirrorCovers(items)
    },
    knownSince: syncState?.lastCollectionAdd ?? null,
  })

  /*
   * The estimate, but only when the shelf actually changed.
   *
   * A delta sync over an unchanged collection costs exactly one request, and
   * that guarantee is worth more than a fresher estimate — it is what makes
   * the keeper able to run every half hour without anybody noticing. So the
   * value rides along with a walk that stored something and otherwise waits.
   *
   * Which means the number tracks the collection rather than the market: it
   * moves when a record is added, not when somebody in Osaka reprices theirs.
   * That is the honest reading of an estimate shown with a date on it.
   */
  if (result.stored > 0) {
    const { refreshCollectionValue } = await import('../collection/value')
    await refreshCollectionValue(context.client, context.username, Date.now())
  }

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
        const { rating: _rating, ...base } = toItem(
          row.id,
          row.basic_information,
          row.date_added,
          0,
        )
        return {
          dateAdded: row.date_added,
          item: { ...base, note: row.notes ?? '', want: row.rating ?? 0 },
        }
      }),
    write: async (items) => {
      const tx = db.transaction('wantlist', 'readwrite')
      for (const item of items) await tx.store.put(item)
      await tx.done
      await mirrorCovers(items)
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
