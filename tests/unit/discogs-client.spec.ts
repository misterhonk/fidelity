import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { BACKOFF_MS, DiscogsClient, NETWORK_RETRY_MS } from '~~/worker/discogs/client'
import { DiscogsError, toDiscogsError } from '~~/worker/discogs/errors'
import { createPacer, MIN_REQUEST_INTERVAL_MS } from '~~/worker/discogs/pacer'

/** A clock that only moves when something sleeps, so tests run instantly. */
function fakeClock() {
  let time = 0
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms
    },
    advance: (ms: number) => {
      time += ms
    },
    get time() {
      return time
    },
  }
}

describe('the pacer', () => {
  it('keeps 1200 ms between requests', async () => {
    const clock = fakeClock()
    const pacer = createPacer({ now: clock.now, sleep: clock.sleep })
    const startedAt: number[] = []
    const task = async () => {
      startedAt.push(clock.now())
    }

    await Promise.all([pacer.run(task), pacer.run(task), pacer.run(task)])

    expect(startedAt).toEqual([0, MIN_REQUEST_INTERVAL_MS, MIN_REQUEST_INTERVAL_MS * 2])
  })

  it('never lets two requests be in flight at once', async () => {
    const clock = fakeClock()
    const pacer = createPacer({ now: clock.now, sleep: clock.sleep })
    let inFlight = 0
    let peak = 0

    const task = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
    }

    await Promise.all(Array.from({ length: 5 }, () => pacer.run(task)))

    expect(peak).toBe(1)
  })

  it('does not wedge the queue when a request fails', async () => {
    const clock = fakeClock()
    const pacer = createPacer({ now: clock.now, sleep: clock.sleep })

    const failed = pacer.run(async () => {
      throw new Error('boom')
    })
    const after = pacer.run(async () => 'still works')

    await expect(failed).rejects.toThrow('boom')
    await expect(after).resolves.toBe('still works')
  })

  it('drops a queued request whose dig was cancelled meanwhile', async () => {
    const clock = fakeClock()
    const pacer = createPacer({ now: clock.now, sleep: clock.sleep })
    const controller = new AbortController()
    const task = vi.fn(async () => 'sent')

    const first = pacer.run(async () => 'first')
    const second = pacer.run(task, controller.signal)
    controller.abort()

    await expect(first).resolves.toBe('first')
    await expect(second).rejects.toThrow()
    expect(task).not.toHaveBeenCalled()
  })

  it('waits no longer than necessary when the caller was already slow', async () => {
    const clock = fakeClock()
    const pacer = createPacer({ now: clock.now, sleep: clock.sleep })

    await pacer.run(async () => undefined)
    clock.advance(5_000)
    await pacer.run(async () => undefined)

    expect(clock.time).toBe(5_000)
  })

  /*
   * Zwei Tabs, ein Limit.
   *
   * The limit is per IP and a tab is not. Two workers pacing themselves
   * perfectly still send twice as often as either believes — 100 requests a
   * minute against a limit of 60 — and the 429s that produced were invisible
   * (they arrive without a CORS header, so JavaScript sees a network error).
   *
   * The fix is a slot claimed under a Web Lock against a clock every tab
   * shares. Modelled here as two pacers over one clock and one lock, which is
   * exactly what two tabs of one browser are.
   */
  describe('across tabs', () => {
    function twoTabs() {
      const clock = fakeClock()

      let startedAt = Number.NEGATIVE_INFINITY
      const slotClock = {
        read: () => startedAt,
        write: (value: number) => {
          startedAt = value
        },
      }

      // One lock, held by whoever asked first — the promise chain is the
      // queue, which is what `navigator.locks` provides across real tabs.
      let held: Promise<unknown> = Promise.resolve()
      const exclusively = <T>(run: () => Promise<T>): Promise<T> => {
        const turn = held.then(run, run)
        held = turn.then(
          () => undefined,
          () => undefined,
        )
        return turn
      }

      const tab = () =>
        createPacer({ now: clock.now, sleep: clock.sleep, slotClock, exclusively })

      return { clock, first: tab(), second: tab() }
    }

    it('keeps the gap between requests from different tabs', async () => {
      const { clock, first, second } = twoTabs()
      const sentAt: number[] = []

      await Promise.all([
        first.run(async () => sentAt.push(clock.now())),
        second.run(async () => sentAt.push(clock.now())),
        first.run(async () => sentAt.push(clock.now())),
        second.run(async () => sentAt.push(clock.now())),
      ])

      expect(sentAt).toHaveLength(4)
      for (let i = 1; i < sentAt.length; i++) {
        expect(sentAt[i]! - sentAt[i - 1]!).toBeGreaterThanOrEqual(MIN_REQUEST_INTERVAL_MS)
      }
    })

    it('stays under the limit that a single tab stays under', async () => {
      const { clock, first, second } = twoTabs()

      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          (i % 2 === 0 ? first : second).run(async () => undefined),
        ),
      )

      // Twenty requests can take no less than nineteen gaps, whoever sent them.
      expect(clock.time).toBeGreaterThanOrEqual(19 * MIN_REQUEST_INTERVAL_MS)
    })
  })
})

describe('the two Discogs error shapes', () => {
  it('reads the legacy shape', () => {
    const error = toDiscogsError(400, { message: 'Invalid sort: expected one of …' })
    expect(error.message).toBe('Invalid sort: expected one of …')
    expect(error.details).toEqual([])
  })

  it('reads the migrated FastAPI shape', () => {
    const error = toDiscogsError(422, {
      message: 'Validation error',
      detail: [{ type: 'literal_error', loc: ['query', 'sort'], msg: 'unexpected value' }],
    })
    expect(error.message).toBe('Validation error')
    expect(error.details).toEqual(['query.sort: unexpected value'])
  })

  it('falls back to the detail when there is no message', () => {
    const error = toDiscogsError(422, { detail: [{ loc: ['page'], msg: 'too large' }] })
    expect(error.message).toBe('page: too large')
  })

  it('still produces something usable for an unparseable body', () => {
    expect(toDiscogsError(502, 'nope').message).toContain('502')
    expect(toDiscogsError(500, null).message).toContain('500')
  })

  it('maps the statuses the UI has to react to', () => {
    expect(toDiscogsError(429, {}).code).toBe('rate-limited')
    expect(toDiscogsError(401, {}).code).toBe('unauthorized')
    expect(toDiscogsError(403, {}).code).toBe('unauthorized')
    expect(toDiscogsError(404, {}).code).toBeUndefined()
  })
})

describe('the Discogs client', () => {
  const identity = z.object({ id: z.number(), username: z.string() })

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  function makeClient(
    responses: Response[],
    { token = 'a-pat' }: { token?: string | null } = {},
  ) {
    const clock = fakeClock()
    const fetchImpl = vi.fn(async () => responses.shift() ?? jsonResponse({}, 500))
    const client = new DiscogsClient({
      getToken: () => token,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pacer: createPacer({ now: clock.now, sleep: clock.sleep }),
      sleep: clock.sleep,
      jitter: () => 0,
    })
    return { client, fetchImpl, clock }
  }

  it('sends the token as a header, never in the query string', async () => {
    const { client, fetchImpl } = makeClient([jsonResponse({ id: 1, username: 'martin' })])

    await client.get('/oauth/identity', identity)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.search).not.toContain('token')
    expect((init.headers as Record<string, string>).Authorization).toBe('Discogs token=a-pat')
  })

  it('sets no User-Agent — fetch forbids it and Discogs accepts the browser one', async () => {
    const { client, fetchImpl } = makeClient([jsonResponse({ id: 1, username: 'martin' })])

    await client.get('/oauth/identity', identity)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('User-Agent')
  })

  it('omits the header entirely when signed out', async () => {
    const { client, fetchImpl } = makeClient([jsonResponse({ id: 1, username: 'martin' })], {
      token: null,
    })

    await client.get('/oauth/identity', identity)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('backs off exponentially on 429 and then succeeds', async () => {
    const { client, clock, fetchImpl } = makeClient([
      jsonResponse({ message: 'slow down' }, 429),
      jsonResponse({ message: 'slow down' }, 429),
      jsonResponse({ id: 1, username: 'martin' }),
    ])

    await expect(client.get('/oauth/identity', identity)).resolves.toEqual({
      id: 1,
      username: 'martin',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    // Exactly the two backoffs. Each one already dwarfs the 1200 ms pacing
    // gap, so the pacer adds nothing on top — waiting twice would be waiting
    // for nothing.
    expect(clock.time).toBe(BACKOFF_MS[0]! + BACKOFF_MS[1]!)
    expect(BACKOFF_MS[0]!).toBeGreaterThan(MIN_REQUEST_INTERVAL_MS)
  })

  it('gives up after three attempts and says why', async () => {
    const { client, fetchImpl } = makeClient(
      Array.from({ length: 4 }, () => jsonResponse({ message: 'slow down' }, 429)),
    )

    const error = await client.get('/oauth/identity', identity).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DiscogsError)
    expect((error as DiscogsError).code).toBe('rate-limited')
    expect(fetchImpl).toHaveBeenCalledTimes(BACKOFF_MS.length + 1)
  })

  it('reports an unreachable API as offline rather than as a crash', async () => {
    const client = new DiscogsClient({
      getToken: () => 'a-pat',
      fetchImpl: (() =>
        Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch,
      pacer: createPacer({ now: () => 0, sleep: async () => {} }),
      // Injected, or the retries would spend seven real seconds here.
      sleep: async () => {},
    })

    const error = await client.get('/oauth/identity', identity).catch((e: unknown) => e)
    expect((error as DiscogsError).code).toBe('offline')
  })

  it('uses the global fetch with a valid receiver when none is injected', async () => {
    // Regression: holding `fetch` as a property and calling it as
    // `this.#options.fetchImpl(...)` hands it a foreign `this`, which the
    // browser rejects with "Illegal invocation". The client caught that and
    // reported it as being offline — a network error that was really a bug.
    // Every other test here injects a mock, so this path had no cover at all.
    const calls: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = function (this: unknown) {
      calls.push(this)
      return Promise.resolve(jsonResponse({ id: 1, username: 'martin' }))
    } as unknown as typeof fetch

    try {
      const client = new DiscogsClient({
        getToken: () => 'a-pat',
        pacer: createPacer({ now: () => 0, sleep: async () => {} }),
      })
      await expect(client.get('/oauth/identity', identity)).resolves.toMatchObject({
        username: 'martin',
      })
      expect(calls[0]).toBe(globalThis)
    } finally {
      globalThis.fetch = original
    }
  })

  it('rejects a response that does not match the schema', async () => {
    const { client } = makeClient([jsonResponse({ id: 'not-a-number', username: 'martin' })])
    await expect(client.get('/oauth/identity', identity)).rejects.toThrow()
  })
})

describe('a dropped connection', () => {
  const identitySchema = z.object({ id: z.number(), username: z.string() })

  function flaky(failures: number, isOnline = () => false) {
    const clock = fakeClock()
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls <= failures) throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ id: 1, username: 'martin' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const client = new DiscogsClient({
      getToken: () => 'a-pat',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pacer: createPacer({ now: clock.now, sleep: clock.sleep }),
      sleep: clock.sleep,
      jitter: () => 0,
      isOnline,
    })
    return { client, fetchImpl, clock }
  }

  it('retries a blip instead of ending a 670-request run', async () => {
    const { client, fetchImpl } = flaky(1)

    await expect(client.get('/oauth/identity', identitySchema)).resolves.toMatchObject({
      username: 'martin',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('waits seconds, not minutes — this is not a rate limit', async () => {
    const { client, clock } = flaky(1)
    await client.get('/oauth/identity', identitySchema)

    expect(clock.time).toBe(NETWORK_RETRY_MS[0])
    expect(clock.time).toBeLessThan(BACKOFF_MS[0]!)
  })

  it('gives up once it is clearly not a blip and there is no network', async () => {
    const { client, fetchImpl } = flaky(99)

    const error = await client.get('/oauth/identity', identitySchema).catch((e: unknown) => e)
    expect((error as DiscogsError).code).toBe('offline')
    expect(fetchImpl).toHaveBeenCalledTimes(NETWORK_RETRY_MS.length + 1)
  })

  /*
   * The failure that is invisible from JavaScript.
   *
   * Discogs answers a 429 through Cloudflare *without*
   * `access-control-allow-origin`, so the browser never turns it into a
   * Response — `fetch()` rejects and the status cannot be read (measured
   * 2026-08-10). A rate limit and a dropped cable arrive here as the same
   * thing, and the only evidence available is whether the browser thinks it
   * has a network at all.
   */
  it('waits out the window when it keeps failing while online', async () => {
    const { client, fetchImpl, clock } = flaky(99, () => true)

    await client.get('/oauth/identity', identitySchema).catch(() => undefined)

    // Two quick tries for a blip, then the rate-limit schedule.
    expect(fetchImpl).toHaveBeenCalledTimes(NETWORK_RETRY_MS.length + BACKOFF_MS.length + 1)
    expect(clock.time).toBeGreaterThanOrEqual(BACKOFF_MS[0]!)
  })

  it('recovers on the far side of the window instead of ending the run', async () => {
    // A horizon expansion is hundreds of requests over many minutes. Throwing
    // all of it away for something that clears in under a minute would be the
    // wrong trade, which is the whole reason the wait is long.
    const { client, fetchImpl } = flaky(NETWORK_RETRY_MS.length + 1, () => true)

    await expect(client.get('/oauth/identity', identitySchema)).resolves.toMatchObject({
      username: 'martin',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(NETWORK_RETRY_MS.length + 2)
  })
})

describe('the code a failure carries across postMessage', () => {
  it('survives being turned into a DiscogsError', () => {
    // Errors do not survive postMessage — only their message does — so the
    // code has to be liftable out of the error object. Without this the UI
    // sees "429" as anonymous text and can explain nothing.
    expect(new DiscogsError(429, 'slow down').code).toBe('rate-limited')
    expect(new DiscogsError(401, 'nope').code).toBe('unauthorized')
    expect(new DiscogsError(403, 'nope').code).toBe('unauthorized')
    expect(new DiscogsError(0, 'network').code).toBe('offline')
    expect(new DiscogsError(500, 'boom').code).toBeUndefined()
  })
})
