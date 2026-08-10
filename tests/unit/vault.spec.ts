import { describe, expect, it } from 'vitest'

import type { VaultSnapshot } from '#shared/types'
import { open, seal, VAULT_VERSION } from '~~/worker/vault/crypto'
import { mergeSnapshots, SYNCABLE_STORES } from '~~/worker/vault/merge'

/**
 * Carrying a collection between devices.
 *
 * Two things have to hold, and both are the kind that fail quietly: what
 * leaves the device must be unreadable, and a device that has been off for a
 * week must not wipe what the others did while it was away.
 */

const snapshot = (over: Partial<VaultSnapshot> = {}): VaultSnapshot => ({
  savedAt: 1000,
  preferences: null,
  stores: {},
  ...over,
})

describe('what leaves the device', () => {
  it('comes back the same and nothing else does', async () => {
    const sealed = await seal({ hallo: 'welt', zahlen: [1, 2, 3] }, 'ein gutes Passwort')

    expect(sealed.version).toBe(VAULT_VERSION)
    // The block itself gives nothing away.
    expect(JSON.stringify(sealed)).not.toContain('welt')

    expect(await open(sealed, 'ein gutes Passwort')).toEqual({
      hallo: 'welt',
      zahlen: [1, 2, 3],
    })
  }, 30_000)

  it('refuses the wrong passphrase rather than guessing', async () => {
    const sealed = await seal({ geheim: true }, 'richtig')
    // AES-GCM authenticates, so a wrong key fails to open instead of opening
    // into nonsense — which is the difference between a refusal and a bug.
    await expect(open(sealed, 'falsch')).rejects.toThrow()
  }, 30_000)

  it('refuses a block somebody edited', async () => {
    const sealed = await seal({ geheim: true }, 'richtig')
    const bytes = atob(sealed.cipher).split('')
    bytes[0] = bytes[0] === 'A' ? 'B' : 'A'
    await expect(open({ ...sealed, cipher: btoa(bytes.join('')) }, 'richtig')).rejects.toThrow()
  }, 30_000)

  it('uses a new salt and iv every time', async () => {
    // Reusing an IV with AES-GCM is the classic way to lose everything.
    const a = await seal({ x: 1 }, 'gleich')
    const b = await seal({ x: 1 }, 'gleich')
    expect(a.iv).not.toBe(b.iv)
    expect(a.salt).not.toBe(b.salt)
    expect(a.cipher).not.toBe(b.cipher)
  }, 30_000)

  it('says so rather than failing oddly on a newer format', async () => {
    const sealed = await seal({ x: 1 }, 'egal')
    await expect(open({ ...sealed, version: VAULT_VERSION + 1 }, 'egal')).rejects.toThrow(
      'neueren Version',
    )
  }, 30_000)
})

describe('two devices, one truth', () => {
  it('keeps what only one of them has', async () => {
    const laptop = snapshot({
      stores: { feedback: [{ listingId: 1, updatedAt: 100 }] },
    })
    const telefon = snapshot({
      stores: { feedback: [{ listingId: 2, updatedAt: 100 }] },
    })

    const merged = mergeSnapshots(laptop, telefon)
    expect(
      (merged.stores.feedback as { listingId: number }[]).map((r) => r.listingId).sort(),
    ).toEqual([1, 2])
  })

  it('lets the newer write win, whichever side it is on', async () => {
    const alt = snapshot({
      stores: { feedback: [{ listingId: 1, verdict: 'interesting', updatedAt: 100 }] },
    })
    const neu = snapshot({
      savedAt: 2000,
      stores: { feedback: [{ listingId: 1, verdict: 'bought', updatedAt: 500 }] },
    })

    expect(
      (mergeSnapshots(alt, neu).stores.feedback as { verdict: string }[])[0]?.verdict,
    ).toBe('bought')
    // And the same the other way round: the device doing the merging does not
    // win just because it is the one doing it.
    expect(
      (mergeSnapshots(neu, alt).stores.feedback as { verdict: string }[])[0]?.verdict,
    ).toBe('bought')
  })

  it('does not let a device that was away wipe the others', async () => {
    /*
     * The failure this rule exists to prevent. A phone in a drawer for a week
     * has an old, small snapshot; merging must not mean "mine is the truth".
     */
    const schlafend = snapshot({ savedAt: 1000, stores: { dealers: [] } })
    const aktiv = snapshot({
      savedAt: 9000,
      stores: {
        dealers: [
          { username: 'a', updatedAt: 8000 },
          { username: 'b', updatedAt: 8500 },
        ],
      },
    })

    expect(mergeSnapshots(schlafend, aktiv).stores.dealers).toHaveLength(2)
  })

  it('gives a tie to the local copy', () => {
    // Two writes with the same stamp are almost always the same write seen
    // twice; preferring the remote one would rewrite rows on every sync.
    const hier = snapshot({
      stores: { basket: [{ listingId: 1, note: 'hier', addedAt: 100 }] },
    })
    const dort = snapshot({
      stores: { basket: [{ listingId: 1, note: 'dort', addedAt: 100 }] },
    })

    expect((mergeSnapshots(hier, dort).stores.basket as { note: string }[])[0]?.note).toBe(
      'hier',
    )
  })

  it('takes the preferences from whichever snapshot is newer', () => {
    const a = snapshot({ savedAt: 100, preferences: { currency: 'EUR' } as never })
    const b = snapshot({ savedAt: 200, preferences: { currency: 'GBP' } as never })
    expect(mergeSnapshots(a, b).preferences).toMatchObject({ currency: 'GBP' })
    expect(mergeSnapshots(b, a).preferences).toMatchObject({ currency: 'GBP' })
  })

  it('carries neither the token nor a single price', () => {
    /*
     * Rule 6 and rule 4, held to at the one place where breaking them would be
     * convenient. A credential on three devices is three times the exposure,
     * and marketplace data is deleted after six hours — putting it on a server
     * to sync it back is precisely what this app promised not to do.
     */
    expect(SYNCABLE_STORES).not.toContain('digs')
    expect(SYNCABLE_STORES).not.toContain('matches')
    expect(SYNCABLE_STORES).not.toContain('meta')
  })
})
