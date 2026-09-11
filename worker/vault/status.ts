import { getPreferences, updatePreferences } from '~~/db/meta'
import type { VaultBlocked, VaultSnapshot, VaultStatus } from '#shared/types'

import { currentIdentity } from '../auth'
import { createHubClient } from '../hub/client'

import type { SealedVault } from './crypto'
import { syncVault, type SyncReport } from './sync'
import { hubTarget, legacyVaultId, vaultId } from './targets/hub'
import { fail } from '../fail'

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
    const blocked: VaultBlocked | null = !prefs.hubUrl?.trim()
      ? 'no-hub'
      : !identity
        ? 'signed-out'
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
    blocked: 'not-built',
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
    throw fail('passphrase-short', 'passphrase shorter than eight characters')
  }
}

export async function runVaultSync(passphrase: string): Promise<SyncReport> {
  requirePassphrase(passphrase)

  const status = await vaultStatus()
  if (!status.ready || status.target === 'none') {
    // Not user-facing: the sync button is disabled unless `ready`. If this
    // ever surfaces it is a bug, and a bug report is better in one language.
    throw fail('vault-unusable', `vault target not usable: ${status.blocked ?? 'none set'}`)
  }

  const prefs = await getPreferences()
  const identity = await currentIdentity()
  if (!identity) throw fail('not-signed-in', 'not signed in')

  const client = createHubClient({ baseUrl: prefs.hubUrl, secret: prefs.hubSecret })
  if (!client) throw fail('no-hub', 'no hub configured')

  const id = await vaultId(identity.userId, passphrase)

  /*
   * The move from the old storage location — once, and then never again.
   *
   * Until 2026-08-13 the id hung off the public Discogs user id (the reasoning
   * is in `targets/hub.ts`). A device that has not synced since then finds
   * nothing under the new id — and must on no account read that as a first
   * setup and overwrite the older state.
   *
   * So: look in the old place, put the block in the new one, and clear the
   * old. The clearing is the point, not the tidiness — an encrypted block at a
   * computable address is exactly what is being stopped here.
   */
  const legacy = await legacyVaultId(identity.userId)
  if (legacy !== id && !(await client.vaultRead(id))) {
    const old = await client.vaultRead(legacy)
    if (old) {
      await client.vaultWrite(id, old)
      await client.vaultForget(legacy)
    }
  }

  const report = await syncVault({
    target: hubTarget(client, id, prefs.hubUrl ?? 'Hub'),
    passphrase,
  })

  await updatePreferences({ vaultSyncedAt: report.syncedAt })

  return {
    ...report,
    emptyThoughSyncedBefore: !report.hadRemote && Boolean(prefs.vaultSyncedAt),
  }
}
