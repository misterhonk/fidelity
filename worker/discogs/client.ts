import type { z } from 'zod'

import { DiscogsError, toDiscogsError } from './errors'
import { createPacer, type Pacer } from './pacer'

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

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class DiscogsClient {
  readonly #options: Required<Omit<DiscogsClientOptions, 'pacer'>> & { pacer: Pacer }

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
  async get<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const body = await this.#request(path, options)
    return schema.parse(body)
  }

  async #request(path: string, { query, signal }: RequestOptions): Promise<unknown> {
    const url = new URL(path, this.#options.baseUrl)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    let networkAttempt = 0

    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await this.#options.pacer.run(() => this.#send(url, signal), signal)
      } catch (error) {
        const opaque = error instanceof DiscogsError && error.status === 0 && !signal?.aborted
        if (!opaque) throw error

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

  async #send(url: URL, signal?: AbortSignal): Promise<Response> {
    const token = await this.#options.getToken()
    const send = this.#options.fetchImpl

    try {
      return await send(url, {
        signal,
        headers: {
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
        'Discogs antwortet nicht – keine Verbindung oder Limit erreicht.',
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
