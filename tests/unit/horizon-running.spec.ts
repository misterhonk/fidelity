import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import type { Candidate } from '~~/worker/horizon/select'

/**
 * "The horizon build is aborted as soon as I leave the tab, and I cannot see
 * why" — reported 2026-09-13, and nothing had been aborted.
 *
 * The run lives in the worker and survives the page that started it; the bar
 * lived in the panel's `ref` and went with it. So leaving took the bar and
 * left the run, and coming back showed an idle panel with an enabled button
 * over a build that was still going — which, pressed, started a second build
 * beside the first.
 *
 * What is tested here is the thing the panel now asks: does this worker know
 * what it is expanding, while it is expanding it.
 */
const expandEntity = vi.hoisted(() => vi.fn())
vi.mock('~~/worker/horizon/expand', () => ({ expandEntity }))

const { buildHorizon } = await import('~~/worker/horizon/build')
const { runningHorizon } = await import('~~/worker/horizon/running')

const NOW = 1_800_000_000_000
const client = {} as DiscogsClient

beforeEach(() => {
  expandEntity.mockReset()
})

afterEach(async () => {
  await deleteFidelityDb()
})

const candidate = (id: number, name = `Artist ${id}`): Candidate => ({
  kind: 'artist',
  id,
  name,
  owned: 3,
})

function expansion(who: Candidate, releaseIds: number[]) {
  return {
    chunk: {
      key: `${who.kind}:${who.id}`,
      kind: who.kind,
      entityId: who.id,
      name: who.name,
      fetchedAt: NOW,
      complete: true,
      requests: 2,
      releaseIds: Int32Array.from(releaseIds),
      roles: Uint8Array.from(releaseIds.map(() => 0)),
      years: Int16Array.from(releaseIds.map(() => 1972)),
      kin: [{ id: who.id, name: who.name }],
    },
    catalogueSize: 0,
    requests: 2,
  }
}

describe('what the horizon is doing right now', () => {
  it('is nothing before and after, and a named build in between', async () => {
    expect(runningHorizon()).toBeNull()

    let letGo: () => void = () => {}
    const gate = new Promise<void>((resolve) => (letGo = resolve))

    const only = [candidate(1), candidate(2)]
    expandEntity.mockImplementation(async (who: Candidate) => {
      // The second entity waits until the test says so — a build in flight.
      if (who.id === 2) await gate
      return expansion(who, [who.id * 10])
    })

    const run = buildHorizon({ client, only, job: 'build', now: () => NOW })
    await new Promise((done) => setTimeout(done, 20))

    const live = runningHorizon()
    expect(live?.job).toBe('build')
    // One entity through, and the name of the one being fetched this second —
    // `current` is emitted before the expansion, so the wait has a subject.
    expect(live?.progress).toMatchObject({ done: 1, total: 2, current: 'Artist 2' })

    letGo()
    await run

    expect(runningHorizon()).toBeNull()
  })

  it('calls the day’s ration a revalidation and the pass after a dig a gap fill', async () => {
    const seen: (string | undefined)[] = []
    expandEntity.mockImplementation(async (who: Candidate) => {
      seen.push(runningHorizon()?.job)
      return expansion(who, [who.id * 10])
    })

    // `only` on its own is the staggered revalidation (docs/11 §3) …
    await buildHorizon({ client, only: [candidate(3)], now: () => NOW })
    // … and `horizon.fillGaps` passes `only` too, and is not one.
    await buildHorizon({ client, only: [candidate(4)], job: 'gaps', now: () => NOW })

    expect(seen).toEqual(['revalidate', 'gaps'])
  })

  it('lets go even when the run throws', async () => {
    expandEntity.mockRejectedValue(new Error('Discogs is down'))

    await expect(
      buildHorizon({
        client,
        only: [candidate(5), candidate(6), candidate(7)],
        job: 'build',
        now: () => NOW,
      }),
    ).rejects.toThrow('Discogs is down')

    expect(runningHorizon()).toBeNull()
    // And nothing was written for an entity that failed.
    expect((await (await openFidelityDb()).getAll('horizon')).length).toBe(0)
  })
})
