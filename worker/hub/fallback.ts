/**
 * The fallback chain every hub call goes through.
 *
 * A hub is optional infrastructure somebody runs on a Raspberry Pi. It will be
 * slow, unreachable or switched off, and none of that may be visible to the
 * user: a broken hub must never block the app. So every hub call is optimistic,
 * bounded and fails silently.
 *
 * Two seconds, no retry. A slow hub is worse than no hub.
 */
export const HUB_TIMEOUT_MS = 2000

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms} ms`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export interface PreferHubOptions<T> {
  /** Asked first. Pass null when no hub is configured — the normal case. */
  hub?: (() => Promise<T | null>) | null
  timeoutMs?: number
  /**
   * Offered the locally produced value, fire-and-forget. A rejection here is
   * swallowed: contributing is a courtesy, not part of the request.
   */
  contribute?: ((value: T) => Promise<void> | void) | null
}

/**
 * Asks the hub, falls back to the local path, and offers the local result back
 * to the hub. Returns whatever the local path returns if the hub is absent,
 * slow, broken, or simply does not have the answer.
 */
export async function preferHub<T>(
  local: () => Promise<T>,
  { hub, timeoutMs = HUB_TIMEOUT_MS, contribute }: PreferHubOptions<T> = {},
): Promise<T> {
  if (hub) {
    try {
      const hit = await withTimeout(hub(), timeoutMs)
      if (hit !== null && hit !== undefined) return hit
    } catch {
      // Deliberately silent. The local path is not a degraded mode, it is the
      // normal one — most users will never configure a hub at all.
    }
  }

  const fresh = await local()

  if (contribute) {
    void (async () => {
      try {
        await contribute(fresh)
      } catch {
        // Same reasoning: a hub that refuses a contribution changes nothing.
      }
    })()
  }

  return fresh
}
