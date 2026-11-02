import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, Dig } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { lastRound, runRound } from '~~/worker/dealers/round'
import type * as scan from '~~/worker/dig/scan'
import { runningDig } from '~~/worker/dig/scan'
import { digestMoved, runningDigest } from '~~/worker/watch/digest'

import { seedMatches } from '../e2e/seed'

vi.mock('~~/worker/dig/scan', async (original) => ({
  ...(await original<typeof scan>()),
  runningDig: vi.fn(() => null),
}))

afterEach(async () => {
  vi.mocked(runningDig).mockReset().mockReturnValue(null)
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000
const client = {} as DiscogsClient

async function shop(
  username: string,
  fields: Partial<Dealer> = { watching: true, lastScannedAt: NOW - 86_400_000 },
): Promise<void> {
  const db = await openFidelityDb()
  await db.put('dealers', { ...blankDealer(username), ...fields })
}

function dug(digId: string, dealer: string, matches: number, discarded = false): Dig {
  return {
    id: digId,
    dealer,
    status: 'done',
    startedAt: NOW,
    finishedAt: NOW,
    expiresAt: NOW + 21_600_000,
    listingsTotal: 1,
    listingsScanned: 1,
    coverage: 1,
    depth: 'neu',
    truncated: false,
    matchCount: matches,
    apiRequests: 1,
    cursor: null,
    ...(discarded ? { discarded: true } : {}),
  }
}

/**
 * Since your last visit (#240): the shops that moved get one "only what is
 * new" dig each, and what comes back is that dig's finds, best first.
 */
describe('the digest of shops that moved', () => {
  it('digs only the moved shops for what is new and hands back their best finds', async () => {
    await shop('moved')
    await shop('still')

    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      const db = await openFidelityDb()
      for (const match of seedMatches(digId)) await db.put('matches', match)
      return dug(digId, dealer, 2)
    })

    const digests = await digestMoved({ client, dealers: ['moved'], now: () => NOW, runDig })

    expect(runDig).toHaveBeenCalledTimes(1)
    expect(runDig.mock.calls[0]?.[0]).toMatchObject({ dealer: 'moved', depth: 'neu' })
    expect(digests).toHaveLength(1)
    expect(digests[0]?.expiresAt).toBe(NOW + 21_600_000)
    expect(digests[0]?.finds.map((find) => find.score)).toEqual([92, 71])
    expect(digests[0]?.finds[0]?.signals.length).toBeGreaterThan(0)
  })

  it('says nothing new where the dig saw nothing, and skips a shop never dug', async () => {
    await shop('quiet')
    await shop('never', { watching: true, lastScannedAt: null })

    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) =>
      dug(digId, dealer, 0, true),
    )

    const digests = await digestMoved({
      client,
      dealers: ['quiet', 'never'],
      now: () => NOW,
      runDig,
    })

    expect(runDig).toHaveBeenCalledTimes(1)
    expect(digests).toEqual([
      { dealer: 'quiet', digId: null, expiresAt: NOW + 21_600_000, finds: [] },
    ])
  })

  it('carries on past a shop that will not answer', async () => {
    await shop('broken')
    await shop('fine')

    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      if (dealer === 'broken') throw new Error('404')
      return dug(digId, dealer, 0)
    })

    const digests = await digestMoved({
      client,
      dealers: ['broken', 'fine'],
      now: () => NOW,
      runDig,
    })

    expect(digests.map((digest) => digest.dealer)).toEqual(['fine'])
  })

  it('keeps a round from starting while it holds the dig slot', async () => {
    await shop('moved')

    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      await held
      return dug(digId, dealer, 0)
    })

    const pass = digestMoved({ client, dealers: ['moved'], now: () => NOW, runDig })
    expect(runningDigest()).toBe(true)

    // Refused before the cooldown is written, so the round can run right after.
    await expect(runRound({ client, now: () => NOW, runDig })).rejects.toMatchObject({
      code: 'round-running',
    })
    expect(await lastRound()).toBeNull()

    release()
    await pass
    expect(runningDigest()).toBe(false)
  })

  it('stops at a dig somebody else started', async () => {
    await shop('first')
    await shop('second')
    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      vi.mocked(runningDig).mockReturnValue({} as ReturnType<typeof runningDig>)
      return dug(digId, dealer, 0)
    })

    const digests = await digestMoved({
      client,
      dealers: ['first', 'second'],
      now: () => NOW,
      runDig,
    })

    expect(runDig).toHaveBeenCalledTimes(1)
    expect(digests.map((digest) => digest.dealer)).toEqual(['first'])
  })
})
