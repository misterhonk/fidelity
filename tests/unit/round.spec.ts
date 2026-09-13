import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { getMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, Dig } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { lastRound, planRound, runRound, runningRound } from '~~/worker/dealers/round'

afterEach(async () => {
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000
const client = {} as DiscogsClient

/**
 * The round walks watched shops and asks each what is new (M29).
 *
 * `runDig` is injected rather than driven: what it does — paging an inventory
 * and scoring it — is covered in deep-scan.spec.ts and dig-since.spec.ts, and
 * what is untested is the walk around it. The rules it has to keep are all
 * about *not* stopping: a shop nobody has dug has no line for "what is new" to
 * halt at and is left out rather than dug in full, and one shop that will not
 * answer is not the round failing.
 */
async function shop(
  username: string,
  fields: Partial<Dealer> = { watching: true, lastScannedAt: NOW - 86_400_000 },
): Promise<void> {
  const db = await openFidelityDb()
  await db.put('dealers', { ...blankDealer(username), ...fields })
}

function finishedDig(digId: string, dealer: string, matches: number, listings: number): Dig {
  return {
    id: digId,
    dealer,
    status: 'done',
    startedAt: NOW,
    finishedAt: NOW,
    expiresAt: NOW + 21_600_000,
    listingsTotal: listings,
    listingsScanned: listings,
    uniqueSeen: listings,
    coverage: 1,
    depth: 'neu',
    truncated: false,
    matchCount: matches,
    apiRequests: 2,
    cursor: null,
  }
}

describe('the round', () => {
  it('visits every watched shop and leaves the rest alone', async () => {
    await shop('kept-one')
    await shop('kept-two')
    await shop('not-watched', { watching: false, lastScannedAt: NOW })
    await shop('hidden', { watching: true, lastScannedAt: NOW, hiddenAt: NOW })

    const visited: string[] = []
    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      visited.push(dealer)
      return finishedDig(digId, dealer, 0, 3)
    })

    const summary = await runRound({ client, now: () => NOW, runDig })

    expect(visited).toEqual(['kept-one', 'kept-two'])
    expect(summary.stops.map((stop) => stop.status)).toEqual(['nothing', 'nothing'])
    expect(summary.requests).toBe(4)
  })

  it('leaves out a shop that has never been dug rather than digging it in full', async () => {
    await shop('never', { watching: true, lastScannedAt: null })
    const runDig = vi.fn()

    const summary = await runRound({ client, now: () => NOW, runDig })

    expect(runDig).not.toHaveBeenCalled()
    expect(summary.stops[0]).toMatchObject({ dealer: 'never', status: 'never-dug', matches: 0 })
  })

  it('carries on when one shop will not answer', async () => {
    await shop('broken')
    await shop('fine')

    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      if (dealer === 'broken') throw new Error('404')
      return finishedDig(digId, dealer, 0, 1)
    })

    const summary = await runRound({ client, now: () => NOW, runDig })

    expect(summary.stops.map((stop) => `${stop.dealer}:${stop.status}`)).toEqual([
      'broken:failed',
      'fine:nothing',
    ])
  })

  it('stops at once when the round is cancelled', async () => {
    await shop('first')
    await shop('second')

    const controller = new AbortController()
    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      controller.abort()
      return finishedDig(digId, dealer, 0, 1)
    })

    await expect(
      runRound({ client, now: () => NOW, runDig, signal: controller.signal }),
    ).rejects.toThrow()
    // And it lets go of the walking state, or every later screen would think
    // a round was still going.
    expect(runningRound()).toBeNull()
  })

  it('says which shop it is at while it walks, and nothing when it is done', async () => {
    await shop('alpha')
    await shop('beta')

    const seen: (string | null)[] = []
    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      seen.push(runningRound()?.dealer ?? null)
      return finishedDig(digId, dealer, 0, 1)
    })

    expect(runningRound()).toBeNull()
    await runRound({ client, now: () => NOW, runDig })

    expect(seen).toEqual(['alpha', 'beta'])
    expect(runningRound()).toBeNull()
  })

  /*
   * The summary outlives the digs it made.
   *
   * Five digs are kept (docs/03 §5), so a round over ten shops prunes the
   * first five find lists before it has finished. What is left has to be
   * readable on its own — which is why the best find is stored by name and not
   * as a reference to a row that may be gone.
   */
  it('keeps a summary with the best find named', async () => {
    await shop('gold')

    const runDig = vi.fn(async ({ dealer, digId }: { dealer: string; digId: string }) => {
      const db = await openFidelityDb()
      for (const [index, score] of [41, 88, 60].entries()) {
        await db.put('matches', {
          digId,
          listingId: 900 + index,
          releaseId: 500 + index,
          score,
          signals: [],
          title: `Record ${score}`,
          artist: `Artist ${score}`,
          label: null,
          catno: null,
          format: '12"',
          year: 1977,
          condition: 'Near Mint (NM or M-)',
          sleeve: null,
          price: 10,
          currency: 'EUR',
          comments: null,
          thumbUrl: null,
          marketLowestPrice: null,
          marketNumForSale: null,
          expired: false,
        })
      }
      return finishedDig(digId, dealer, 3, 12)
    })

    const summary = await runRound({ client, now: () => NOW, runDig })

    expect(summary.stops[0]).toMatchObject({
      status: 'found',
      matches: 3,
      newListings: 12,
      best: { artist: 'Artist 88', title: 'Record 88', score: 88 },
    })
    // Written down, and readable without the digs.
    await expect(lastRound()).resolves.toMatchObject({ stops: summary.stops })
    expect(await getMeta('lastRound')).toBeDefined()
  })

  it('prices the walk before anybody presses anything, and spends nothing to do it', async () => {
    await shop('one')
    await shop('two')
    await shop('never', { watching: true, lastScannedAt: null })

    await expect(planRound()).resolves.toEqual({
      shops: 3,
      reachable: 2,
      neverDug: 1,
      requests: 4,
    })
  })
})
