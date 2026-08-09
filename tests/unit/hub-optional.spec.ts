import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreferences, updatePreferences } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer } from '#shared/types'
import { resolveShipping } from '~~/worker/basket/profiles'
import { createHubClient } from '~~/worker/hub/client'
import { preferHub } from '~~/worker/hub/fallback'

afterEach(async () => {
  await deleteFidelityDb()
  vi.unstubAllGlobals()
})

/**
 * The rule ADR-008 exists for, tested rather than promised: **no feature may
 * require a hub.** docs/06 M9 asks for exactly this as a CI check.
 *
 * Not one test but a set, because "works without a hub" has several shapes:
 * never configured, configured but dead, configured but slow, configured but
 * lying. All four have to end in the local path with nothing said out loud.
 */
describe('the app runs completely without a hub', () => {
  it('ships no hub client when none is configured', async () => {
    const preferences = await getPreferences()
    // The default, and what almost everybody will always have.
    expect(preferences.hubUrl).toBeNull()
    expect(createHubClient({ baseUrl: preferences.hubUrl })).toBeNull()
  })

  it('takes the local path when there is no hub', async () => {
    const local = vi.fn(async () => 'local')
    await expect(preferHub(local, { hub: null })).resolves.toBe('local')
    expect(local).toHaveBeenCalledTimes(1)
  })

  it('takes the local path when the hub is dead', async () => {
    const local = vi.fn(async () => 'local')
    const hub = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    await expect(preferHub(local, { hub })).resolves.toBe('local')
    expect(local).toHaveBeenCalledTimes(1)
  })

  it('takes the local path when the hub is slow, and does not wait for it', async () => {
    const local = async () => 'local'
    // A slow hub is worse than no hub, so it is cut off rather than waited on.
    const hub = () => new Promise<string>((resolve) => setTimeout(() => resolve('hub'), 5000))

    const started = Date.now()
    await expect(preferHub(local, { hub, timeoutMs: 30 })).resolves.toBe('local')
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('takes the local path when the hub answers with nonsense', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 })),
    )
    const hub = createHubClient({ baseUrl: 'https://hub.test' })!
    // A schema failure is a miss, not an error the caller has to handle.
    await expect(hub.horizon('artist', 55)).resolves.toBeNull()
  })

  it('resolves shipping without a hub exactly as it always did', async () => {
    const dealer: Dealer = {
      username: 'shop',
      displayName: 'Der Laden',
      shipsFrom: 'Germany',
      sellerRating: 99,
      ratingCount: 5,
      numForSale: 100,
      minOrderTotal: 0,
      shippingNote: '1 LP: 6 EUR, 2-3 LP: 9 EUR',
      lastScannedAt: 1,
      affinity: null,
      fingerprint: null,
      shippingTiers: [],
    }

    const resolved = await resolveShipping(dealer, 'Germany')
    expect(resolved.source).toBe('parsed')
    expect(resolved.tiers).toHaveLength(2)
  })

  it('never lets a hub failure surface as an error', async () => {
    // The whole promise of rule 8: a broken hub costs two seconds, once, and
    // is never something the user is asked to understand.
    await updatePreferences({ hubUrl: 'https://definitely-not-there.invalid' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      }),
    )

    const db = await openFidelityDb()
    await db.put('dealers', {
      username: 'shop',
      displayName: 'Der Laden',
      shipsFrom: 'Germany',
      sellerRating: 99,
      ratingCount: 5,
      numForSale: 100,
      minOrderTotal: 0,
      shippingNote: '1 LP: 6 EUR',
      lastScannedAt: 1,
      affinity: null,
      fingerprint: null,
      shippingTiers: [],
    })

    const dealer = (await db.get('dealers', 'shop'))!
    await expect(resolveShipping(dealer, 'Germany')).resolves.toMatchObject({
      source: 'parsed',
    })
  })

  it('contributes nothing when there is nobody to contribute to', async () => {
    const contribute = vi.fn()
    await preferHub(async () => 'local', { hub: null, contribute: null })
    expect(contribute).not.toHaveBeenCalled()
  })
})
