import { describe, expect, it, vi } from 'vitest'

import { createHubClient, isDiscogsImage } from '~~/worker/hub/client'

/**
 * Der Client glaubt dem Hub nicht.
 *
 * A hub is somebody's spare machine: it will be an old version, misconfigured,
 * or someone else's entirely. For covers that matters more than anywhere else
 * in this protocol, because these strings go straight into an `<img src>` on
 * every device that shares the hub — so a hub able to answer freely would be a
 * hub able to make every screen fetch whatever it liked.
 *
 * The hub refuses non-Discogs addresses on the way in (hub/test/app.test.ts).
 * These are the checks on the way *out*, which is the half that survives the
 * hub being wrong.
 */
describe('woher ein Cover kommen darf', () => {
  it('nimmt Discogs’ Bildhost', () => {
    expect(isDiscogsImage('https://i.discogs.com/abc/rs:fit/x.jpeg')).toBe(true)
  })

  it('nimmt den leeren String – das heißt „es gibt keins“', () => {
    expect(isDiscogsImage('')).toBe(true)
  })

  it('lehnt alles andere ab', () => {
    // The middle two survive a naive `includes('i.discogs.com')`.
    expect(isDiscogsImage('https://evil.test/pixel.gif')).toBe(false)
    expect(isDiscogsImage('https://i.discogs.com.evil.test/x.jpeg')).toBe(false)
    expect(isDiscogsImage('https://evil.test/?a=https://i.discogs.com')).toBe(false)
    expect(isDiscogsImage('http://i.discogs.com/x.jpeg')).toBe(false)
    expect(isDiscogsImage('javascript:alert(1)')).toBe(false)
    expect(isDiscogsImage('data:image/gif;base64,R0lGOD')).toBe(false)
  })
})

const REAL = 'https://i.discogs.com/abc/rs:fit/x.jpeg'

function hubAnswering(body: unknown) {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response)
  return { client: createHubClient({ baseUrl: 'http://hub.test', fetchImpl })!, fetchImpl }
}

describe('was der Client vom Hub übernimmt', () => {
  it('übernimmt, was in Ordnung ist', async () => {
    const { client } = hubAnswering({ covers: { '5': { thumbUrl: REAL, coverUrl: REAL } } })
    expect(await client.covers([5])).toEqual({ 5: { thumbUrl: REAL, coverUrl: REAL } })
  })

  it('wirft eine fremde Adresse weg, auch wenn der Hub sie schickt', async () => {
    const { client } = hubAnswering({
      covers: {
        '5': { thumbUrl: REAL, coverUrl: REAL },
        '6': { thumbUrl: 'https://evil.test/pixel.gif', coverUrl: REAL },
      },
    })

    const covers = await client.covers([5, 6])
    expect(Object.keys(covers)).toEqual(['5'])
  })

  it('nimmt keine Antwort an, die nicht zum Schema passt', async () => {
    const { client } = hubAnswering({ covers: { '5': { thumbUrl: 42 } } })
    expect(await client.covers([5])).toEqual({})
  })

  it('fragt gar nicht erst, wenn nichts zu fragen ist', async () => {
    const { client, fetchImpl } = hubAnswering({ covers: {} })
    expect(await client.covers([])).toEqual({})
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('bündelt alle Ids in einen Aufruf', async () => {
    // A dozen round trips, each with its own two-second ceiling, would cost
    // more than the requests they are meant to save.
    const { client, fetchImpl } = hubAnswering({ covers: {} })
    await client.covers([1, 2, 3])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('/v1/covers?ids=1,2,3')
  })
})
