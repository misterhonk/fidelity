/**
 * Reading an access key on the screen that shows it (docs/17 §6.2).
 *
 * Only the claims, never a verdict: the signature is the hub's to check with
 * its public key, and this app has neither the key nor the business. What it
 * can say from the string alone is which tier it names and until when — the
 * two things the settings screen writes next to it.
 */
export interface AccessClaims {
  kid: string
  sub: string
  tier: string
  /** Milliseconds since the epoch, for the screen's date helpers. */
  issuedAt: number
  validUntil: number
}

export function decodeAccessKey(token: string): AccessClaims | null {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'fk1') return null
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as Partial<Record<'kid' | 'sub' | 'tier', string>> &
      Partial<Record<'iat' | 'exp', number>>
    if (
      typeof claims.kid !== 'string' ||
      typeof claims.sub !== 'string' ||
      typeof claims.tier !== 'string' ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp)
    ) {
      return null
    }
    return {
      kid: claims.kid,
      sub: claims.sub,
      tier: claims.tier,
      issuedAt: claims.iat! * 1000,
      validUntil: claims.exp! * 1000,
    }
  } catch {
    return null
  }
}
