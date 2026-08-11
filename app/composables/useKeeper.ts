import type { KeeperResult } from '~~/worker/keeper'

/**
 * Der Takt, in dem die App bei sich selbst nachsieht.
 *
 * There is no server, so "im Hintergrund" means "while a tab is open" and
 * nothing else. That is not a limitation worth working around: a Service
 * Worker with Periodic Background Sync could run without a tab, but it is
 * Chrome-only, needs the app installed, and would spend somebody's Discogs
 * budget while they are not looking. A tab that is open is a person who is
 * there.
 */

/** Once on arrival, then every twenty minutes. */
const EVERY_MS = 20 * 60 * 1000

/** Shared, because five screens mounting five tickers is five times the work. */
const last = shallowRef<KeeperResult | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
let started = false

export function useKeeper() {
  const { call } = useFidelityWorker()

  async function tick(options: { force?: boolean } = {}) {
    /*
     * A hidden tab does nothing. Its requests would come out of the same
     * per-IP budget as the tab somebody is actually looking at (rule 3), and
     * two windows left open overnight would spend a day's ration on nothing.
     */
    if (
      !options.force &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }

    try {
      last.value = await call('keeper.tick', { force: options.force })
    } catch {
      /*
       * Silent by design. This is the one thing in the app nobody asked for,
       * so it is the one thing that must never produce an error message —
       * offline, rate-limited, token expired: the next tick tries again, and
       * everything somebody *does* ask for still reports its own failures.
       */
    }
  }

  /**
   * Runs from the first screen on, not from the start page.
   *
   * Mounted from the layout, so it also covers somebody who opens a bookmark
   * straight to /korb — which is exactly the person whose collection is a week
   * out of date.
   */
  function start() {
    if (started) return
    started = true

    void tick()
    timer = setInterval(() => void tick(), EVERY_MS)

    // Coming back to the tab is the moment worth checking: it is usually where
    // the gap between "what Discogs knows" and "what this device knows" opened.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void tick()
    })
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    started = false
  }

  return { last, tick, start, stop }
}
