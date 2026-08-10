import { openFidelityDb } from '~~/db/open'
import type { VaultStatus } from '#shared/types'

/**
 * Setting it up once, and then not thinking about it.
 *
 * A vault nobody remembers to open is a vault that is out of date on the one
 * device you happen to pick up. So after the first round it happens on its
 * own: on app start, quietly, and never in front of a first paint.
 *
 * **Why the passphrase may be kept here.** It looks like storing the key next
 * to the lock, and it is not. The lock is on the *remote* copy — on a hub, in
 * Dropbox, in a folder somebody else's client syncs. The local database is
 * plaintext and always was: the collection, the shortlist and the token are
 * all sitting in IndexedDB already. Keeping the passphrase beside them adds no
 * exposure that having the device does not already give.
 *
 * What it does buy is the difference between a feature somebody uses and a
 * feature somebody sets up once and abandons.
 *
 * Still opt-in, because a shared machine is a different question, and somebody
 * who wants to type it every time is entitled to.
 */

/** Not more often than this, so opening three tabs is not three rounds. */
const MIN_INTERVAL_MS = 5 * 60 * 1000

let ran = false

async function readPassphrase(): Promise<string | null> {
  const db = await openFidelityDb()
  const row = await db.get('meta', 'vaultPassphrase')
  return (row?.value as string | undefined) ?? null
}

export function useVaultSync() {
  const { call } = useFidelityWorker()
  const vaultFile = useVaultFile()
  const cloud = useVaultCloud()

  async function remember(passphrase: string | null): Promise<void> {
    const db = await openFidelityDb()
    if (passphrase) await db.put('meta', { key: 'vaultPassphrase', value: passphrase })
    else await db.delete('meta', 'vaultPassphrase')
  }

  async function remembered(): Promise<boolean> {
    return (await readPassphrase()) !== null
  }

  /** One round against whichever destination is configured. */
  async function runOnce(status: VaultStatus, passphrase: string) {
    switch (status.target) {
      case 'file':
        return vaultFile.sync(passphrase)
      case 'dropbox':
      case 'drive': {
        const prefs = await call('preferences.get', undefined)
        return cloud.sync(status.target, prefs.cloudClientIds[status.target] ?? '', passphrase)
      }
      default:
        return call('vault.sync', { passphrase })
    }
  }

  /**
   * The automatic round. Deliberately not awaited by whoever starts it, and
   * deliberately silent: a destination that is unreachable is not something to
   * interrupt somebody's dig with. The settings screen says when it last
   * worked, which is where somebody would look.
   */
  async function syncOnStart(): Promise<void> {
    if (ran) return
    ran = true

    try {
      const status = await call('vault.status', undefined)
      if (status.target === 'none') return

      const recent =
        status.lastSyncedAt !== null && Date.now() - status.lastSyncedAt < MIN_INTERVAL_MS
      if (recent) return

      const passphrase = await readPassphrase()
      if (!passphrase) return

      await runOnce(status, passphrase)
    } catch {
      // Silent by design. The next start tries again, and nothing here is
      // load-bearing enough to put a red box in front of anybody.
    }
  }

  return { remember, remembered, runOnce, syncOnStart }
}
