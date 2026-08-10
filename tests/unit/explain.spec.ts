import { describe, expect, it } from 'vitest'

import { explain } from '~/utils/explain'

/**
 * Derselbe 401, zwei verschiedene Nachrichten.
 *
 * Found by opening the app in a browser that had never seen it and typing a
 * wrong token: "Er wurde vermutlich bei Discogs zurückgezogen." Nothing had
 * been withdrawn — there had never been a token. The wording assumed a session
 * that only exists for somebody who has already been using the app, and sent a
 * first-time typo looking for a withdrawal in their Discogs settings.
 */
const unauthorized = Object.assign(
  new Error('You must authenticate to access this resource.'),
  {
    code: 'unauthorized' as const,
  },
)

describe('a rejected token', () => {
  it('reads as a revocation for somebody who was signed in', () => {
    const { title, action } = explain(unauthorized, { signedIn: true })
    expect(title).toContain('nicht mehr an')
    expect(action).toContain('zurückgezogen')
  })

  it('reads as a bad paste for somebody who never was', () => {
    const { title, action } = explain(unauthorized, { signedIn: false })
    expect(title).toContain('kennt diesen Token nicht')
    // The theory that misled a newcomer must not survive here.
    expect(action).not.toContain('zurückgezogen')
    expect(action).toContain('Kopieren')
  })

  it('assumes a session when nobody says otherwise', () => {
    // Every screen but the setup has one, so the default must be the old text.
    expect(explain(unauthorized).action).toContain('zurückgezogen')
  })

  it('keeps what Discogs actually said, either way', () => {
    for (const signedIn of [true, false]) {
      expect(explain(unauthorized, { signedIn }).detail).toBe(
        'You must authenticate to access this resource.',
      )
    }
  })
})
