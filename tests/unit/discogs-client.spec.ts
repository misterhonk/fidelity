import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { BACKOFF_MS, DiscogsClient } from '~~/worker/discogs/client'
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
    })

    const error = await client.get('/oauth/identity', identity).catch((e: unknown) => e)
    expect((error as DiscogsError).code).toBe('offline')
  })

  it('rejects a response that does not match the schema', async () => {
    const { client } = makeClient([jsonResponse({ id: 'not-a-number', username: 'martin' })])
    await expect(client.get('/oauth/identity', identity)).rejects.toThrow()
  })
})
