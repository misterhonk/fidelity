import { getMeta, getPreferences } from '~~/db/meta'
import type { CloudTokens } from '#shared/types'

import { HUB_TIMEOUT_MS } from '../hub/fallback'
import { registerSecret } from '../log'

/**
 * Tell Dropbox and Google that this device's grant is over (#208).
 *
 * Deleting the database forgets the tokens here, but a refresh token is good
 * at the provider until revoked — a copy that leaked earlier would outlive the
 * sign-out. Best effort and silent: sign-out must never wait on a provider.
 */
export async function revokeCloudTokens(fetchImpl: typeof fetch = fetch): Promise<void> {
  const all = (await getMeta('cloudTokens')) ?? {}
  const clientIds = (await getPreferences()).cloudClientIds
  await Promise.all(
    Object.entries(all).map(([provider, tokens]) => {
      registerSecret(tokens.accessToken)
      registerSecret(tokens.refreshToken)
      const revoke =
        provider === 'drive'
          ? revokeDrive(tokens, fetchImpl)
          : provider === 'dropbox'
            ? revokeDropbox(tokens, clientIds.dropbox, fetchImpl)
            : Promise.resolve()
      return revoke.catch(() => {})
    }),
  )
}

const signal = () => AbortSignal.timeout(HUB_TIMEOUT_MS)

/** Revoking the refresh token at Google ends every access token it issued. */
async function revokeDrive(tokens: CloudTokens, fetchImpl: typeof fetch): Promise<void> {
  await fetchImpl('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    // In the body, never the query string: rule 6 applies to every credential.
    body: new URLSearchParams({ token: tokens.refreshToken ?? tokens.accessToken }).toString(),
    signal: signal(),
  })
}

/**
 * Dropbox revokes by the access token, and takes its refresh token along —
 * so an expired access token is renewed once first, or the refresh survives.
 */
async function revokeDropbox(
  tokens: CloudTokens,
  clientId: string | undefined,
  fetchImpl: typeof fetch,
): Promise<void> {
  let access = tokens.accessToken
  if (tokens.expiresAt <= Date.now() && tokens.refreshToken && clientId) {
    const response = await fetchImpl('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: clientId,
      }).toString(),
      signal: signal(),
    })
    const body = (await response.json()) as { access_token?: unknown }
    if (typeof body.access_token === 'string') access = body.access_token
    registerSecret(access)
  }
  await fetchImpl('https://api.dropboxapi.com/2/auth/token/revoke', {
    method: 'POST',
    headers: { authorization: `Bearer ${access}` },
    signal: signal(),
  })
}
