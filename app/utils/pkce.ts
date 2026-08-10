/**
 * OAuth without a secret.
 *
 * PKCE (RFC 7636) exists for exactly this situation: a client that cannot keep
 * a secret, because it is a page anybody can read. Instead of proving identity
 * with a stored password, it proves *continuity* — the app invents a random
 * verifier, sends only its hash to the provider, and produces the original
 * when it redeems the code. Somebody who intercepts the code cannot use it,
 * because they never saw the verifier.
 *
 * Which is what makes Dropbox and Drive possible here at all. There is no
 * Fidelity server to hold a client secret, and there never will be (ADR-007).
 * The client id is public by design, and it is yours rather than mine: you
 * register your own app and paste the id, exactly as you paste the Discogs
 * token and the hub secret.
 */

/** RFC 7636 §4.1 allows 43–128 characters; 64 random bytes lands at 86. */
const VERIFIER_BYTES = 64

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)))
}

/** The S256 method. `plain` is also in the RFC and is not worth offering. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

export interface AuthorizeRequest {
  authorizeUrl: string
  clientId: string
  redirectUri: string
  scope: string
  challenge: string
  state: string
  /** Google needs these two to hand back a refresh token at all. */
  extra?: Record<string, string>
}

export function authorizeUrl({
  authorizeUrl: base,
  clientId,
  redirectUri,
  scope,
  challenge,
  state,
  extra = {},
}: AuthorizeRequest): string {
  const url = new URL(base)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)
  return url.toString()
}

/**
 * The redirect address, which has to match what was registered exactly.
 *
 * Path only, no query and no fragment — providers compare the string. Which
 * means a throwaway tunnel hostname will not do: every restart is a new
 * address and a new registration. This is the one place where the named
 * tunnel stops being a nicety.
 */
export function redirectUriFor(origin: string): string {
  // The page that finishes the exchange, which is the one holding the vault
  // settings. Coming back to the settings index would land on a screen that
  // never looks at `?code=`.
  return `${origin.replace(/\/+$/, '')}/einstellungen/abgleich`
}
