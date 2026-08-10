import { describe, expect, it } from 'vitest'

import { authorizeUrl, challengeFor, randomVerifier, redirectUriFor } from '~~/app/utils/pkce'
import { CLOUD_PROVIDERS, readTokenResponse, tokenExpired } from '~~/app/utils/cloud-vault'

/**
 * OAuth without a secret.
 *
 * PKCE is the reason Dropbox and Drive are reachable from a page with no
 * server behind it. Getting the challenge wrong does not fail loudly — it
 * fails at the provider, hours later, with a message about an invalid grant.
 */

describe('the challenge', () => {
  it('matches the worked example in RFC 7636', async () => {
    // §4.1 gives this verifier and §4.2 the challenge it must produce. If this
    // ever drifts, everything else here is testing our own mistake.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(await challengeFor(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('produces a verifier the spec would accept', () => {
    const verifier = randomVerifier()
    // §4.1: 43–128 characters from the unreserved set.
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('never repeats itself', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomVerifier()))
    expect(seen.size).toBe(50)
  })
})

describe('where the user is sent', () => {
  it('asks for a code with S256 and nothing else', async () => {
    const url = new URL(
      authorizeUrl({
        authorizeUrl: 'https://provider.example/authorize',
        clientId: 'abc123',
        redirectUri: 'https://fidelity.example/einstellungen/abgleich',
        scope: 'files.read',
        challenge: 'CHALLENGE',
        state: 'STATE',
      }),
    )

    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe('CHALLENGE')
    expect(url.searchParams.get('state')).toBe('STATE')
    // The one thing that must never be here.
    expect(url.searchParams.get('client_secret')).toBeNull()
  })

  it('carries what each provider needs to hand back a refresh token', () => {
    // Both need asking, and each in its own way. Forgetting it means being
    // logged out an hour later with no way back but the whole dance again.
    expect(CLOUD_PROVIDERS.dropbox.authorizeExtra).toMatchObject({
      token_access_type: 'offline',
    })
    expect(CLOUD_PROVIDERS.drive.authorizeExtra).toMatchObject({ access_type: 'offline' })
  })

  it('keeps the redirect free of query and fragment', () => {
    // Providers compare the string. Anything extra is a mismatch.
    expect(redirectUriFor('https://fidelity.example')).toBe(
      'https://fidelity.example/einstellungen/abgleich',
    )
    expect(redirectUriFor('https://fidelity.example/')).toBe(
      'https://fidelity.example/einstellungen/abgleich',
    )
  })

  it('asks Drive for the narrowest scope there is', () => {
    // appdata is a hidden folder only this app can see. Anything wider would
    // be asking for access to records somebody put there themselves.
    expect(CLOUD_PROVIDERS.drive.scope).toBe('https://www.googleapis.com/auth/drive.appdata')
  })
})

describe('the tokens that come back', () => {
  it('turns a relative lifetime into an absolute one', () => {
    // `expires_in` is meaningless the moment it is stored: seconds from when?
    const tokens = readTokenResponse({ access_token: 'a', expires_in: 3600 }, 1_000_000)
    expect(tokens.expiresAt).toBe(1_000_000 + 3_600_000)
  })

  it('keeps the old refresh token when a new one is not sent', () => {
    /*
     * A refresh token arrives with the first consent and usually never again.
     * Dropping it on a later exchange is a bug that surfaces on a train, an
     * hour after the last thing anybody changed.
     */
    const previous = { accessToken: 'alt', refreshToken: 'bleibt', expiresAt: 0 }
    const fresh = readTokenResponse({ access_token: 'neu', expires_in: 60 }, 0, previous)
    expect(fresh.refreshToken).toBe('bleibt')
  })

  it('refuses an answer with no access token', () => {
    expect(() => readTokenResponse({ error: 'invalid_grant' })).toThrow('Zugriffsschlüssel')
  })

  it('renews a minute early, because clocks disagree', () => {
    const now = 1_000_000
    expect(
      tokenExpired({ accessToken: 'a', refreshToken: null, expiresAt: now + 30_000 }, now),
    ).toBe(true)
    expect(
      tokenExpired({ accessToken: 'a', refreshToken: null, expiresAt: now + 120_000 }, now),
    ).toBe(false)
  })
})
