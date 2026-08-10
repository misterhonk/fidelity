import { getPreferences, updatePreferences } from '~~/db/meta'
import type { VaultStatus } from '#shared/types'

import { currentIdentity } from '../auth'
import { createHubClient } from '../hub/client'

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

  return {
    target,
    ready: false,
    lastSyncedAt: prefs.vaultSyncedAt ?? null,
    blocked: 'Dieses Ziel ist noch nicht gebaut.',
  }
}

export async function runVaultSync(passphrase: string): Promise<SyncReport> {
  if (passphrase.trim().length < 8) {
    // Short enough to brute-force is short enough to refuse. The block it
    // protects is somebody's whole collection and every judgement they made.
    throw new Error('Die Passphrase muss mindestens acht Zeichen haben.')
  }

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
