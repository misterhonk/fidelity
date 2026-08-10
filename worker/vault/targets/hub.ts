import type { VaultTargetPort } from '#shared/ports'

import type { HubClient } from '../../hub/client'
import type { SealedVault } from '../crypto'

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
 * The slot a person's devices agree on without anybody typing anything.
 *
 * Derived from the Discogs user id, which every signed-in device already
 * knows. Hashed rather than used raw so a shared hub's storage does not read
 * as a list of who uses it — the operator sees opaque ids, and the blocks
 * behind them are ciphertext either way.
 *
 * Not derived from the passphrase, deliberately: changing a passphrase would
 * then orphan everything written under the old one.
 */
export async function vaultId(userId: number): Promise<string> {
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
