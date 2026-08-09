import type { Dealer, WatchAlert } from '#shared/types'

/**
 * The watchlist, checked when the app opens.
 *
 * There is no nightly job because there is no night: a browser does not run
 * while it is closed (docs/06 M6, and ADR-007 for why there is no server to
 * run one). So the check happens on the first screen somebody sees, costs one
 * request per watched shop, and is skipped entirely for shops looked at within
 * the last six hours.
 */
const watched = shallowRef<Dealer[]>([])
const alerts = shallowRef<WatchAlert[]>([])
let checked = false

/**
 * The badge, where the browser has one.
 *
 * Purely additive: Safari on iOS only shows it for an installed PWA and Firefox
 * has none at all, so a failure here is not worth a line of error handling.
 */
function setBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (count > 0) void nav.setAppBadge?.(count).catch(() => {})
  else void nav.clearAppBadge?.().catch(() => {})
}

export function useWatchlist() {
  const { call } = useFidelityWorker()

  async function load() {
    watched.value = await call('watch.list', undefined)
  }

  /**
   * Runs once per app load. Deliberately not awaited by whoever starts it: a
   * watched shop that is slow to answer must not hold up the first paint.
   */
  async function checkOnce() {
    if (checked) return
    checked = true

    await load()
    if (watched.value.length === 0) return

    try {
      const result = await call('watch.check', {})
      alerts.value = result.alerts
      setBadge(result.alerts.length)
      if (result.checked > 0) await load()
    } catch {
      // A shop that will not answer is not worth an error message on the
      // dashboard. The next start tries again.
    }
  }

  async function recheck() {
    const result = await call('watch.check', { force: true })
    alerts.value = result.alerts
    setBadge(result.alerts.length)
    await load()
    return result
  }

  async function toggle(dealer: string) {
    const watching = !watched.value.some((entry) => entry.username === dealer)
    watched.value = await call('watch.set', { dealer, watching })
  }

  function dismiss() {
    alerts.value = []
    setBadge(0)
  }

  return {
    watched: readonly(watched),
    alerts: readonly(alerts),
    isWatched: (dealer: string) => watched.value.some((entry) => entry.username === dealer),
    load,
    checkOnce,
    recheck,
    toggle,
    dismiss,
  }
}
