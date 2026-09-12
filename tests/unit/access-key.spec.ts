import { describe, expect, it } from 'vitest'

import { generateAccessKeyPair, issueKey, parseKey } from '~~/hub/src/access'
import { decodeAccessKey } from '~/utils/access-key'

/**
 * The app reads a key the way the hub does (docs/17 §6.2) — the claims, not
 * the verdict. Held together the way the catalogue's twins are: the hub's
 * issuer signs, both readers read, and they must agree on every field.
 */
const issuer = generateAccessKeyPair()
const NOW = 1_800_000_000_000

describe('reading an access key', () => {
  it('agrees with the hub on what a key says', () => {
    const token = issueKey({
      privateKeyPem: issuer.privateKeyPem,
      sub: 'payer-7',
      tier: 'lp',
      days: 35,
      now: () => NOW,
      kid: 'cafe0123',
    })
    const theirs = parseKey(token)!
    const ours = decodeAccessKey(token)!
    expect(ours).toEqual({
      kid: theirs.kid,
      sub: theirs.sub,
      tier: theirs.tier,
      issuedAt: theirs.iat * 1000,
      validUntil: theirs.exp * 1000,
    })
    expect(ours.validUntil - ours.issuedAt).toBe(35 * 24 * 60 * 60 * 1000)
  })

  it('reads nothing off what is not a key', () => {
    for (const junk of [
      '',
      'fk1',
      'fk1.notbase64.x',
      'jwt.eyJhIjoxfQ.sig',
      'test-token-not-a-real-one',
    ])
      expect(decodeAccessKey(junk)).toBeNull()
  })

  it('never verifies — a forged key reads the same as a real one here', () => {
    const forger = generateAccessKeyPair()
    const forged = issueKey({
      privateKeyPem: forger.privateKeyPem,
      sub: 'x',
      tier: 'first',
      now: () => NOW,
    })
    // The screen may show what it claims; the hub is the one that refuses it.
    expect(decodeAccessKey(forged)?.tier).toBe('first')
  })
})
