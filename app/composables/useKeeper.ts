import type { KeeperJob, KeeperResult } from '~~/worker/keeper'

/**
 * The rhythm in which the app checks up on itself.
 *
 * There is no server, so "in the background" means "while a tab is open" and
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

/**
 * What is being worked on — `null` when nothing is running.
 *
 * Shared too, and for the same reason as `last`: the line lives in the layout,
 * and two screens must not contradict each other.
 */
const busy = shallowRef<KeeperJob | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
let started = false

export function useKeeper() {
  const { call } = useFidelityWorker()

  async function tick(options: { force?: boolean; eager?: boolean } = {}) {
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
      last.value = await call(
        'keeper.tick',
        { force: options.force, eager: options.eager },
        { onProgress: (update) => (busy.value = update.job) },
      )
    } catch {
      /*
       * Silent by design. This is the one thing in the app nobody asked for,
       * so it is the one thing that must never produce an error message —
       * offline, rate-limited, token expired: the next tick tries again, and
       * everything somebody *does* ask for still reports its own failures.
       */
    } finally {
      /*
       * And the line goes away in every case.
       *
       * Precisely because the keeper stays quiet about failures: an "updating
       * …" left standing after one would be the worst way to stay quiet — it
       * would claim work that is no longer happening.
       */
      busy.value = null
    }
  }

  /**
   * Runs from the first screen on, not from the start page.
   *
   * Mounted from the layout, so it also covers somebody who opens a bookmark
   * straight to /basket — which is exactly the person whose collection is a week
   * out of date.
   */
  function start() {
    if (started) return
    started = true

    // Arriving counts as coming back: whatever this device last knew, it was
    // at best from the previous visit.
    void tick({ eager: true })
    timer = setInterval(() => void tick(), EVERY_MS)

    /*
     * Coming back to the tab is the moment worth checking: it is usually where
     * the gap between "what Discogs knows" and "what this device knows"
     * opened — a record added on the phone, a rating given on the website.
     *
     * `eager` shortens the collection's staleness window to two minutes for
     * this one tick. The delta costs one request when nothing changed, and
     * making somebody wait half an hour to see their own record is a poor
     * trade for one request against a budget of sixty a minute.
     */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void tick({ eager: true })
    })
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    started = false
  }

  return { last, busy, tick, start, stop }
}
