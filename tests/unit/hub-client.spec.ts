import { describe, expect, it, vi } from 'vitest'

import type { HorizonChunk, ShippingTier } from '#shared/types'
import { chunkIsSound, decodeChunk, encodeChunk } from '#shared/wire'
import { createHubClient } from '~~/worker/hub/client'

const chunk: HorizonChunk = {
  key: 'artist:55',
  kind: 'artist',
  entityId: 55,
  name: 'Conny Plank',
  fetchedAt: 1000,
  complete: true,
  requests: 3,
  releaseIds: Int32Array.from([101, 202, 303]),
  roles: Uint8Array.from([0, 1, 0]),
  years: Int16Array.from([1973, 1974, 1975]),
}

function respond(body: unknown, ok = true) {
  return vi.fn(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), { status: ok ? 200 : 404 }),
  ) as unknown as typeof fetch
}

describe('the wire format', () => {
  it('survives a round trip with its types intact', () => {
    const back = decodeChunk(encodeChunk(chunk))

    // JSON.stringify(new Int32Array([1,2])) is {"0":1,"1":2} — wrong on the
    // way back and larger than the array it replaced.
    expect(back.releaseIds).toBeInstanceOf(Int32Array)
    expect([...back.releaseIds]).toEqual([101, 202, 303])
    expect([...back.roles]).toEqual([0, 1, 0])
    expect([...back.years]).toEqual([1973, 1974, 1975])
  })

  it('carries the optional label fields when they are there', () => {
    const label: HorizonChunk = {
      ...chunk,
      key: 'label:5',
      kind: 'label',
      entityId: 5,
      catalogueSize: 300,
      catnoPrefix: 'BRAIN',
      catnoNums: Int32Array.from([1001, 1002, 1003]),
    }
    const back = decodeChunk(encodeChunk(label))
    expect(back.catalogueSize).toBe(300)
    expect([...back.catnoNums!]).toEqual([1001, 1002, 1003])
  })

  it('leaves them out when they are not', () => {
    const wire = encodeChunk(chunk)
    expect('catnoNums' in wire).toBe(false)
    expect(decodeChunk(wire).catnoNums).toBeUndefined()
  })

  it('is smaller than the same three arrays as JSON number lists', () => {
    const big: HorizonChunk = {
      ...chunk,
      releaseIds: Int32Array.from({ length: 5000 }, (_, i) => 1_000_000 + i),
      roles: new Uint8Array(5000),
      years: new Int16Array(5000).fill(1975),
    }

    const wire = JSON.stringify(encodeChunk(big)).length
    // Like for like: all three arrays, not just the ids. Base64 costs about a
    // third over raw bytes and still beats a list of decimal numbers with a
    // comma between each — and unlike that list, it survives the round trip
    // with its types intact.
    const naive = [big.releaseIds, big.roles, big.years]
      .map((array) => JSON.stringify([...array]).length)
      .reduce((sum, n) => sum + n, 0)

    expect(wire).toBeLessThan(naive)
  })

  it('calls a chunk unsound when the parallel arrays disagree', () => {
    // Index i of roles has to describe release i, or the horizon is corrupt.
    expect(chunkIsSound(chunk)).toBe(true)
    expect(chunkIsSound({ ...chunk, roles: Uint8Array.from([0]) })).toBe(false)
    expect(chunkIsSound({ ...chunk, key: 'artist:99' })).toBe(false)
  })
})

describe('the hub client', () => {
  it('does not exist without a configured hub', () => {
    // The normal case: most people never set one up at all.
    expect(createHubClient({ baseUrl: null })).toBeNull()
    expect(createHubClient({ baseUrl: '   ' })).toBeNull()
  })

  it('sends the shared secret when there is one', async () => {
    const fetchImpl = respond(encodeChunk(chunk))
    const hub = createHubClient({ baseUrl: 'https://hub.test', secret: 'geheim', fetchImpl })!
    await hub.horizon('artist', 55)

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect((init as RequestInit).headers).toMatchObject({ 'x-hub-secret': 'geheim' })
  })

  it('never sends a Discogs token', async () => {
    const fetchImpl = respond(encodeChunk(chunk))
    const hub = createHubClient({ baseUrl: 'https://hub.test', secret: 'geheim', fetchImpl })!
    await hub.horizon('artist', 55)

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization')
    expect(String(url)).not.toContain('token')
  })

  it('treats a miss as nothing to report', async () => {
    const hub = createHubClient({
      baseUrl: 'https://hub.test',
      fetchImpl: respond({ error: 'not cached' }, false),
    })!
    await expect(hub.horizon('artist', 55)).resolves.toBeNull()
  })

  it('refuses an answer that does not match the schema', async () => {
    const hub = createHubClient({
      baseUrl: 'https://hub.test',
      fetchImpl: respond({ hello: 'world' }),
    })!
    await expect(hub.horizon('artist', 55)).resolves.toBeNull()
  })

  it('refuses a chunk whose arrays contradict each other', async () => {
    // A mismatched chunk would corrupt the horizon quietly and permanently,
    // which is far worse than any amount of slowness.
    const broken = {
      ...encodeChunk(chunk),
      roles: encodeChunk({ ...chunk, roles: Uint8Array.from([0]) }).roles,
    }
    const hub = createHubClient({ baseUrl: 'https://hub.test', fetchImpl: respond(broken) })!
    await expect(hub.horizon('artist', 55)).resolves.toBeNull()
  })

  it('labels a shared ladder as shared, never as your own', async () => {
    const hub = createHubClient({
      baseUrl: 'https://hub.test',
      fetchImpl: respond({ tiers: [{ minItems: 1, maxItems: 1, price: 6, currency: 'EUR' }] }),
    })!

    const tiers = await hub.shipping('vinyl-tom', 'Germany')
    expect(tiers?.[0]?.source).toBe('bundled')
  })

  it('only contributes ladders somebody actually typed in', async () => {
    const fetchImpl = respond({ stored: true })
    const hub = createHubClient({ baseUrl: 'https://hub.test', fetchImpl })!

    const parsed: ShippingTier[] = [
      { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'parsed' },
    ]
    await hub.contributeShipping('vinyl-tom', 'Germany', parsed)
    // Passing a regex's guess on as a shared profile would launder a
    // heuristic into a fact.
    expect(fetchImpl).not.toHaveBeenCalled()

    await hub.contributeShipping('vinyl-tom', 'Germany', [{ ...parsed[0]!, source: 'user' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("strips the source before contributing, because it is not the hub's to keep", async () => {
    const fetchImpl = respond({ stored: true })
    const hub = createHubClient({ baseUrl: 'https://hub.test', fetchImpl })!

    await hub.contributeShipping('x', 'Germany', [
      { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'user' },
    ])
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(String((init as RequestInit).body)).not.toContain('source')
  })

  it('tolerates a trailing slash on the configured URL', async () => {
    const fetchImpl = respond(encodeChunk(chunk))
    const hub = createHubClient({ baseUrl: 'https://hub.test///', fetchImpl })!
    await hub.horizon('artist', 55)

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(String(url)).toBe('https://hub.test/v1/horizon/artist/55')
  })
})
