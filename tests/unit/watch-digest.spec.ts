import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, Dig } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { digestMoved } from '~~/worker/watch/digest'

import { seedMatches } from '../e2e/seed'

afterEach(async () => {
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
})
