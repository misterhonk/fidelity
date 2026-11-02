import { afterEach, describe, expect, it, vi } from 'vitest'
import { readonly, shallowRef } from 'vue'

import type { WatchDigest } from '#shared/types'

/**
 * The finds of "since your last visit" (#240) on a Start page left open.
 *
 * Rule 4: marketplace data older than six hours is not shown. The digest
 * carries its dig's `expiresAt`, and the screen has to let go of it then —
 * not whenever somebody next reloads.
 */

const call = vi.fn()

vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useFidelityWorker', () => ({ call }))

/** The watchlist keeps its state per module, as the app does per load: a fresh one each test. */
async function opened() {
  vi.resetModules()
  const { useWatchlist } = await import('~/composables/useWatchlist')
  const watchlist = useWatchlist()
  await watchlist.checkOnce()
  return watchlist
}

const NOW = 1_800_000_000_000
const SIX_HOURS = 21_600_000

const digest: WatchDigest = {
  dealer: 'moved',
  digId: 'd1',
  expiresAt: NOW + SIX_HOURS,
  finds: [],
}
const alert = { dealer: 'moved', newListings: 1, seenAt: NOW }

afterEach(() => {
  call.mockReset()
  vi.useRealTimers()
})

describe('the digests on Start', () => {
  it('leave the screen when their dig expires', async () => {
    vi.useFakeTimers({ now: NOW })
    call.mockImplementation(async (name: string) => {
      if (name === 'watch.list') return [{ username: 'moved' }]
      if (name === 'watch.check') return { alerts: [alert], checked: 0 }
      if (name === 'watch.digest') return [digest]
      throw new Error(name)
    })

    const watchlist = await opened()
    expect(watchlist.digests.value).toEqual([digest])

    vi.advanceTimersByTime(SIX_HOURS - 1)
    expect(watchlist.digests.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(watchlist.digests.value).toEqual([])
  })

  it('go when the shops are checked again', async () => {
    vi.useFakeTimers({ now: NOW })
    call.mockImplementation(async (name: string) => {
      if (name === 'watch.list') return [{ username: 'moved' }]
      if (name === 'watch.check') return { alerts: [alert], checked: 0 }
      if (name === 'watch.digest') return [digest]
      throw new Error(name)
    })

    const watchlist = await opened()
    expect(watchlist.digests.value).toEqual([digest])

    await watchlist.recheck()
    expect(watchlist.alerts.value).toEqual([alert])
    expect(watchlist.digests.value).toEqual([])
  })
})
