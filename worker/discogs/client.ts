import type { z } from 'zod'

import { DiscogsError, toDiscogsError } from './errors'
import { createPacer, type Pacer } from './pacer'
import { note } from './ledger'

export const DISCOGS_API = 'https://api.discogs.com'

/**
 * Discogs sends no Retry-After with a 429, so the schedule is ours. Long on
 * purpose: the limit is a sliding 60-second window, and retrying inside it
 * only spends the budget we are waiting to get back.
 */
export const BACKOFF_MS = [60_000, 120_000, 240_000]

/**
 * A dropped connection is a different animal from a rate limit and deserves a
 * different answer: short, and soon. The horizon spends hundreds of requests
 * over many minutes, and letting one blip end the run would be absurd — the
 * work is resumable, but it should not need resuming for a hiccup.
 */
export const NETWORK_RETRY_MS = [2_000, 5_000]

export interface DiscogsClientOptions {
  /** Read per request so that signing out takes effect immediately. */
  getToken: () => Promise<string | null> | string | null
  fetchImpl?: typeof fetch
  pacer?: Pacer
  sleep?: (ms: number) => Promise<void>
  /** Injected in tests; production jitter comes from Math.random. */
  jitter?: () => number
  /**
   * Whether the browser believes it has a connection. Only ever used to tell
   * two indistinguishable failures apart — see the opaque-failure branch in
   * `#request`. `navigator.onLine` is a weak signal (it says "a network
   * exists", not "Discogs is reachable"), which is exactly the weight it
   * carries here: it decides how long to wait, never whether to give up.
   */
  isOnline?: () => boolean
  baseUrl?: string
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

export type WriteMethod = 'POST' | 'PUT' | 'DELETE'

export interface WriteOptions extends RequestOptions {
  /** Sent as JSON. Left out entirely when absent — not as `null`. */
  body?: unknown
  /**
   * Whether sending this twice is the same as sending it once.
   *
   * The single most consequential flag in this file, because of how a failure
   * looks from a browser. Discogs' 429 arrives through Cloudflare without a
   * CORS header, and so does a 404 on some paths (both measured, docs/02) —
   * either way `fetch()` rejects with nothing to read. "It worked and the
   * answer never came back" and "it never arrived" are the same event here.
   *
   * Setting a rating, writing a field value, deleting an entry: sending those
   * again changes nothing, so they may be retried. Adding a record to the
   * collection files a *new* entry every time — retrying that quietly puts
   * the same record in the shelf twice, and nobody would connect the
   * duplicate to a network blip weeks earlier. Those must be looked up
   * instead: `GET /users/{u}/collection/releases/{r}` says whether it landed.
   */
  idempotent: boolean
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** One GET in the air, and everybody waiting on it. */
interface Flight {
  body: Promise<unknown>
  waiters: number
  control: AbortController
}

/**
 * Waits on a shared request without handing it your own abort.
 *
 * A caller that gives up drops out; the request itself only stops when the
 * last of them has. That is the difference between "I no longer need this"
 * and "nobody needs this", and conflating the two would let one closing sheet
 * cancel the answer another part of the screen is still waiting for.
 */
async function join(flight: Flight, signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted()
  flight.waiters += 1
  try {
    if (!signal) return await flight.body
    return await new Promise<unknown>((resolve, reject) => {
      const leave = () => reject(signal.reason)
      signal.addEventListener('abort', leave, { once: true })
      flight.body
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', leave))
    })
  } finally {
    flight.waiters -= 1
    if (flight.waiters === 0) flight.control.abort()
  }
}

export class DiscogsClient {
  readonly #options: Required<Omit<DiscogsClientOptions, 'pacer'>> & { pacer: Pacer }

  /** GETs in the air, by the address they asked for. Empty between requests. */
  readonly #flights = new Map<string, Flight>()

  constructor(options: DiscogsClientOptions) {
    this.#options = {
      // Bound to the global scope on purpose. `fetch` refuses to run with a
      // foreign `this` ("Illegal invocation"), and holding it as a property
      // would supply exactly that — a failure that looks like being offline.
      fetchImpl: globalThis.fetch.bind(globalThis),
      pacer: options.pacer ?? createPacer(),
      sleep: defaultSleep,
      jitter: Math.random,
      isOnline: () => globalThis.navigator?.onLine ?? true,
      baseUrl: DISCOGS_API,
      ...options,
    }
  }

  /**
   * One GET, validated at the boundary. Every Discogs response crosses a Zod
   * schema here and nowhere else — past this point the data is ours and typed.
   */
  /**
   * One answer per address, however many people are asking.
   *
   * Two parts of the screen wanting the same record at the same moment is not
   * hypothetical: the cover pass walks `/releases/{id}` for what is visible
   * (worker/covers.ts), and tapping the card whose picture has not arrived yet
   * asks for exactly the release that is already in the queue. The stored copy
   * does not help — nothing is stored until the first answer comes back — so
   * that was two requests for one body, which is 2,4 s of a sixty-a-minute
   * budget spent on a duplicate.
   *
   * This is **coalescing and not caching**: the second caller joins a request
   * that is still in the air. Nothing is ever served from a finished one, so
   * the six-hour rule (rule 4) is untouched — there is no age to speak of.
   *
   * The body is shared, the parsing is not: two callers may hold the same
   * address to different schemas, and each gets its own parsed shape.
   */
  async get<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const key = this.#addressOf(path, options.query).toString()
    const running = this.#flights.get(key)
    if (running) return schema.parse(await join(running, options.signal))

    /*
     * The shared request gets a signal of its own, because the callers' are
     * theirs: whoever leaves first must not take the answer away from whoever
     * stayed. It is aborted when the last of them has gone, which is what a
     * single caller aborting used to do and still does.
     */
    const control = new AbortController()
    const flight: Flight = { waiters: 0, control, body: null as unknown as Promise<unknown> }
    flight.body = this.#request(path, {
      ...options,
      signal: control.signal,
      idempotent: true,
    }).finally(() => {
      if (this.#flights.get(key) === flight) this.#flights.delete(key)
    })
    // Nobody is listening to this copy; the waiters below have their own.
    flight.body.catch(() => {})
    this.#flights.set(key, flight)

    return schema.parse(await join(flight, options.signal))
  }

  /**
   * One write, through the same single slot as every read.
   *
   * A write is not cheaper than a read and Discogs counts it the same way, so
   * it queues behind the same pacer and the same cross-tab lock (rule 3).
   * Answers are usually empty — a rating comes back 204 — so the body is
   * `null` more often than not, and a schema is optional rather than assumed.
   */
  async write(method: WriteMethod, path: string, options: WriteOptions): Promise<unknown> {
    return this.#request(path, options, method)
  }

  /** The address a path and a query add up to — and the key a flight is filed under. */
  #addressOf(path: string, query: RequestOptions['query']): URL {
    const url = new URL(path, this.#options.baseUrl)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    return url
  }

  async #request(
    path: string,
    { query, signal, body: payload, idempotent }: WriteOptions,
    method: WriteMethod | 'GET' = 'GET',
  ): Promise<unknown> {
    const url = this.#addressOf(path, query)

    let networkAttempt = 0

    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await this.#options.pacer.run(() => {
          /*
           * Counted here and nowhere else: this is the one line every
           * request in the app passes through, and the only place that
           * knows a slot was actually taken (M31.9).
           */
          note(path)
          return this.#send(url, { signal, method, payload })
        }, signal)
      } catch (error) {
        const opaque = error instanceof DiscogsError && error.status === 0 && !signal?.aborted
        if (!opaque) throw error

        // See WriteOptions.idempotent: repeating this one could do the work
        // twice, and from here there is no way to tell whether it already
        // happened. The caller has to go and look.
        if (!idempotent) throw error

        // A blip deserves a quick second try.
        if (networkAttempt < NETWORK_RETRY_MS.length) {
          await this.#options.sleep(NETWORK_RETRY_MS[networkAttempt]!)
          networkAttempt += 1
          attempt -= 1
          continue
        }

        /*
         * Still failing while the browser says it is online. In a browser the
         * likeliest cause by far is a 429: Cloudflare serves the rate-limit
         * response without `access-control-allow-origin`, so it never becomes
         * a Response at all — `fetch()` rejects and the status below is
         * unreachable (measured 2026-08-10, docs/02 §Rate-Limit).
         *
         * So this waits out the window rather than ending the run. A horizon
         * expansion is hundreds of requests over many minutes; giving up on
         * the one that happened to land on the limit would throw all of it
         * away for something that clears in under a minute.
         */
        if (this.#options.isOnline() && attempt < BACKOFF_MS.length) {
          const base = BACKOFF_MS[attempt]!
          await this.#options.sleep(base + this.#options.jitter() * 0.25 * base)
          continue
        }

        throw error
      }

      if (response.status === 429 && attempt < BACKOFF_MS.length) {
        // Jitter so that two tabs of the same user do not resynchronise on
        // every retry and hammer the same second.
        const base = BACKOFF_MS[attempt]!
        await this.#options.sleep(base + this.#options.jitter() * 0.25 * base)
        continue
      }

      const parsed = await readBody(response)
      if (!response.ok) throw toDiscogsError(response.status, parsed)
      return parsed
    }
  }

  async #send(
    url: URL,
    { signal, method, payload }: { signal?: AbortSignal; method: string; payload?: unknown },
  ): Promise<Response> {
    const token = await this.#options.getToken()
    const send = this.#options.fetchImpl

    try {
      return await send(url, {
        signal,
        method,
        // A JSON content type is what makes the browser ask permission first.
        // Discogs answers that preflight (measured 2026-08-11, docs/02) —
        // which is the only reason writing from a client app is possible.
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        headers: {
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
          Accept: 'application/json',
          // Header, never the query string. Passing credentials as query
          // parameters historically got you 25 requests a minute instead of 60.
          // There is no User-Agent here: fetch() forbids setting it, and
          // Discogs accepts the browser's own (verified 2026-08-09).
          ...(token ? { Authorization: `Discogs token=${token}` } : {}),
        },
      })
    } catch (error) {
      if (signal?.aborted) throw error
      /*
       * An opaque failure. It is not only "offline": Discogs' 429 comes back
       * through Cloudflare without a CORS header, so a rate limit reaches the
       * browser as exactly this — a rejected fetch with no status to read.
       * Being reached and being throttled are indistinguishable here, and the
       * message says both rather than picking the wrong one.
       */
      throw new DiscogsError(
        0,
        'Discogs is not answering – no connection, or the limit is reached.',
        [error instanceof Error ? error.message : String(error)],
      )
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.length === 0) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    // Discogs occasionally answers HTML from an edge layer.
    return { message: text.slice(0, 200) }
  }
}
