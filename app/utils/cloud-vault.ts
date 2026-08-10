import type { CloudTokens, VaultTarget } from '#shared/types'

/**
 * The two providers, described rather than special-cased.
 *
 * Everything that differs between Dropbox and Drive is data: two endpoints, a
 * scope, and how each one names a file. The flow around them is the same, which
 * is the point — a third provider would be another entry here and no new code.
 */

export interface CloudProvider {
  key: Extract<VaultTarget, 'dropbox' | 'drive'>
  label: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
  /** Google hands back a refresh token only when asked, and only once. */
  authorizeExtra?: Record<string, string>
  /** Where somebody registers their own app and finds the client id. */
  consoleUrl: string
  /** What to expect on the registration form, so nobody has to guess. */
  hint: string
}

export const CLOUD_PROVIDERS: Record<CloudProvider['key'], CloudProvider> = {
  dropbox: {
    key: 'dropbox',
    label: 'Dropbox',
    authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    // The app-folder permission: Fidelity sees its own folder and nothing else
    // in the account. Asking for more would be asking for what it cannot use.
    scope: 'files.content.read files.content.write',
    authorizeExtra: { token_access_type: 'offline' },
    consoleUrl: 'https://www.dropbox.com/developers/apps',
    hint: 'Scoped access, App folder, dann die App key eintragen.',
  },
  drive: {
    key: 'drive',
    label: 'Google Drive',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    /*
     * `drive.appdata` is the narrowest scope Drive has: a hidden folder only
     * this app can see, invisible in the Drive interface, and no access to a
     * single file the user put there themselves.
     */
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    authorizeExtra: { access_type: 'offline', prompt: 'consent' },
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    hint: 'OAuth-Client-ID, Typ „Web application", Drive API aktiviert.',
  },
}

const EARLY_MS = 60_000

export function tokenExpired(tokens: CloudTokens, now = Date.now()): boolean {
  return tokens.expiresAt - EARLY_MS <= now
}

/**
 * Turning a provider's answer into something with an absolute expiry.
 *
 * `expires_in` is relative and useless the moment it is stored — a number of
 * seconds means nothing without knowing when it was counted from.
 */
export function readTokenResponse(
  body: Record<string, unknown>,
  now = Date.now(),
  previous?: CloudTokens | null,
): CloudTokens {
  const accessToken = typeof body.access_token === 'string' ? body.access_token : ''
  if (!accessToken) throw new Error('Der Anbieter hat keinen Zugriffsschlüssel geschickt.')

  return {
    accessToken,
    /*
     * A refresh only comes with the first consent. Losing the old one on a
     * later exchange would mean silently needing the whole dance again in an
     * hour, which is the kind of bug that shows up on a train.
     */
    refreshToken:
      typeof body.refresh_token === 'string'
        ? body.refresh_token
        : (previous?.refreshToken ?? null),
    expiresAt: now + (typeof body.expires_in === 'number' ? body.expires_in : 3600) * 1000,
  }
}

/** Both providers take the same form-encoded body; only the fields differ. */
export function tokenForm(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString()
}
