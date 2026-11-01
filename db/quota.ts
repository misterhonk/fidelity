/**
 * A full disk, survived by giving up the covers first.
 *
 * Chrome books every opaque cover at about seven megabytes of quota
 * (app/sw/sw.ts), so the cover cache is nearly always what filled the origin.
 * It is also the one thing here that costs nothing to lose: the next showing
 * asks i.discogs.com again. A rating waiting in the outbox does not come back.
 */
export const COVER_CACHE = 'fidelity-covers'

/**
 * Runs a write; on a quota error, drops the cover cache and runs it once more.
 * Safe to repeat because a transaction that hit the quota aborted whole —
 * nothing of the first attempt was written. With no covers to drop, a second
 * attempt would only fail the same way, so the error goes up at once.
 */
export async function retryAfterPurge<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    if (
      (error as { name?: unknown } | null)?.name !== 'QuotaExceededError' ||
      typeof caches === 'undefined' ||
      !(await caches.delete(COVER_CACHE).catch(() => false))
    )
      throw error
    return write()
  }
}

/** The database handle, with every `put` and `add` shortcut retried that way. */
export function withQuotaRetry<T extends object>(db: T): T {
  return new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop)
      if (typeof value !== 'function') return value
      // idb unwraps `this` to find the native handle, so it must stay the original.
      const bound = (value as (...args: unknown[]) => unknown).bind(target)
      return prop === 'put' || prop === 'add'
        ? (...args: unknown[]) => retryAfterPurge(async () => bound(...args))
        : bound
    },
  })
}
