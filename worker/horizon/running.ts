import type { HorizonProgress } from '#shared/protocol'

/**
 * Which horizon job this worker is running, and how far it has got.
 *
 * The same problem the scanner solved in `worker/dig/scan.ts`, one screen
 * later. A build is minutes of requests and it lives in the worker, not in the
 * panel that started it — so leaving the settings screen does not stop it. But
 * until 2026-09-13 nothing could *see* it either: the panel kept its progress
 * in a `ref`, the `ref` went with the component, and coming back showed a
 * finished-looking screen with an enabled button over a run that was still
 * going. Reported by a tester as "the horizon build is aborted as soon as I
 * leave the tab, and I cannot see why" — nothing had been aborted.
 *
 * Worse than the missing bar: the enabled button. A second build started
 * beside the first sees every entity as unexpanded, because the first has not
 * written them yet, and expands all of them a second time. Two runs, one lane,
 * twice the requests.
 *
 * Module state and not a row in the database, for the reason `scan.ts` gives
 * about its own: a record saying "building" cannot tell a run that is in
 * flight this second from one that died with its tab. A freshly started worker
 * is by definition building nothing.
 */
export type HorizonJob = 'build' | 'revalidate' | 'gaps'

export interface RunningHorizon {
  job: HorizonJob
  /** Null until the first entity is through — the run has begun, not reported. */
  progress: HorizonProgress | null
}

let current: RunningHorizon | null = null

/** What this worker is expanding right now, for a screen that asks. */
export function runningHorizon(): RunningHorizon | null {
  return current
}

/** Remembered as it goes past, so `runningHorizon()` can say how far. */
export function noteHorizonProgress(progress: HorizonProgress): void {
  if (current) current.progress = progress
}

/**
 * Marks a run as running for as long as it runs.
 *
 * The previous record is restored rather than cleared: `horizon.fillGaps` runs
 * straight after a dig and could in principle be nested inside another job,
 * and a plain `current = null` would then report "nothing running" over a
 * build that is still going.
 */
export async function whileRunningHorizon<T>(
  job: HorizonJob,
  run: () => Promise<T>,
): Promise<T> {
  const outer = current
  current = { job, progress: null }
  try {
    return await run()
  } finally {
    current = outer
  }
}
