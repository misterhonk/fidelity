import { describe, expect, it, vi } from 'vitest'

import collectionJson from '../fixtures/golden/collection.json'
import horizonJson from '../fixtures/golden/horizon.json'
import inventoryJson from '../fixtures/golden/inventory.json'
import wantlistJson from '../fixtures/golden/wantlist.json'
import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'
import { createCatalogueClient } from '~~/worker/catalogue/client'
import { chunkFromCatalogue } from '~~/worker/catalogue/horizon'
import { buildIndex, evaluate, type Listing } from '~~/worker/match'
import { computeTasteProfile } from '~~/worker/match/taste'

/**
 * The second golden test (docs/16 §6, rule 8 spelled out for the catalogue).
 *
 * The same dig as `golden.spec.ts`, with every horizon chunk arriving
 * through the catalogue instead of the API: the fixture's chunks are turned
 * into the rows the service would send, the client packs them back, and the
 * engine must produce the identical ranking — every score, every signal.
 * The catalogue may add hits, never move a score.
 */
const collection = collectionJson as unknown as CollectionItem[]
const wantlist = wantlistJson as unknown as WantlistItem[]
const inventory = inventoryJson as unknown as Listing[]

type Raw = {
  key: string
  kind: 'artist' | 'label' | 'master'
  entityId: number
  name: string
  catalogueSize?: number
  catnoPrefix?: string
  releaseIds: number[]
  roles: number[]
  years: number[]
  catnoNums?: number[]
  kin?: { name: string; relation: 'alias' | 'member' | 'group' }[]
}
const raw = horizonJson as unknown as Raw[]

const fixtureChunks = raw.map(
  (chunk) =>
    ({
      ...chunk,
      releaseIds: Int32Array.from(chunk.releaseIds),
      roles: Uint8Array.from(chunk.roles),
      years: Int16Array.from(chunk.years),
      ...(chunk.catnoNums ? { catnoNums: Int32Array.from(chunk.catnoNums) } : {}),
    }) as unknown as HorizonChunk,
)

/** What the service would answer for each fixture chunk. */
function answerFor(path: string): unknown {
  const run = /^\/v1\/catalogue\/label\/(\d+)\/run$/.exec(path)
  if (run) {
    const chunk = raw.find((c) => c.kind === 'label' && c.entityId === Number(run[1]))
    if (!chunk) return null
    return {
      id: chunk.entityId,
      name: chunk.name,
      build: '2026-09-01',
      total: chunk.catalogueSize ?? chunk.releaseIds.length,
      prefix: chunk.catnoPrefix ?? null,
      releases: chunk.releaseIds.map((id, i) => [
        id,
        chunk.years[i] || null,
        chunk.catnoNums?.[i] || null,
        chunk.catnoNums?.[i] ? (chunk.catnoPrefix ?? null) : null,
      ]),
    }
  }
  const credits = /^\/v1\/catalogue\/artist\/(\d+)\/credits$/.exec(path)
  if (credits) {
    const chunk = raw.find((c) => c.kind === 'artist' && c.entityId === Number(credits[1]))
    if (!chunk) return null
    return {
      id: chunk.entityId,
      name: chunk.name,
      build: '2026-09-01',
      total: chunk.catalogueSize ?? chunk.releaseIds.length,
      releases: chunk.releaseIds.map((id, i) => [id, chunk.roles[i], chunk.years[i] || null]),
    }
  }
  const artist = /^\/v1\/catalogue\/artist\/(\d+)$/.exec(path)
  if (artist) {
    const chunk = raw.find((c) => c.kind === 'artist' && c.entityId === Number(artist[1]))
    return chunk ? { id: chunk.entityId, name: chunk.name, names: chunk.kin ?? [] } : null
  }
  const family = /^\/v1\/catalogue\/master\/(\d+)\/family$/.exec(path)
  if (family) {
    const chunk = raw.find((c) => c.kind === 'master' && c.entityId === Number(family[1]))
    if (!chunk) return null
    return {
      masterId: chunk.entityId,
      total: chunk.catalogueSize ?? chunk.releaseIds.length,
      fetchedAt: Date.parse('2026-09-01'),
      siblings: chunk.releaseIds.map((id, i) => ({
        releaseId: id,
        year: chunk.years[i] || null,
        country: '',
        label: '',
        catno: '',
        format: '',
      })),
    }
  }
  return null
}

const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
  const answer = answerFor(new URL(String(input)).pathname)
  return answer ? new Response(JSON.stringify(answer)) : new Response('no', { status: 404 })
}) as unknown as typeof fetch

const catalogue = createCatalogueClient({ baseUrl: 'http://catalogue.test', fetchImpl })!

const filters = {
  formatsAllow: [],
  maxPrice: null,
  shipsFromBlock: [],
  prefMediaCondition: 'Very Good (VG)' as const,
  targetPrice: null,
}

function rank(chunks: HorizonChunk[]) {
  const taste = computeTasteProfile(collection, 0)
  const index = buildIndex(collection, wantlist, taste, chunks)
  return inventory
    .map((listing) => ({ listing, result: evaluate(listing, index, filters) }))
    .filter((row) => row.result)
    .sort(
      (a, b) => b.result!.score - a.result!.score || a.listing.releaseId - b.listing.releaseId,
    )
    .map((row) => ({
      release: row.listing.releaseId,
      score: row.result!.score,
      signals: row.result!.signals.map((signal) => signal.type).sort(),
    }))
}

describe('the golden dig through the catalogue', () => {
  it('ranks every record exactly as the API-built horizon does', async () => {
    const viaCatalogue: HorizonChunk[] = []
    for (const chunk of raw) {
      const built = await chunkFromCatalogue(catalogue, {
        kind: chunk.kind,
        id: chunk.entityId,
        name: chunk.name,
      })
      expect(built, chunk.key).not.toBeNull()
      viaCatalogue.push(built!)
    }
    expect(viaCatalogue).toHaveLength(fixtureChunks.length)
    expect(viaCatalogue.every((chunk) => chunk.requests === 0)).toBe(true)

    expect(rank(viaCatalogue)).toEqual(rank(fixtureChunks))
  })
})
