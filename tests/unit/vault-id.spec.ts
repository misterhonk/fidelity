import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { legacyVaultId, vaultId } from '~~/worker/vault/targets/hub'

/**
 * Where a block lies must not be computable by anybody.
 *
 * Until 2026-08-13 the id was `SHA-256("fidelity-vault:" + userId)`. A Discogs
 * user id is public, so anybody with a shared hub's secret could work out
 * every co-user's storage location — not read it, the block is encrypted, but
 * fetch and overwrite it, yes.
 *
 * This file holds the three properties the new derivation hangs on. Taking any
 * one of them away looks harmless in the source.
 */
describe('the slot a vault lives in', () => {
  /** Zwei Geräte, dieselbe Person, dasselbe Wort — sonst finden sie sich nie. */
  it('is the same on every device of the same person', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toBe(await vaultId(4711, 'ein langes wort'))
  })

  /**
   * And not obtainable without the word.
   *
   * That is the whole point: the public user id alone is no longer enough.
   */
  it('changes with the passphrase', async () => {
    const one = await vaultId(4711, 'ein langes wort')
    const other = await vaultId(4711, 'ein anderes wort')
    expect(one).not.toBe(other)
  })

  it('changes with the person', async () => {
    expect(await vaultId(4711, 'gleiches wort')).not.toBe(await vaultId(4712, 'gleiches wort'))
  })

  /**
   * Never the same as before.
   *
   * If it were, the derivation would be ineffective and the move an idle run —
   * and both would look exactly like success from outside.
   */
  it('is never where it used to be', async () => {
    expect(await vaultId(4711, 'ein langes wort')).not.toBe(await legacyVaultId(4711))
  })

  /** The old route stays so that a device can still find its block. */
  it('still knows the old address, unchanged', async () => {
    // Measured, not invented. If this value changes, no device finds its old
    // block any more and the move silently does not happen.
    expect(await legacyVaultId(4711)).toBe('b9ea8a05da4c0afd5968ec10a7b7296f')
  })

  /**
   * Frozen, because a change to it moves every vault.
   *
   * Not only your own: anyone touching the derivation sends every device in
   * the world to an empty spot, where the app dutifully reports "first backup
   * created". The value is measured, not invented — this file's first attempt
   * stood there with a made-up number and fell over immediately.
   */
  it('lands exactly where it landed yesterday', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toBe('7d3569f8aad7a73e5a8c3d60b6f193e0')
  })

  /** 16 Byte hex, so wie der Hub sie annimmt (`VAULT_ID` in hub/src/app.ts). */
  it('looks like an id the hub accepts', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toMatch(/^[0-9a-f]{32}$/)
    expect(await legacyVaultId(4711)).toMatch(/^[0-9a-f]{32}$/)
  })
})

/**
 * And the call site takes it too.
 *
 * The derivation can be flawless while `runVaultSync` carries on using the old
 * id — both mutation probes on 2026-08-13 survived precisely that, because
 * only the functions were checked above and not who calls them. `status.ts`
 * reaches for IndexedDB at import time, so the shape is read here rather than
 * the behaviour run; the decision is visible.
 */
describe('the sync that uses it', () => {
  const STATUS = readFileSync('worker/vault/status.ts', 'utf8')

  it('derives the slot from the passphrase', () => {
    expect(STATUS).toMatch(/await vaultId\(identity\.userId, passphrase\)/)
  })

  /**
   * The move, and in this order: read, put in the new place, clear the old
   * one. Anyone leaving out the clearing leaves an encrypted block at a
   * computable address — which is exactly what this change stops.
   */
  it('moves an old block across and clears the old address', () => {
    expect(STATUS).toMatch(/await legacyVaultId\(identity\.userId\)/)
    expect(STATUS).toMatch(/await client\.vaultWrite\(id, old\)/)
    expect(STATUS).toMatch(/await client\.vaultForget\(legacy\)/)
  })

  /** Und nie wieder dorthin geschrieben. */
  it('never writes to the old address', () => {
    expect(STATUS).not.toMatch(/vaultWrite\(legacy/)
  })

  /**
   * After this change "nothing was there" means two things, and the more
   * expensive of them looks like a first setup: a changed passphrase moves the
   * storage location with it. Without this message, two devices would drift
   * apart with nothing anywhere looking broken.
   */
  it('says when an empty slot is not a first sync', () => {
    expect(STATUS).toMatch(
      /emptyThoughSyncedBefore: !report\.hadRemote && Boolean\(prefs\.vaultSyncedAt\)/,
    )
  })
})
