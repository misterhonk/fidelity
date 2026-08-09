import { afterEach, describe, expect, it, vi } from 'vitest'

import { DIG_TTL_MS } from '~~/db/expire'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { DigNotResumable, findResumable, resumeDig, runDig } from '~~/worker/dig/scan'

afterEach(async () => {
  await deleteFidelityDb()
})

const TOTAL_PAGES = 5

/**
 * Serves a dealer with 500 listings across five pages, and can be told to
 * fail from a given page onwards — which is what a closed tab looks like from
 * in here.
 */
function fakeClient({ failFromPage = Infinity } = {}) {
  const pagesFetched: { order: string; page: number }[] = []

  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory')) {
        return schema.parse({ username: 'vinyl-tom', num_for_sale: TOTAL_PAGES * 100 })
      }

      const page = (options?.query?.page as number) ?? 1
      const order = String(options?.query?.sort_order ?? 'asc')
      if (page >= failFromPage) throw new Error('Verbindung weg')
      pagesFetched.push({ order, page })

      return schema.parse({
        pagination: { page, pages: TOTAL_PAGES, items: TOTAL_PAGES * 100 },
        listings: Array.from({ length: 100 }, (_, i) => ({
          id: page * 1000 + i,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          release: {
            id: page * 1000 + i,
            title: `Platte ${page}-${i}`,
            artist: 'Unbekannt',
            format: '12"',
          },
        })),
      })
    },
  )

  return { client: { get } as unknown as DiscogsClient, pagesFetched, get }
}

describe('resuming an interrupted dig', () => {
  it('stops where the connection died and remembers the page', async () => {
    const { client } = fakeClient({ failFromPage: 3 })

    await expect(runDig({ client, dealer: 'vinyl-tom', digId: '01A' })).rejects.toThrow(
      'Verbindung weg',
    )

    const db = await openFidelityDb()
    const dig = await db.get('digs', '01A')

    expect(dig?.status).toBe('scanning')
    expect(dig?.cursor).toEqual({ page: 2, order: 'asc' })
    expect(dig?.listingsScanned).toBe(200)
  })

  it('picks up at the next page instead of starting over', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
    }).catch(() => undefined)

    const second = fakeClient()
    const dig = await resumeDig({ client: second.client, digId: '01A' })

    // Pages one and two are not fetched again.
    expect(second.pagesFetched.map((p) => p.page)).toEqual([3, 4, 5])
    expect(dig.status).toBe('done')
    expect(dig.listingsScanned).toBe(500)
  })

  it('keeps the six-hour window anchored at the original start', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
      now: () => 1_000,
    }).catch(() => undefined)

    const dig = await resumeDig({
      client: fakeClient().client,
      digId: '01A',
      now: () => 1_000 + 60_000,
    })

    // Not restarted from the resume — otherwise an interrupted dig could be
    // stretched past the deadline indefinitely.
    expect(dig.expiresAt).toBe(1_000 + DIG_TTL_MS)
  })

  it('spends no request re-checking the dealer', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
    }).catch(() => undefined)

    const second = fakeClient()
    await resumeDig({ client: second.client, digId: '01A' })

    const profileCalls = second.get.mock.calls.filter(
      ([path]) => !String(path).includes('/inventory'),
    )
    expect(profileCalls).toHaveLength(0)
  })

  it('is idempotent when the interruption fell inside a page', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
    }).catch(() => undefined)
    await resumeDig({ client: fakeClient().client, digId: '01A' })

    const db = await openFidelityDb()
    const keys = await db.getAllKeys('matches')
    expect(new Set(keys.map(String)).size).toBe(keys.length)
  })
})

describe('what may be resumed at all', () => {
  it('offers the interrupted dig', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
    }).catch(() => undefined)

    expect((await findResumable())?.id).toBe('01A')
  })

  it('offers nothing when everything finished', async () => {
    await runDig({ client: fakeClient().client, dealer: 'vinyl-tom', digId: '01A' })
    expect(await findResumable()).toBeNull()
  })

  it('retires a dig whose six hours have run out rather than offering it', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
      now: () => 0,
    }).catch(() => undefined)

    expect(await findResumable(DIG_TTL_MS + 1)).toBeNull()

    const db = await openFidelityDb()
    expect((await db.get('digs', '01A'))?.status).toBe('expired')
  })

  it('refuses to resume past the deadline', async () => {
    await runDig({
      client: fakeClient({ failFromPage: 3 }).client,
      dealer: 'vinyl-tom',
      digId: '01A',
      now: () => 0,
    }).catch(() => undefined)

    await expect(
      resumeDig({ client: fakeClient().client, digId: '01A', now: () => DIG_TTL_MS + 1 }),
    ).rejects.toBeInstanceOf(DigNotResumable)
  })

  it('refuses a dig that does not exist', async () => {
    await expect(
      resumeDig({ client: fakeClient().client, digId: 'nope' }),
    ).rejects.toBeInstanceOf(DigNotResumable)
  })
})

describe('a dig that is running right now', () => {
  it('is not offered as resumable while this worker is scanning it', async () => {
    // 'scanning' in the database means two very different things: a run that
    // died with its tab, and one that is in flight. Offering the second one
    // and accepting would put two scans on the same rate limit.
    const seen: (string | null)[] = []
    const { client } = fakeClient()

    await runDig({
      client,
      dealer: 'vinyl-tom',
      digId: '01A',
      report: () => {
        // Cannot await inside the callback, so the answer is collected and
        // asserted once the run is over.
        void findResumable().then((dig) => seen.push(dig?.id ?? null))
      },
    })

    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(2))
    expect(seen.every((id) => id === null)).toBe(true)
  })

  it('refuses a second resume of the same dig', async () => {
    const { client } = fakeClient({ failFromPage: 3 })
    await runDig({ client, dealer: 'vinyl-tom', digId: '01A' }).catch(() => undefined)

    const slow = fakeClient()
    const first = resumeDig({ client: slow.client, digId: '01A' })
    const second = resumeDig({ client: slow.client, digId: '01A' })

    await expect(second).rejects.toBeInstanceOf(DigNotResumable)
    await expect(first).resolves.toMatchObject({ status: 'done' })
  })
})
