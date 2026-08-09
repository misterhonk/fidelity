import { getSyncState } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { DbStats, ParamsOf, RequestKind, ResultOf } from '#shared/protocol'

import { currentIdentity, discogs, requestPersistence, signIn, signOut } from './auth'
import { syncLibrary } from './sync/library'

/**
 * A handler gets its params and a way to report progress, and returns the
 * result. Cancellation arrives as an AbortSignal — the scan in M2 checks it
 * between pages, which is the only place a four-minute run can be interrupted
 * without leaving the cursor inconsistent.
 */
export type Handler<K extends RequestKind> = (
  params: ParamsOf<K>,
  ctx: { report: (progress: unknown) => void; signal: AbortSignal },
) => Promise<ResultOf<K>>

export type HandlerMap = { [K in RequestKind]: Handler<K> }

const STORES = [
  'meta',
  'collection',
  'wantlist',
  'horizon',
  'dealers',
  'digs',
  'matches',
  'basket',
  'feedback',
] as const

async function dbStats(): Promise<DbStats> {
  const db = await openFidelityDb()

  const counts: Record<string, number> = {}
  for (const store of STORES) {
    counts[store] = await db.count(store)
  }

  // Not available in every browser, and Safari lies about the quota. Report
  // what we get and null out the rest rather than inventing a number.
  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  let persisted = false
  if (typeof navigator !== 'undefined' && navigator.storage) {
    const estimate = await navigator.storage.estimate?.()
    usageBytes = estimate?.usage ?? null
    quotaBytes = estimate?.quota ?? null
    persisted = (await navigator.storage.persisted?.()) ?? false
  }

  return { counts, usageBytes, quotaBytes, persisted }
}

export const handlers: HandlerMap = {
  ping: async ({ echo }) => ({ pong: true, echo }),
  'db.stats': dbStats,

  'auth.signIn': ({ token }) => signIn(token),
  'auth.identity': () => currentIdentity(),
  'auth.signOut': async () => {
    await signOut()
    return { signedOut: true as const }
  },

  'library.sync': async (_params, { report, signal }) => {
    const identity = await currentIdentity()
    if (!identity) throw new Error('Nicht angemeldet.')

    await requestPersistence()
    return syncLibrary({
      client: discogs(),
      username: identity.username,
      report: (progress) => report(progress),
      signal,
    })
  },

  'library.summary': async () => {
    const db = await openFidelityDb()
    const syncState = await getSyncState()
    return {
      collection: await db.count('collection'),
      wantlist: await db.count('wantlist'),
      collectionSyncedAt: syncState.collectionSyncedAt,
      wantlistSyncedAt: syncState.wantlistSyncedAt,
    }
  },
}
