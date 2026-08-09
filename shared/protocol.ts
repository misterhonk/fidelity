/**
 * The main ↔ worker contract.
 *
 * Everything except rendering runs in the worker, so this is the only seam
 * between the UI and the actual work. It is a request/response protocol with
 * an open-ended progress channel in between: a dig runs for four minutes and
 * has to report while it runs, not only when it finishes.
 *
 * All payloads must be structured-cloneable — plain objects, arrays and
 * TypedArrays. That is deliberate: the horizon crosses this boundary as
 * Int32Array, and copying it as JSON would cost an order of magnitude.
 *
 * The Personal Access Token crosses it exactly once, on sign-in. It never
 * comes back the other way (CLAUDE.md rule 6).
 */
import type { Identity, TasteProfile } from './types'

export interface PingResult {
  pong: true
  /** Round-trip marker so the caller can prove the worker is really alive. */
  echo: string
}

export interface DbStats {
  counts: Record<string, number>
  /** From navigator.storage.estimate(); null where the browser withholds it. */
  usageBytes: number | null
  quotaBytes: number | null
  /** Whether the browser promised not to evict us after seven idle days. */
  persisted: boolean
}

/**
 * One entry per operation the worker can perform. `progress` is `never` for
 * operations that finish in one step; the scan in M2 will carry a real
 * progress type here.
 */
export interface WorkerContract {
  ping: { params: { echo: string }; progress: never; result: PingResult }
  'db.stats': { params: undefined; progress: never; result: DbStats }

  /** Validates the token against /oauth/identity and only then stores it. */
  'auth.signIn': { params: { token: string }; progress: never; result: Identity }
  'auth.identity': { params: undefined; progress: never; result: Identity | null }
  /** Deletes the whole database, not just the token. */
  'auth.signOut': { params: undefined; progress: never; result: { signedOut: true } }

  /**
   * Mirrors collection and wantlist. Reports per page, because the first run
   * takes ~25 requests and a spinner for half a minute is not an answer.
   */
  'library.sync': { params: undefined; progress: SyncProgress; result: SyncResult }
  'library.summary': { params: undefined; progress: never; result: LibrarySummary }
  /** Recomputed after every sync; null until there has been one. */
  'taste.profile': { params: undefined; progress: never; result: TasteProfile | null }
}

export interface SyncProgress {
  kind: 'collection' | 'wantlist'
  stored: number
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

export interface LibrarySummary {
  collection: number
  wantlist: number
  collectionSyncedAt: number | null
  wantlistSyncedAt: number | null
}

export type RequestKind = keyof WorkerContract
export type ParamsOf<K extends RequestKind> = WorkerContract[K]['params']
export type ProgressOf<K extends RequestKind> = WorkerContract[K]['progress']
export type ResultOf<K extends RequestKind> = WorkerContract[K]['result']

// --- main → worker ---------------------------------------------------------

export type WorkerRequest = {
  [K in RequestKind]: { id: string; kind: K; params: ParamsOf<K> }
}[RequestKind]

export interface CancelRequest {
  id: string
  kind: '$cancel'
}

export type WorkerInbound = WorkerRequest | CancelRequest

// --- worker → main ---------------------------------------------------------

export interface WorkerError {
  message: string
  /** Set when the failure is one the UI has to react to specifically. */
  code?: 'rate-limited' | 'unauthorized' | 'offline' | 'cancelled'
}

export type WorkerOutbound =
  | { id: string; type: 'progress'; progress: unknown }
  | { id: string; type: 'result'; result: unknown }
  | { id: string; type: 'error'; error: WorkerError }

export function isWorkerOutbound(value: unknown): value is WorkerOutbound {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Partial<WorkerOutbound>
  return (
    typeof message.id === 'string' &&
    (message.type === 'progress' || message.type === 'result' || message.type === 'error')
  )
}
