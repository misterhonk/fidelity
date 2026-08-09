/**
 * Request pacing for Discogs. This is CLAUDE.md rule 3 as code, and it is the
 * single most important invariant in the project.
 *
 * Exactly one request in flight, a fixed gap between them. Concurrency buys
 * nothing here — the limit is 60 requests per minute per source IP, so it is
 * time-based, not parallelism-based, and firing two at once only produces 429s
 * sooner.
 *
 * The gap is fixed rather than adaptive because it has to be:
 * `x-discogs-ratelimit-*` is missing from `access-control-expose-headers`, so
 * JavaScript cannot read the remaining budget at all. We drive blind at
 * 1200 ms — 50 requests per minute, ten under the limit.
 */
export const MIN_REQUEST_INTERVAL_MS = 1200

export interface PacerOptions {
  minIntervalMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface Pacer {
  /** Queues a task. Resolves with its result once its turn has come. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>
  /** Requests still waiting for their slot. */
  readonly queued: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createPacer({
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  now = Date.now,
  sleep = defaultSleep,
}: PacerOptions = {}): Pacer {
  // Serialisation is the promise chain itself: every task links onto the
  // previous one, so a second caller physically cannot overtake the first.
  let chain: Promise<unknown> = Promise.resolve()
  let lastStartedAt = Number.NEGATIVE_INFINITY
  let queued = 0

  async function execute<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const waitFor = lastStartedAt + minIntervalMs - now()
    if (waitFor > 0) await sleep(waitFor)

    // Checked after the wait, not before: a dig cancelled while this request
    // sat in the queue must not still hit the network.
    signal?.throwIfAborted()

    lastStartedAt = now()
    return task()
  }

  return {
    get queued() {
      return queued
    },

    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      queued += 1
      // The chain must survive a failing task, otherwise one error would wedge
      // every later request behind a rejected promise.
      const result = chain.then(
        () => execute(task, signal),
        () => execute(task, signal),
      )
      chain = result.then(
        () => undefined,
        () => undefined,
      )
      return result.finally(() => {
        queued -= 1
      })
    },
  }
}
