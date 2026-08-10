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

/**
 * Und ohne Token: 25 statt 60 pro Minute.
 *
 * Measured 2026-08-10 — every endpoint the app reads answers unauthenticated
 * with `x-discogs-ratelimit: 25`. The demo runs without a token by design, so
 * the pacing that is comfortable with one (50/min) would put it over the limit
 * on its own. 2.400 ms is 25/min exactly; the gap to the limit is the same
 * proportion as the authenticated case.
 */
export const ANONYMOUS_REQUEST_INTERVAL_MS = 2400

/**
 * The name of the lock that makes the gap hold across tabs.
 *
 * The chain below serialises one worker. The limit is per **IP**, so two open
 * tabs are two chains pacing themselves perfectly and hitting Discogs twice as
 * often as either believes — 100 requests a minute against a limit of 60. That
 * is not a hypothesis: it is what the 429s in the console were.
 *
 * A Web Lock is the smallest thing that fixes it. Held from the moment a slot
 * is claimed until the gap has passed, so at most one tab holds the floor at a
 * time and the *next* tab starts its wait when this one is finished. Available
 * in workers everywhere the app runs, iOS Safari included.
 */
export const PACER_LOCK = 'fidelity:discogs'

export interface PacerOptions {
  /**
   * The gap, or a function returning it.
   *
   * A function because the answer changes with the request: a signed-in dig
   * may go at 1.200 ms and the token-less demo may not. Read per slot rather
   * than fixed at construction, so one client serves both.
   */
  minIntervalMs?: number | (() => number)
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  /**
   * Runs a slot exclusively across every tab of this origin. Defaults to the
   * Web Locks API, and to running the slot directly where there is none —
   * a single tab paces itself correctly either way.
   */
  exclusively?: <T>(run: () => Promise<T>) => Promise<T>
  /**
   * When the last request went out, shared with the other tabs.
   *
   * In memory by default, which is one tab's view and exactly what this used
   * to be. Production passes a store every tab can see, so the gap is one gap
   * rather than one per tab.
   */
  slotClock?: SlotClock
}

export interface SlotClock {
  read(): Promise<number> | number
  write(startedAt: number): Promise<void> | void
}

export interface Pacer {
  /** Queues a task. Resolves with its result once its turn has come. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>
  /** Requests still waiting for their slot. */
  readonly queued: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The slot, held against every other tab of this origin.
 *
 * Falls through to running it directly where the API is missing — an old
 * browser then paces itself exactly as before, which is the behaviour this
 * replaces rather than a degraded one.
 */
function webLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks
  if (!locks) return run()
  return locks.request(PACER_LOCK, run) as Promise<T>
}

/** One tab's view of when it last sent something. */
function memoryClock(): SlotClock {
  let startedAt = Number.NEGATIVE_INFINITY
  return {
    read: () => startedAt,
    write: (value) => {
      startedAt = value
    },
  }
}

export function createPacer({
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  now = Date.now,
  sleep = defaultSleep,
  exclusively = webLock,
  slotClock = memoryClock(),
}: PacerOptions = {}): Pacer {
  const interval = () => (typeof minIntervalMs === 'function' ? minIntervalMs() : minIntervalMs)
  // Serialisation is the promise chain itself: every task links onto the
  // previous one, so a second caller physically cannot overtake the first.
  let chain: Promise<unknown> = Promise.resolve()
  let queued = 0

  async function execute<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    /*
     * Claiming the slot and sending it happen under the same lock, so at any
     * moment exactly one tab is doing either. Waiting stays lazy — a caller
     * who was already slow pays nothing — because the last start is read from
     * a clock every tab shares rather than from this one's memory.
     */
    return exclusively(async () => {
      const waitFor = (await slotClock.read()) + interval() - now()
      if (waitFor > 0) await sleep(waitFor)

      // Checked after the wait, not before: a dig cancelled while this request
      // sat in the queue must not still hit the network.
      signal?.throwIfAborted()

      await slotClock.write(now())
      return task()
    })
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
