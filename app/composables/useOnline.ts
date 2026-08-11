/**
 * Whether the app can reach anything.
 *
 * `navigator.onLine` is famously optimistic — it says true for a laptop
 * connected to a router with no uplink, which is exactly the basement case
 * (docs/00 §8 phase 4: many record shops are basements with no signal). It is
 * still worth reading, because `false` is always right: no interface, no
 * network. The optimistic direction is corrected by the worker, which finds
 * out for real the moment somebody asks it for something.
 */
const online = ref(true)
const lastFailure = ref<number | null>(null)
let bound = false

export function useOnline() {
  if (!bound && typeof window !== 'undefined') {
    bound = true
    online.value = navigator.onLine
    window.addEventListener('online', () => {
      online.value = true
      lastFailure.value = null
    })
    window.addEventListener('offline', () => (online.value = false))
  }

  /**
   * Called by whatever just failed to reach Discogs. One failure is not proof
   * of being offline — a 429 is not a dead network — so this only records
   * that something went wrong recently, and the interface words it that way.
   */
  function noteFailure() {
    lastFailure.value = Date.now()
  }

  return {
    online: readonly(online),
    /** True when the browser says offline, or a request failed in the last minute. */
    struggling: computed(
      () =>
        !online.value ||
        (lastFailure.value !== null && Date.now() - lastFailure.value < 60_000),
    ),
    noteFailure,
  }
}
