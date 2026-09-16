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

/** How old the kept estimate may get before a sync fetches it again regardless. */
const VALUE_EVERY_MS = 24 * 60 * 60 * 1000

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
  /**
   * Rows that no longer exist at Discogs and therefore no longer here.
   *
   * Different from zero only after a full pass — a delta knows nothing about
   * removals and therefore claims none.
   */
  removed: number
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
export function toItem(
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
    /*
     * `qty` is a string in the response — "2", not 2. Summed across entries
     * because a release can list several: a 2×LP with a bonus 7" is three
     * discs in two blocks, and "2" would be the wrong half of the answer.
     */
    discs: (info.formats ?? []).reduce((total, format) => total + (Number(format.qty) || 1), 0),
    formatText: (info.formats ?? [])
      .map((format) => format.text ?? '')
      .filter((text) => text.length > 0),
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
  /** A row's key in the store — needed only for the sweep below. */
  key: (item: TItem) => number
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
): Promise<SyncSummary & { newest: string | null; seen: Set<number> | null }> {
  let page = 1
  let pages = 1
  let items = 0
  let requests = 0
  let stored = 0
  let newest: string | null = null
  let reachedKnown = false

  /*
   * What this run saw — but only where it could see everything.
   *
   * A delta stops at the first record it already knows and never sees the rest
   * of the shelf. Its set would therefore not be a statement about "what still
   * exists" but about "what was on top", and inferring anything from it would
   * mean deleting the rest. Hence `null` rather than half a truth.
   */
  const seenKeys: Set<number> | null = options.knownSince === null ? new Set() : null

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
      seenKeys?.add(options.key(item))
    }

    if (fresh.length > 0) {
      await options.write(fresh)
      stored += fresh.length
    }

    report?.({ kind: options.kind, stored, total: items, requests })
    page += 1
  }

  /*
   * This line is only reached after a pass with no abort: a `throwIfAborted`
   * or a client error leaves the loop through an exception. So a returned set
   * is either complete or `null`.
   */
  return { stored, requests, total: items, removed: 0, newest, seen: seenKeys }
}

/**
 * What is no longer at Discogs disappears here too.
 *
 * **Why this is needed:** a delta sees only new arrivals — the comment above
 * has always said so. But a *complete* pass had not noticed removals either,
 * because it wrote every row it read and never took one away. Seen on real
 * data on 2026-09-11: 26 wantlist entries locally, 24 at Discogs. Two removed
 * wants that stay until somebody signs out.
 *
 * On the wantlist that is cosmetic. In the collection it is not: "I already
 * own this" is a **hard filter** (`docs/04` §2), and a sold record left
 * standing in the mirror hides itself from every future dig.
 *
 * **The condition under which this is safe** is all of the caution here:
 * nothing is deleted except after a pass that read everything (`knownSince ===
 * null`) and returned without an exception. Anything else does not know the
 * shelf completely and may infer nothing from it.
 */
async function sweep<TStore extends 'collection' | 'wantlist'>(
  store: TStore,
  seenKeys: Set<number>,
  /** Rows Discogs cannot know about yet — those always survive. */
  keep: (key: number) => boolean = () => false,
): Promise<number> {
  const db = await openFidelityDb()
  const present = (await db.getAllKeys(store)) as number[]

  /*
   * An empty pass deletes nothing.
   *
   * A 200 with zero entries is indistinguishable from "you have nothing left"
   * — and the consequences are not symmetrical: in one case a few dead rows
   * stay lying about, in the other the shelf is gone and the horizon with it.
   * Anyone who really has removed everything clears up through "sign out".
   */
  if (seenKeys.size === 0 && present.length > 0) return 0

  const gone = present.filter((key) => !seenKeys.has(key) && !keep(key))
  if (gone.length === 0) return 0

  const tx = db.transaction(store, 'readwrite')
  for (const key of gone) await tx.store.delete(key)
  await tx.done
  return gone.length
}

/**
 * Walks the collection — as a delta, or all of it.
 *
 * The delta stops at the first record it already knows, which makes an
 * unchanged collection cost one request. It also means it can only ever see
 * **additions**: a rating changed on the Discogs website leaves `date_added`
 * untouched, so the walk turns around long before reaching it.
 *
 * And Discogs offers nothing to fix that with. A collection row carries
 * `id`, `instance_id`, `date_added`, `rating`, `folder_id` and
 * `basic_information` — no modification date, and the endpoint has no
 * "changed since" filter (measured 2026-08-12, docs/02). Reading the whole
 * list and comparing is not one way of noticing a changed rating; it is the
 * only one.
 *
 * So `full` exists, it costs one request per hundred records, and something
 * has to ask for it: the keeper once a day, or somebody pressing refresh.
 */
export async function syncCollection(
  context: SyncContext,
  { full = false }: { full?: boolean } = {},
): Promise<SyncSummary> {
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
    knownSince: full ? null : (syncState?.lastCollectionAdd ?? null),
    key: (item) => item.instanceId,
  })

  /*
   * Taking sold records out of the mirror — only after a full pass.
   *
   * Negative keys survive: those are records put on the shelf from a find and
   * waiting for Discogs to confirm them (`instanceId: -releaseId`, see above).
   * Discogs does not know them yet, so their absence from the answer would be
   * evidence of nothing — clearing them away here would take back an entry
   * somebody has just made.
   */
  result.removed = result.seen ? await sweep('collection', result.seen, (key) => key <= 0) : 0

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
  /*
   * Since M19 #3 the number is also kept, one row a day, so a line can be
   * drawn through it — and a line that only moves when the shelf does is not
   * a line about the market. So once a day the estimate is fetched even from
   * a walk that stored nothing: one request more per day, against the
   * half-hourly keeper's forty-eight. The guarantee above still holds for
   * every walk but one.
   */
  const lastTried = (await getMeta('syncState'))?.valueTriedAt ?? 0
  const valueStale = Date.now() - lastTried > VALUE_EVERY_MS

  if (result.stored > 0 || valueStale) {
    const [{ refreshCollectionValue }, { refreshFolders }] = await Promise.all([
      import('../collection/value'),
      import('../collection/folders'),
    ])
    // The attempt is what is rationed: an endpoint that refuses would
    // otherwise be asked again on every walk.
    await updateSyncState({ valueTriedAt: Date.now() })
    await refreshCollectionValue(context.client, context.username, Date.now())
    // Folder names change about as often as somebody reorganises a shelf, so
    // they ride the same rare walk rather than a clock of their own.
    if (result.stored > 0) await refreshFolders(context.client, context.username)
  }

  await updateSyncState({
    collectionSyncedAt: Date.now(),
    // Only a full walk can claim to have seen everything, so only a full walk
    // moves this. It is what the daily clock and the refresh button read.
    ...(full ? { collectionReadFullyAt: Date.now() } : {}),
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
    key: (item) => item.releaseId,
  })

  /*
   * And what is no longer on the wantlist is no longer here either.
   *
   * The wantlist is always read in full anyway — so the removal was visible
   * all along and simply never carried out. Measured 2026-09-11: 26 locally,
   * 24 at Discogs.
   */
  result.removed = result.seen ? await sweep('wantlist', result.seen) : 0

  await updateSyncState({ wantlistSyncedAt: Date.now() })
  return result
}

/**
 * The trade-off worth naming: a delta sees additions, not removals. A record
 * deleted from the collection stays in the mirror until a full resync, which
 * is what signing out and back in does.
 */
export async function syncLibrary(
  context: SyncContext,
  options: { full?: boolean } = {},
): Promise<SyncResult> {
  return {
    collection: await syncCollection(context, options),
    wantlist: await syncWantlist(context),
  }
}
