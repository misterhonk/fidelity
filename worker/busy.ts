/**
 * Ob gerade etwas läuft, das jemand angestoßen hat.
 *
 * The pacer is one lane and it is first-come-first-served (CLAUDE.md rule 3):
 * exactly one Discogs request in flight, 1.200 ms apart, across every tab. So
 * anything the app decides to do on its own can end up sitting in front of the
 * thing somebody just clicked — a housekeeping job that queued forty requests
 * would turn the next dig into a four-minute wait with no explanation.
 *
 * The keeper asks here before every job it starts and between jobs. It never
 * interrupts anything; it simply declines to begin.
 *
 * A counter and not a boolean, because two screens can be waiting on the worker
 * at once — the start page asks for its overview while the watchlist checks —
 * and a boolean would be cleared by whichever finished first.
 */
let running = 0

/** Every dispatch except the keeper's own runs inside this. */
export function trackForeground<T>(task: () => Promise<T>): Promise<T> {
  running += 1
  return task().finally(() => {
    running -= 1
  })
}

export function isForegroundBusy(): boolean {
  return running > 0
}
