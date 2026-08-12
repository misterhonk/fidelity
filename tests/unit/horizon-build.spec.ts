import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSyncState } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Candidate } from '~~/worker/horizon/select'
import type { DiscogsClient } from '~~/worker/discogs/client'

/**
 * Building the horizon.
 *
 * The expensive, minutes-long, few-hundred-request run at the centre of M5 —
 * and the one with no test at all. Everything below is about the promises the
 * module makes in prose: that closing the tab costs one entity rather than the
 * run, that one failure is a hiccup and three in a row is the rate limit, and
 * that a partial run never claims the whole horizon was rebuilt.
 *
 * expandEntity is faked. What it does — paging /artists/{id}/releases — is
 * already covered in horizon.spec.ts; what is untested is the loop around it.
 */
const expandEntity = vi.hoisted(() => vi.fn())
vi.mock('~~/worker/horizon/expand', () => ({ expandEntity }))

const { buildHorizon, horizonStatus, HORIZON_TTL_MS, revalidateHorizon } =
  await import('~~/worker/horizon/build')

const NOW = 1_800_000_000_000
const client = {} as DiscogsClient

beforeEach(() => {
  expandEntity.mockReset()
})

afterEach(async () => {
  await deleteFidelityDb()
})

const candidate = (id: number, name = `Künstler ${id}`): Candidate => ({
  kind: 'artist',
  id,
  name,
  owned: 3,
})

/** What a successful expansion looks like coming back. */
function expansion(candidate: Candidate, releaseIds: number[], requests = 2) {
  return {
    chunk: {
      key: `${candidate.kind}:${candidate.id}`,
      kind: candidate.kind,
      entityId: candidate.id,
      name: candidate.name,
      fetchedAt: NOW,
      complete: true,
      requests,
      releaseIds: Int32Array.from(releaseIds),
      roles: Uint8Array.from(releaseIds.map(() => 0)),
    },
    requests,
    catalogueSize: releaseIds.length,
  }
}

async function build(only: Candidate[], over: Record<string, unknown> = {}) {
  return buildHorizon({ client, only, now: () => NOW, ...over })
}

describe('the expensive run', () => {
  it('writes each entity the moment it is done, not at the end', async () => {
    const ones = [candidate(1), candidate(2)]
    expandEntity
      .mockImplementationOnce(async (c: Candidate) => expansion(c, [10, 11]))
      .mockImplementationOnce(async () => {
        // By now the first entity must already be on disk — that is what makes
        // closing the tab cost one entity instead of the run.
        const db = await openFidelityDb()
        expect(await db.get('horizon', 'artist:1')).toBeDefined()
        throw new Error('Tab zu')
      })

    const result = await build(ones)

    expect(result).toMatchObject({ expanded: 1, failed: 1 })
  })

  it('skips what is already there and still fresh', async () => {
    const db = await openFidelityDb()
    await db.put('horizon', expansion(candidate(1), [10, 11]).chunk)
    expandEntity.mockImplementation(async (c: Candidate) => expansion(c, [20]))

    const result = await build([candidate(1), candidate(2)])

    // No bookkeeping of its own: freshness *is* the resume marker.
    expect(expandEntity).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ expanded: 1, skipped: 1 })
  })

  it('expands again once a chunk has aged past the TTL', async () => {
    const db = await openFidelityDb()
    await db.put('horizon', {
      ...expansion(candidate(1), [10, 11]).chunk,
      fetchedAt: NOW - HORIZON_TTL_MS - 1,
    })
    expandEntity.mockImplementation(async (c: Candidate) => expansion(c, [10, 11, 12]))

    const result = await build([candidate(1)])

    expect(result).toMatchObject({ expanded: 1, skipped: 0 })
    // Counted as a difference, not added twice: the chunk replaced two ids
    // with three, so the total moved by one.
    expect(result.releaseIds).toBe(3)
  })

  it('leaves nothing behind for an entity that failed', async () => {
    expandEntity.mockRejectedValueOnce(new Error('502'))

    const result = await build([candidate(1)])

    const db = await openFidelityDb()
    // Nothing written means the next run picks it up with no special case.
    expect(await db.get('horizon', 'artist:1')).toBeUndefined()
    expect(result).toMatchObject({ expanded: 0, failed: 1 })
  })
})

describe('when Discogs stops answering', () => {
  it('carries on after one failure', async () => {
    expandEntity
      .mockRejectedValueOnce(new Error('502'))
      .mockImplementation(async (c: Candidate) => expansion(c, [10]))

    const result = await build([candidate(1), candidate(2), candidate(3)])

    expect(result).toMatchObject({ expanded: 2, failed: 1 })
  })

  it('gives up after three in a row', async () => {
    expandEntity.mockRejectedValue(new Error('429'))

    // Three consecutive failures is the rate limit, the network or Discogs
    // being down, and hammering it makes all three worse.
    await expect(
      build([candidate(1), candidate(2), candidate(3), candidate(4)]),
    ).rejects.toThrow('429')
    expect(expandEntity).toHaveBeenCalledTimes(3)
  })

  it('counts consecutively, so a success clears the tally', async () => {
    expandEntity
      .mockRejectedValueOnce(new Error('502'))
      .mockRejectedValueOnce(new Error('502'))
      .mockImplementationOnce(async (c: Candidate) => expansion(c, [10]))
      .mockRejectedValueOnce(new Error('502'))
      .mockRejectedValueOnce(new Error('502'))
      .mockImplementationOnce(async (c: Candidate) => expansion(c, [11]))

    const result = await build([1, 2, 3, 4, 5, 6].map((id) => candidate(id)))

    // Two, one good, two, one good — never three in a row, so the run finishes.
    expect(result).toMatchObject({ expanded: 2, failed: 4 })
  })

  it('stops immediately when the run is cancelled', async () => {
    const controller = new AbortController()
    expandEntity.mockImplementation(async (c: Candidate) => {
      controller.abort()
      return expansion(c, [10])
    })

    await expect(
      build([candidate(1), candidate(2)], { signal: controller.signal }),
    ).rejects.toThrow()
    expect(expandEntity).toHaveBeenCalledTimes(1)
  })
})

describe('what the run claims afterwards', () => {
  it('a partial run does not claim the whole horizon was rebuilt', async () => {
    expandEntity.mockImplementation(async (c: Candidate) => expansion(c, [10]))

    await build([candidate(1)])

    /*
     * `only` is what the staggered revalidation passes — a day's budget, a
     * handful of entities. The progress display and the staleness check both
     * read horizonBuiltAt, and setting it here would make a horizon that is
     * mostly a month old look brand new.
     */
    const state = await getSyncState()
    expect(state.horizonBuiltAt ?? null).toBeNull()
    expect(state.horizonRevalidatedAt).toBe(NOW)
  })

  it('reports progress with a subject, so the wait has one', async () => {
    expandEntity.mockImplementation(async (c: Candidate) => expansion(c, [10]))
    const seen: string[] = []

    await build([candidate(1, 'Conny Plank')], {
      report: (progress: { current: string }) => seen.push(progress.current),
    })

    expect(seen).toContain('Conny Plank')
  })
})

/** Two collection rows pointing at the same artist — the selection threshold. */
async function collect(artistId: number, count: number) {
  const db = await openFidelityDb()
  for (let i = 0; i < count; i++) {
    await db.put('collection', {
      // Keyed by entry since v6 — a fixture needs one of its own.
      instanceId: artistId * 100 + i,
      folderId: 1,
      releaseId: artistId * 100 + i,
      masterId: 0,
      title: `Platte ${i}`,
      artistIds: [artistId],
      artistNames: ['Conny Plank'],
      artistNorms: ['conny plank'],
      labelIds: [],
      labelNames: [],
      labelNorms: [],
      year: 1979,
      formats: ['Vinyl'],
      rating: 5,
      addedAt: '2020-01-01T00:00:00Z',
    } as never)
  }
  return db
}

describe('how much of the horizon exists', () => {
  it('counts an aged-out chunk as missing, not as done', async () => {
    const db = await collect(40135, 2)
    await db.put('horizon', {
      ...expansion({ kind: 'artist', id: 40135, name: 'Conny Plank', owned: 2 }, [1, 2, 3])
        .chunk,
      fetchedAt: NOW - HORIZON_TTL_MS - 1,
    })

    const status = await horizonStatus(NOW)

    /*
     * The dashboard offers "Horizont bauen" while expanded < entities. A stale
     * chunk that still counted as expanded would leave somebody with a horizon
     * a year out of date and no prompt anywhere to refresh it.
     */
    expect(status.entities).toBe(1)
    expect(status.expanded).toBe(0)
    // The ids are still there and still usable — stale is not gone.
    expect(status.releaseIds).toBe(3)
    expect(status.estimatedRequests).toBeGreaterThan(0)
  })

  it('is finished when every entity is fresh', async () => {
    const db = await collect(40135, 2)
    await db.put(
      'horizon',
      expansion({ kind: 'artist', id: 40135, name: 'Conny Plank', owned: 2 }, [1, 2]).chunk,
    )

    const status = await horizonStatus(NOW)
    expect(status.expanded).toBe(status.entities)
    expect(status.estimatedRequests).toBe(0)
  })
})

describe('the daily revalidation', () => {
  it('spends nothing when nothing has aged out', async () => {
    const db = await collect(40135, 2)
    await db.put(
      'horizon',
      expansion({ kind: 'artist', id: 40135, name: 'Conny Plank', owned: 2 }, [1, 2]).chunk,
    )

    const result = await revalidateHorizon({ client, now: () => NOW })

    // No request, and above all no expansion of entities never built: those
    // belong to the run somebody starts deliberately and watches.
    expect(expandEntity).not.toHaveBeenCalled()
    expect(result).toMatchObject({ expanded: 0, requests: 0 })
    expect(result.plan.due).toEqual([])
  })

  it('re-expands what has aged out and says it was a revalidation', async () => {
    const db = await collect(40135, 2)
    await db.put('horizon', {
      ...expansion({ kind: 'artist', id: 40135, name: 'Conny Plank', owned: 2 }, [1, 2]).chunk,
      fetchedAt: NOW - HORIZON_TTL_MS - 1,
    })
    expandEntity.mockImplementation(async (c: Candidate) => expansion(c, [1, 2, 3]))

    const result = await revalidateHorizon({ client, now: () => NOW })

    expect(result.expanded).toBe(1)
    const state = await getSyncState()
    expect(state.horizonRevalidatedAt).toBe(NOW)
    expect(state.horizonBuiltAt ?? null).toBeNull()
  })
})
