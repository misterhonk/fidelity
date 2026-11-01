import { onScopeDispose, watch } from 'vue'

/**
 * Keeps the screen on while `wanted()` holds (#198).
 *
 * Flipping crates with the phone in one hand, or waiting on a dig, the screen
 * should not go dark. The browser drops the lock by itself whenever the page
 * hides, so it is taken again when the page comes back — if still wanted.
 * Where the API is missing or refuses (low battery, no user gesture yet),
 * nothing happens: a dark screen is an annoyance, not an error.
 */
export function useWakeLock(wanted: () => boolean) {
  let sentinel: WakeLockSentinel | null = null
  let disposed = false

  async function sync() {
    const want = !disposed && wanted() && document.visibilityState === 'visible'
    if (!want) {
      const held = sentinel
      sentinel = null
      await held?.release().catch(() => {})
      return
    }
    if (sentinel && !sentinel.released) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    try {
      const got = await navigator.wakeLock.request('screen')
      // Wanted no more while the request was out.
      if (disposed || !wanted()) await got.release()
      else sentinel = got
    } catch {
      // Refused: the screen sleeps as it always did.
    }
  }

  const onVisibility = () => void sync()
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', onVisibility)
  watch(wanted, () => void sync(), { immediate: true })
  onScopeDispose(() => {
    disposed = true
    document.removeEventListener('visibilitychange', onVisibility)
    void sync()
  })
}
