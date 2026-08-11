import { openFidelityDb } from '~~/db/open'
import type { CloudTokens, VaultTarget } from '#shared/types'

import {
  CLOUD_PROVIDERS,
  readTokenResponse,
  tokenExpired,
  tokenForm,
} from '~/utils/cloud-vault'
import type { CloudProvider } from '~/utils/cloud-vault'
import { useMessages } from '~/composables/useMessages'

/**
 * Dropbox and Google Drive, from a page with no server behind it.
 *
 * Both work because both do OAuth with PKCE and both send CORS headers — which
 * is the entire reason this is possible at all. The client id is yours: you
 * register your own app and paste it, exactly as you paste the Discogs token.
 * There is no Fidelity registration to depend on and no secret to leak.
 *
 * Everything below is transport. The passphrase, the decryption and the merge
 * stay in the worker; what crosses is ciphertext in both directions.
 */

const FILENAME = 'fidelity-tresor.json'

/** Single-use and short-lived, so they belong to the tab, not to the database. */
const VERIFIER_KEY = 'fidelity:pkce:verifier'
const STATE_KEY = 'fidelity:pkce:state'
const PROVIDER_KEY = 'fidelity:pkce:provider'

async function readTokens(key: CloudProvider['key']): Promise<CloudTokens | null> {
  const db = await openFidelityDb()
  const row = await db.get('meta', 'cloudTokens')
  return (row?.value as Record<string, CloudTokens> | undefined)?.[key] ?? null
}

async function writeTokens(
  key: CloudProvider['key'],
  tokens: CloudTokens | null,
): Promise<void> {
  const db = await openFidelityDb()
  const row = await db.get('meta', 'cloudTokens')
  const existing = (row?.value as Record<string, CloudTokens> | undefined) ?? {}

  // Rebuilt rather than mutated: disconnecting has to remove the entry, and a
  // credential left behind because a delete was skipped is the worst kind.
  const all = Object.fromEntries(
    Object.entries(existing).filter(([provider]) => provider !== key),
  )
  if (tokens) all[key] = tokens

  await db.put('meta', { key: 'cloudTokens', value: all })
}

export function useVaultCloud() {
  const { call } = useFidelityWorker()

  /** Step one: leave, with a challenge the provider will hold us to. */
  async function connect(key: CloudProvider['key'], clientId: string): Promise<void> {
    const provider = CLOUD_PROVIDERS[key]
    const verifier = randomVerifier()
    const state = randomVerifier().slice(0, 32)

    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(PROVIDER_KEY, key)

    window.location.href = authorizeUrl({
      authorizeUrl: provider.authorizeUrl,
      clientId,
      redirectUri: redirectUriFor(window.location.origin),
      scope: provider.scope,
      challenge: await challengeFor(verifier),
      state,
      extra: provider.authorizeExtra,
    })
  }

  /**
   * Step two: come back, and prove we are the same page that left.
   *
   * Returns null when this is an ordinary visit rather than a return trip, so
   * the caller can run it on every mount without asking first.
   */
  async function finish(clientId: string): Promise<CloudProvider['key'] | null> {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return null

    const verifier = sessionStorage.getItem(VERIFIER_KEY)
    const expected = sessionStorage.getItem(STATE_KEY)
    const key = sessionStorage.getItem(PROVIDER_KEY) as CloudProvider['key'] | null

    /*
     * The code is in the address bar and must not stay there. It is single-use,
     * but a URL with a credential in it ends up in history, in a bookmark, in
     * a screenshot — so it goes before anything else happens.
     */
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)

    if (!verifier || !key) return null
    if (params.get('state') !== expected) {
      throw new Error(useMessages().value.error.oauthMismatch)
    }

    sessionStorage.removeItem(VERIFIER_KEY)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(PROVIDER_KEY)

    const provider = CLOUD_PROVIDERS[key]
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenForm({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUriFor(window.location.origin),
        code_verifier: verifier,
      }),
    })

    if (!response.ok) throw new Error(`${provider.label} hat den Code abgelehnt.`)
    await writeTokens(key, readTokenResponse(await response.json()))
    return key
  }

  async function disconnect(key: CloudProvider['key']): Promise<void> {
    await writeTokens(key, null)
  }

  async function connected(key: CloudProvider['key']): Promise<boolean> {
    return (await readTokens(key)) !== null
  }

  /** A token that has aged out is renewed silently; there is nothing to ask. */
  async function accessToken(key: CloudProvider['key'], clientId: string): Promise<string> {
    const tokens = await readTokens(key)
    if (!tokens) throw new Error('Noch nicht verbunden.')
    if (!tokenExpired(tokens)) return tokens.accessToken

    if (!tokens.refreshToken) {
      throw new Error('Die Verbindung ist abgelaufen – bitte neu verbinden.')
    }

    const provider = CLOUD_PROVIDERS[key]
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenForm({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: clientId,
      }),
    })

    if (!response.ok) throw new Error('Die Verbindung liess sich nicht erneuern.')
    const fresh = readTokenResponse(await response.json(), Date.now(), tokens)
    await writeTokens(key, fresh)
    return fresh.accessToken
  }

  // --- The two transports ---------------------------------------------------

  async function dropboxRead(token: string): Promise<unknown | null> {
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: `/${FILENAME}` }),
      },
    })

    // 409 is Dropbox's "path not found", which is the first run, not a fault.
    if (response.status === 409) return null
    if (!response.ok) throw new Error('Dropbox hat den Tresor nicht herausgegeben.')
    return readVaultFile(await response.text())
  }

  async function dropboxWrite(token: string, sealed: unknown): Promise<void> {
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: `/${FILENAME}`,
          // Overwrite rather than add: one vault, not a folder of them.
          mode: 'overwrite',
          mute: true,
        }),
      },
      body: JSON.stringify(sealed),
    })
    if (!response.ok) throw new Error('Dropbox hat den Tresor nicht angenommen.')
  }

  /** Drive needs the file's id before it can be replaced, hence the lookup. */
  async function driveFileId(token: string): Promise<string | null> {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('spaces', 'appDataFolder')
    url.searchParams.set('q', `name = '${FILENAME}'`)
    url.searchParams.set('fields', 'files(id)')

    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('Google Drive antwortet nicht wie erwartet.')

    const body = (await response.json()) as { files?: { id: string }[] }
    return body.files?.[0]?.id ?? null
  }

  async function driveRead(token: string): Promise<unknown | null> {
    const id = await driveFileId(token)
    if (!id) return null

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Google Drive hat den Tresor nicht herausgegeben.')
    return readVaultFile(await response.text())
  }

  async function driveWrite(token: string, sealed: unknown): Promise<void> {
    const id = await driveFileId(token)
    const body = JSON.stringify(sealed)

    if (id) {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body,
        },
      )
      if (!response.ok) throw new Error('Google Drive hat den Tresor nicht angenommen.')
      return
    }

    /*
     * Creating it takes two parts: where it goes and what is in it. The parent
     * is `appDataFolder`, a hidden space only this app can see — nothing here
     * can reach a file somebody put in their own Drive.
     */
    const boundary = `fidelity${Math.trunc(performance.now())}`
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: FILENAME, parents: ['appDataFolder'] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      },
    )
    if (!response.ok) throw new Error('Google Drive hat den Tresor nicht angelegt.')
  }

  /** One round, same shape as the file target: read, merge in the worker, write. */
  async function sync(target: VaultTarget, clientId: string, passphrase: string) {
    if (target !== 'dropbox' && target !== 'drive') throw new Error('Kein Cloud-Ziel.')

    const token = await accessToken(target, clientId)
    const remote = target === 'dropbox' ? await dropboxRead(token) : await driveRead(token)

    const report = await call('vault.merge', { passphrase, remote })

    if (target === 'dropbox') await dropboxWrite(token, report.sealed)
    else await driveWrite(token, report.sealed)

    return report
  }

  return { connect, finish, disconnect, connected, sync }
}
