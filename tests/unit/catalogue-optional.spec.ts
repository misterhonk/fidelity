import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreferences } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import { createCatalogueClient } from '~~/worker/catalogue/client'
import { handlers } from '~~/worker/handlers'

afterEach(async () => {
  await deleteFidelityDb()
  vi.unstubAllGlobals()
})

/**
 * Rule 1 of ADR-013, tested rather than promised: **no feature may require
 * the catalogue.** The same set of shapes as for the hub — never configured,
 * dead, slow, lying, and simply not knowing — and every one of them is a
 * null that the consumer answers with the horizon, silently.
 */
describe('the app runs completely without a catalogue', () => {
  it('ships no catalogue client when none is configured', async () => {
    const preferences = await getPreferences()
    expect(preferences.catalogueUrl).toBeNull()
    expect(createCatalogueClient({ baseUrl: preferences.catalogueUrl })).toBeNull()
    expect(createCatalogueClient({ baseUrl: '   ' })).toBeNull()
  })

  it('answers null when the catalogue is dead, and throws nothing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test/', fetchImpl })!

    await expect(catalogue.build()).resolves.toBeNull()
    await expect(catalogue.family(5542)).resolves.toBeNull()
    await expect(catalogue.credits(1)).resolves.toBeNull()
    await expect(catalogue.run(5)).resolves.toBeNull()
    await expect(catalogue.identify({ barcode: '7 24384 56142 3' })).resolves.toBeNull()
    await expect(catalogue.resolve('Portishead')).resolves.toBeNull()
  })

  it('answers null when the catalogue is slow, and does not wait for it', async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => setTimeout(() => resolve(new Response('{}')), 5000)),
    )
    const catalogue = createCatalogueClient({
      baseUrl: 'http://catalogue.test',
      fetchImpl,
      timeoutMs: 30,
    })!

    const started = Date.now()
    await expect(catalogue.family(5542)).resolves.toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('answers null when the catalogue answers with nonsense', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ nope: true })))
    const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

    await expect(catalogue.build()).resolves.toBeNull()
    await expect(catalogue.family(5542)).resolves.toBeNull()
    await expect(catalogue.artist(1)).resolves.toBeNull()
  })

  it('reads a 404 as "does not know", the ordinary answer', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }))
    const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

    await expect(catalogue.family(5542)).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://catalogue.test/v1/catalogue/master/5542/family',
      expect.anything(),
    )
  })

  it('never asks with an empty question', async () => {
    const fetchImpl = vi.fn()
    const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

    await expect(catalogue.identify({})).resolves.toBeNull()
    await expect(catalogue.resolve('  ')).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('what the catalogue does answer crosses a schema', () => {
  const answers: Record<string, unknown> = {
    '/v1/catalogue/health': { ok: true, build: '2026-09-01', releases: 18200000 },
    '/v1/catalogue/master/5542/family': {
      masterId: 5542,
      total: 160,
      fetchedAt: 0,
      siblings: [
        {
          releaseId: 372340,
          year: 1994,
          country: 'UK',
          label: 'Go! Beat',
          catno: '828 553-1',
          format: 'Vinyl, Album',
        },
      ],
    },
    '/v1/catalogue/artist/1': {
      id: 1,
      name: 'Portishead',
      names: [{ name: 'Beth Gibbons', relation: 'member' }],
    },
    '/v1/catalogue/identify?barcode=724384561423': { releaseIds: [372340, 10147986] },
    '/v1/catalogue/resolve?artist=Portishead': { artistIds: [1] },
  }
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace('http://catalogue.test', '')
    const answer = answers[path]
    return answer
      ? new Response(JSON.stringify(answer))
      : new Response('not found', { status: 404 })
  })

  it('hands over the build, a family, a person and the two lookups', async () => {
    const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

    await expect(catalogue.build()).resolves.toBe('2026-09-01')
    await expect(catalogue.family(5542)).resolves.toMatchObject({ masterId: 5542, total: 160 })
    await expect(catalogue.artist(1)).resolves.toMatchObject({ name: 'Portishead' })
    await expect(catalogue.identify({ barcode: '724384561423' })).resolves.toEqual([
      372340, 10147986,
    ])
    await expect(catalogue.resolve('Portishead')).resolves.toEqual([1])
  })

  it('does not hand over a family that belongs to another master', async () => {
    const lying = vi.fn(
      async () =>
        new Response(JSON.stringify({ masterId: 1, total: 1, fetchedAt: 0, siblings: [] })),
    )
    const catalogue = createCatalogueClient({
      baseUrl: 'http://catalogue.test',
      fetchImpl: lying,
    })!
    await expect(catalogue.family(5542)).resolves.toBeNull()
  })
})

/**
 * "Test the connection", the hub's way: reachable and which build answers.
 */
describe('testing the catalogue connection', () => {
  const check = (url: string) => handlers['catalogue.check']({ url }, {} as never)

  it('says which build answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, build: '2026-09-01', releases: 42 })),
      ),
    )
    await expect(check('http://catalogue.test/')).resolves.toEqual({
      ok: true,
      build: '2026-09-01',
      releases: 42,
    })
  })

  it('tells a stranger from a catalogue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ hello: 'world' }))),
    )
    await expect(check('http://catalogue.test')).rejects.toMatchObject({
      code: 'not-a-catalogue',
    })
  })

  it('names the silence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(check('http://catalogue.test')).rejects.toMatchObject({
      code: 'hub-unreachable',
    })
    await expect(check('   ')).rejects.toMatchObject({ code: 'no-catalogue' })
  })
})
