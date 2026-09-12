import { describe, expect, it, vi } from 'vitest'

import type { CatalogueSource } from '#shared/ports'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { expandEntity } from '~~/worker/horizon/expand'

/**
 * The lexicon through the catalogue (M21.4): a person's other names come
 * from the dump when there is one, and the `/artists/{id}` request is not
 * made. Without a catalogue, or with one that does not know, the request is
 * made exactly as before — rule 1 of ADR-013.
 */
function client() {
  const paths: string[] = []
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    paths.push(path)
    if (path.endsWith('/releases')) {
      return schema.parse({
        pagination: { page: 1, pages: 1, items: 1 },
        releases: [{ id: 372340, type: 'release', title: 'Dummy', year: 1994, role: 'Main' }],
      })
    }
    return schema.parse({
      id: 1,
      name: 'The Persuader',
      namevariations: ['Persuader'],
      aliases: [{ id: 239, name: 'Jesper Dahlbäck' }],
    })
  })
  return { client: { get } as unknown as DiscogsClient, paths }
}

const candidate = { kind: 'artist' as const, id: 1, name: 'The Persuader', weight: 1 }

describe('the lexicon through the catalogue', () => {
  it('takes the names from the catalogue and asks Discogs for the discography only', async () => {
    const { client: discogs, paths } = client()
    const catalogue = {
      artist: vi.fn(async () => ({
        id: 1,
        name: 'The Persuader',
        names: [
          { name: 'Persuader', relation: 'alias' as const },
          { name: 'Jesper Dahlbäck', relation: 'alias' as const },
        ],
      })),
    } as unknown as CatalogueSource

    const { chunk, requests } = await expandEntity(candidate as never, {
      client: discogs,
      catalogue,
    })

    expect(paths.some((p) => p === '/artists/1')).toBe(false)
    expect(chunk.kin?.map((k) => k.name)).toEqual(['Persuader', 'Jesper Dahlbäck'])
    expect(requests).toBe(1)
  })

  it('asks Discogs when the catalogue does not know, and when there is none', async () => {
    for (const catalogue of [
      { artist: vi.fn(async () => null) } as unknown as CatalogueSource,
      null,
    ]) {
      const { client: discogs, paths } = client()
      const { chunk, requests } = await expandEntity(candidate as never, {
        client: discogs,
        catalogue,
      })
      expect(paths).toContain('/artists/1')
      expect(chunk.kin?.map((k) => k.name)).toEqual(['Persuader', 'Jesper Dahlbäck'])
      expect(requests).toBe(2)
    }
  })
})
