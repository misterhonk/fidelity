import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { createApiHorizonSource, horizonKey } from '~~/worker/horizon/source-api'
import { preferHub, TimeoutError, withTimeout } from '~~/worker/hub/fallback'
import { createBundledShippingSource } from '~~/worker/shipping/source-bundled'
import { createLocalWatchService } from '~~/worker/watch/service-local'
import type { Dealer, HorizonChunk } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'

afterEach(async () => {
  await deleteFidelityDb()
})

function chunk(entityId: number, fetchedAt = 0): HorizonChunk {
  return {
    key: horizonKey('artist', entityId),
    kind: 'artist',
    entityId,
    name: 'Conny Plank',
    fetchedAt,
    complete: true,
    requests: 11,
    releaseIds: Int32Array.from([1, 2, 3]),
    roles: Uint8Array.from([0, 1, 1]),
    years: Int16Array.from([1973, 1974, 1975]),
  }
}

describe('withTimeout', () => {
  it('rejects with a TimeoutError once the budget is spent', async () => {
    const never = new Promise<string>(() => {})
    await expect(withTimeout(never, 5)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('passes a fast result straight through', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })
})

describe('the hub fallback chain', () => {
  it('uses the hub answer when there is one', async () => {
    const local = vi.fn(async () => 'local')
    const value = await preferHub(local, { hub: async () => 'from-hub' })

    expect(value).toBe('from-hub')
    expect(local).not.toHaveBeenCalled()
  })

  it('falls through when no hub is configured — the normal case', async () => {
    await expect(preferHub(async () => 'local')).resolves.toBe('local')
  })

  it('falls through silently when the hub throws', async () => {
    const value = await preferHub(async () => 'local', {
      hub: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
    expect(value).toBe('local')
  })

  it('falls through when the hub is slow — a slow hub is worse than none', async () => {
    const value = await preferHub(async () => 'local', {
      hub: () => new Promise(() => {}),
      timeoutMs: 5,
    })
    expect(value).toBe('local')
  })

  it('falls through when the hub simply does not know', async () => {
    await expect(preferHub(async () => 'local', { hub: async () => null })).resolves.toBe(
      'local',
    )
  })

  it('offers the local result back to the hub without waiting for it', async () => {
    const contribute = vi.fn(async () => {})
    await expect(preferHub(async () => 'local', { contribute })).resolves.toBe('local')

    await vi.waitFor(() => expect(contribute).toHaveBeenCalledWith('local'))
  })

  it('survives a hub that rejects the contribution', async () => {
    const contribute = vi.fn(async () => {
      throw new Error('418')
    })
    await expect(preferHub(async () => 'local', { contribute })).resolves.toBe('local')
    await vi.waitFor(() => expect(contribute).toHaveBeenCalled())
  })
})

describe('the api horizon source', () => {
  it('expands once and serves the cache afterwards', async () => {
    const expand = vi.fn(async () => chunk(40135, 1_000))
    const source = createApiHorizonSource(expand, { now: () => 1_000 })

    const first = await source.fetch('artist', 40135)
    const second = await source.fetch('artist', 40135)

    expect(expand).toHaveBeenCalledTimes(1)
    expect(first?.releaseIds).toEqual(Int32Array.from([1, 2, 3]))
    expect(second?.entityId).toBe(40135)

    const db = await openFidelityDb()
    expect(await db.get('horizon', 'artist:40135')).toBeDefined()
  })

  it('re-expands once the chunk is past its revalidation window', async () => {
    const expand = vi.fn(async () => chunk(40135, 0))
    await createApiHorizonSource(expand, { ttlMs: 100, now: () => 0 }).fetch('artist', 40135)
    await createApiHorizonSource(expand, { ttlMs: 100, now: () => 1_000 }).fetch(
      'artist',
      40135,
    )

    expect(expand).toHaveBeenCalledTimes(2)
  })

  it('prefers the hub over spending requests on Discogs', async () => {
    const expand = vi.fn(async () => chunk(40135, 1_000))
    const source = createApiHorizonSource(expand, {
      hub: async () => chunk(40135, 1_000),
      now: () => 1_000,
    })

    await source.fetch('artist', 40135)
    expect(expand).not.toHaveBeenCalled()
  })
})

describe('the bundled shipping source', () => {
  const file = {
    version: 1,
    profiles: {
      'vinyl-tom|germany': [
        { minItems: 1, maxItems: 1, price: 6, currency: 'EUR' },
        { minItems: 2, maxItems: null, price: 9, currency: 'EUR' },
      ],
    },
  }

  const respond = (body: unknown, ok = true) =>
    vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response)

  it('reads the ladder and marks where it came from', async () => {
    const source = createBundledShippingSource({ fetchImpl: respond(file) })
    const tiers = await source.get('Vinyl-Tom', 'Germany')

    expect(tiers).toHaveLength(2)
    expect(tiers?.[0]).toMatchObject({ minItems: 1, price: 6, source: 'bundled' })
    expect(tiers?.[1]?.maxItems).toBeNull()
  })

  it('fetches the file once for many lookups', async () => {
    const fetchImpl = respond(file)
    const source = createBundledShippingSource({ fetchImpl })

    await source.get('vinyl-tom', 'Germany')
    await source.get('someone-else', 'Germany')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports "no ladder known" rather than failing when the file is broken', async () => {
    const source = createBundledShippingSource({ fetchImpl: respond({ version: 2 }) })
    await expect(source.get('vinyl-tom', 'Germany')).resolves.toBeNull()
  })

  it('reports "no ladder known" when the file is missing', async () => {
    const source = createBundledShippingSource({ fetchImpl: respond(null, false) })
    await expect(source.get('vinyl-tom', 'Germany')).resolves.toBeNull()
  })
})

describe('the local watch service', () => {
  const dealer = (username: string, over: Partial<Dealer> = {}): Dealer => ({
    username,
    displayName: username,
    shipsFrom: 'Germany',
    sellerRating: 99,
    ratingCount: 10,
    numForSale: 1000,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: 1,
    affinity: null,
    fingerprint: null,
    shippingTiers: [],
    ...over,
  })

  const client = (numForSale: Record<string, number>) =>
    ({
      get: async (path: string, schema: { parse: (v: unknown) => unknown }) => {
        const username = decodeURIComponent(/\/users\/([^/?]+)/.exec(path)?.[1] ?? '')
        return schema.parse({ username, num_for_sale: numForSale[username] ?? 0 })
      },
    }) as unknown as DiscogsClient

  afterEach(async () => {
    await deleteFidelityDb()
  })

  it('registers dealers without duplicates', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', dealer('vinyl-tom'))
    await db.put('dealers', dealer('juno_records'))

    const service = createLocalWatchService(() => client({}))
    await service.register(['vinyl-tom', 'vinyl-tom', 'juno_records'])

    expect((await service.dealers()).sort()).toEqual(['juno_records', 'vinyl-tom'])
  })

  it('unwatches by leaving somebody out of the set', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', dealer('vinyl-tom'))
    await db.put('dealers', dealer('juno_records'))

    const service = createLocalWatchService(() => client({}))
    await service.register(['vinyl-tom', 'juno_records'])
    await service.register(['vinyl-tom'])

    expect(await service.dealers()).toEqual(['vinyl-tom'])
  })

  it('says nothing on the first check, having nothing to compare against', async () => {
    const db = await openFidelityDb()
    // Watched, but never checked: watchNumForSale is the baseline from the
    // moment it was added, and the count has not moved since.
    await db.put('dealers', dealer('vinyl-tom', { watching: true, watchNumForSale: 1000 }))

    const service = createLocalWatchService(() => client({ 'vinyl-tom': 1000 }))
    await expect(service.pending()).resolves.toEqual([])
  })

  it('reports a shop whose stock grew since the last look', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', dealer('vinyl-tom', { watching: true, watchNumForSale: 1000 }))

    const service = createLocalWatchService(() => client({ 'vinyl-tom': 1040 }))
    await expect(service.pending()).resolves.toEqual([
      { dealer: 'vinyl-tom', newListings: 40, seenAt: expect.any(Number) },
    ])
  })
})
