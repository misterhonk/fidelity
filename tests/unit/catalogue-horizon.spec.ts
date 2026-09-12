import { describe, expect, it, vi } from 'vitest'

import type { CatalogueSource } from '#shared/ports'
import { createCatalogueClient } from '~~/worker/catalogue/client'
import { chunkFromCatalogue } from '~~/worker/catalogue/horizon'

/**
 * The horizon through the catalogue (M21.5): a label's run and a person's
 * credits arrive as rows and leave the client as the chunks the expansion
 * would have built — packed by the same `packChunk`, `catalogueSize` set,
 * zero requests — and the build asks for them per candidate kind.
 */
const answers: Record<string, unknown> = {
  '/v1/catalogue/label/5/run': {
    id: 5,
    name: 'Svek',
    build: '2026-09-01',
    total: 3,
    prefix: 'SK',
    releases: [
      [2, 1998, 31, 'SK'],
      [1, 1999, 32, 'SK'],
      [7, 2001, null, null],
    ],
  },
  '/v1/catalogue/artist/239/credits': {
    id: 239,
    name: 'Jesper Dahlbäck',
    build: '2026-09-01',
    total: 2,
    releases: [
      [1, 1, 1999],
      [4, 0, 2000],
    ],
  },
  '/v1/catalogue/artist/239': {
    id: 239,
    name: 'Jesper Dahlbäck',
    names: [{ name: 'The Persuader', relation: 'alias' }],
  },
  '/v1/catalogue/master/1315/family': {
    masterId: 1315,
    total: 2,
    fetchedAt: Date.parse('2026-09-01'),
    siblings: [
      {
        releaseId: 158,
        year: 1994,
        country: 'UK',
        label: 'Warp',
        catno: 'WAP 54',
        format: 'CD, EP',
      },
      {
        releaseId: 157,
        year: 1994,
        country: 'UK',
        label: 'Warp',
        catno: 'WAP 54',
        format: 'Vinyl',
      },
    ],
  },
}
const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
  const path = new URL(String(input)).pathname
  const answer = answers[path]
  return answer ? new Response(JSON.stringify(answer)) : new Response('no', { status: 404 })
}) as unknown as typeof fetch

const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

describe('a label through the catalogue', () => {
  it('is the label chunk the expansion would have built, whole', async () => {
    const chunk = await catalogue.run(5)
    expect(chunk).toMatchObject({
      key: 'label:5',
      kind: 'label',
      entityId: 5,
      name: 'Svek',
      complete: true,
      requests: 0,
      catalogueSize: 3,
      catnoPrefix: 'SK',
      fetchedAt: Date.parse('2026-09-01'),
    })
    // Sorted by release id, the way every chunk is; the numbers follow.
    expect([...chunk!.releaseIds]).toEqual([1, 2, 7])
    expect([...chunk!.catnoNums!]).toEqual([32, 31, 0])
    expect([...chunk!.years]).toEqual([1999, 1998, 2001])
  })
})

describe('a person through the catalogue', () => {
  it('is the artist chunk with roles, and the names with it', async () => {
    const chunk = await catalogue.credits(239)
    expect(chunk).toMatchObject({
      kind: 'artist',
      entityId: 239,
      catalogueSize: 2,
      requests: 0,
    })
    expect([...chunk!.releaseIds]).toEqual([1, 4])
    expect([...chunk!.roles]).toEqual([1, 0])
    expect(chunk!.kin).toEqual([{ name: 'The Persuader', relation: 'alias' }])
  })

  it('is null for somebody the build does not know', async () => {
    expect(await catalogue.credits(999)).toBeNull()
    expect(await catalogue.run(999)).toBeNull()
  })
})

describe('the horizon build asks per kind', () => {
  it('a label for its run, a person for their credits, a master for its family', async () => {
    const label = await chunkFromCatalogue(catalogue, { kind: 'label', id: 5, name: 'Svek' })
    expect(label?.key).toBe('label:5')

    const artist = await chunkFromCatalogue(catalogue, { kind: 'artist', id: 239, name: 'JD' })
    expect(artist?.key).toBe('artist:239')

    const master = await chunkFromCatalogue(catalogue, {
      kind: 'master',
      id: 1315,
      name: 'Anti EP',
    })
    expect(master).toMatchObject({
      key: 'master:1315',
      catalogueSize: 2,
      requests: 0,
      complete: true,
    })
    expect([...master!.releaseIds]).toEqual([157, 158])
  })

  it('is null without a catalogue, and null when it does not know', async () => {
    expect(await chunkFromCatalogue(null, { kind: 'label', id: 5, name: 'Svek' })).toBeNull()
    const blank = { run: async () => null } as unknown as CatalogueSource
    expect(await chunkFromCatalogue(blank, { kind: 'label', id: 5, name: 'Svek' })).toBeNull()
  })
})
