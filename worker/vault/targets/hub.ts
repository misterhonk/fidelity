import type { VaultTargetPort } from '#shared/ports'

import type { HubClient } from '../../hub/client'
import { KDF_ITERATIONS, type SealedVault } from '../crypto'

/**
 * The hub as a destination.
 *
 * The one that works everywhere — a phone, a laptop, a tablet, all of them
 * reach an address over HTTPS, which is more than can be said for the File
 * System Access API. It is also the only one with no third party in it.
 *
 * The hub cannot read what it holds. That is not a detail of the
 * implementation, it is the condition ADR-008 attaches to this existing.
 */

/**
 * Where the block lies — and why that must not be computable.
 *
 * Until 2026-08-13 the id was `SHA-256("fidelity-vault:" + userId)`. A Discogs
 * user id is public, so anyone knowing a shared hub's secret could work out
 * every co-user's storage location. There was nothing to read there — the
 * block is encrypted with the passphrase — but downloading and overwriting,
 * yes. On a hub shared with friends, nobody should so much as know where
 * somebody else's place is.
 *
 * So it is derived from the passphrase as well. Two things about that are
 * deliberate:
 *
 * **PBKDF2 and not SHA-256.** A fast hash over a passphrase turns the id into
 * an oracle: anyone seeing it can try passphrases offline and know on every
 * hit that they are right. 600,000 rounds make that a sum not worth doing.
 *
 * **A separate, fixed salt.** The encryption takes a random one that sits
 * beside the block — no use here, because you would have to have found the
 * block already to know it. The prefix keeps the two derivations cleanly
 * apart: no key material follows from the id.
 *
 * The price is a third expensive derivation per sync — on a path that already
 * has two of them in `seal` and `open`.
 *
 * **And the catch the old way did not have:** a changed passphrase now moves
 * the storage location too. A wrong word used to be a "cannot be opened"; now
 * it is a "nothing is there" — which looks more dangerous than it is, and is
 * therefore named explicitly in `status.ts` rather than passing as a first
 * setup.
 */
export async function vaultId(userId: number, passphrase: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`fidelity-vault-id:${userId}`) as BufferSource,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    128,
  )

  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Where it lay until 2026-08-13.
 *
 * Kept so that a device can still find its old block and move it — and for
 * nothing else. Nothing is ever written there again.
 */
export async function legacyVaultId(userId: number): Promise<string> {
  const bytes = new TextEncoder().encode(`fidelity-vault:${userId}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hubTarget(client: HubClient, id: string, where: string): VaultTargetPort {
  return {
    available: () => true,

    async read() {
      return client.vaultRead(id)
    },

    async write(sealed) {
      await client.vaultWrite(id, sealed as SealedVault)
    },

    describe: () => where,
  }
}
