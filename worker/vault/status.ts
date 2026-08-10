import { getPreferences, updatePreferences } from '~~/db/meta'
import type { VaultSnapshot, VaultStatus } from '#shared/types'

import { currentIdentity } from '../auth'
import { createHubClient } from '../hub/client'

import type { SealedVault } from './crypto'
import { syncVault, type SyncReport } from './sync'
import { hubTarget, vaultId } from './targets/hub'

/**
 * Which destination this device uses, and whether it can right now.
 *
 * "Can right now" is a real question rather than a formality: the hub target
 * needs a hub address and a signed-in identity, and the file target will need
 * an API that WebKit does not have. A setup screen that offers what cannot
 * work is a setup screen that produces a support question.
 */
export async function vaultStatus(): Promise<VaultStatus> {
  const prefs = await getPreferences()
  const target = prefs.vaultTarget ?? 'none'

  if (target === 'none') {
    return { target, ready: true, lastSyncedAt: prefs.vaultSyncedAt ?? null, blocked: null }
  }

  if (target === 'hub') {
    const identity = await currentIdentity()
    const blocked = !prefs.hubUrl?.trim()
      ? 'Kein Hub eingetragen – die Adresse steht in den Einstellungen unter Hub.'
      : !identity
        ? 'Erst anmelden: der Tresor gehört zu deinem Discogs-Konto.'
        : null

    return {
      target,
      ready: blocked === null,
      lastSyncedAt: prefs.vaultSyncedAt ?? null,
      blocked,
    }
  }

  if (target === 'file' || target === 'dropbox' || target === 'drive') {
    /*
     * The worker cannot answer these. A file lives behind a picker, and a
     * cloud behind a consent screen — handles, permissions and OAuth tokens
     * all belong to the main thread, so "ready" is decided there. This only
     * says the target is a legitimate choice.
     */
    return { target, ready: true, lastSyncedAt: prefs.vaultSyncedAt ?? null, blocked: null }
  }

  return {
    target,
    ready: false,
    lastSyncedAt: prefs.vaultSyncedAt ?? null,
    blocked: 'Dieses Ziel ist noch nicht gebaut.',
  }
}

/**
 * The half a worker can do for a destination it cannot reach.
 *
 * Same middle as `syncVault`: open what came in, merge it with what is here,
 * write the result back to IndexedDB, hand back a fresh sealed block. The
 * caller does the two ends — reading the file and writing it — because that
 * is where the picker and its permission live.
 */
export async function mergeIntoVault(
  passphrase: string,
  remote: unknown | null,
  now = Date.now(),
): Promise<{
  sealed: SealedVault
  counts: Record<string, number>
  hadRemote: boolean
  syncedAt: number
}> {
  requirePassphrase(passphrase)

  const { snapshotLocal, applySnapshot } = await import('./sync')
  const { mergeSnapshots, describeSnapshot } = await import('./merge')
  const { open, seal } = await import('./crypto')

  const mine = await snapshotLocal(now)
  let merged = mine
  let hadRemote = false

  if (remote) {
    const theirs = await open<VaultSnapshot>(remote as SealedVault, passphrase)
    merged = mergeSnapshots(mine, theirs)
    hadRemote = true
    await applySnapshot(merged)
  }

  await updatePreferences({ vaultSyncedAt: now })

  return {
    sealed: await seal(merged, passphrase),
    counts: describeSnapshot(merged),
    hadRemote,
    syncedAt: now,
  }
}

function requirePassphrase(passphrase: string): void {
  if (passphrase.trim().length < 8) {
    // Short enough to brute-force is short enough to refuse. The block it
    // protects is somebody's whole collection and every judgement they made.
    throw new Error('Die Passphrase muss mindestens acht Zeichen haben.')
  }
}

export async function runVaultSync(passphrase: string): Promise<SyncReport> {
  requirePassphrase(passphrase)

  const status = await vaultStatus()
  if (!status.ready || status.target === 'none') {
    throw new Error(status.blocked ?? 'Kein Ziel eingerichtet.')
  }

  const prefs = await getPreferences()
  const identity = await currentIdentity()
  if (!identity) throw new Error('Nicht angemeldet.')

  const client = createHubClient({ baseUrl: prefs.hubUrl, secret: prefs.hubSecret })
  if (!client) throw new Error('Kein Hub eingetragen.')

  const id = await vaultId(identity.userId)
  const report = await syncVault({
    target: hubTarget(client, id, prefs.hubUrl ?? 'Hub'),
    passphrase,
  })

  await updatePreferences({ vaultSyncedAt: report.syncedAt })
  return report
}
