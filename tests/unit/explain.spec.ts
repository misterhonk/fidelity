import { beforeAll, describe, expect, it } from 'vitest'

import { useLanguage } from '~/composables/useMessages'
import { explain } from '~/utils/explain'

/**
 * The same 401, two different pieces of news.
 *
 * Found by opening the app in a browser that had never seen it and typing a
 * wrong token: "It was probably withdrawn at Discogs." Nothing had been
 * withdrawn — there had never been a token. The wording assumed a session that
 * only exists for somebody who has already been using the app, and sent a
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
    expect(title).toContain('no longer accepts')
    expect(action).toContain('withdrawn')
  })

  it('reads as a bad paste for somebody who never was', () => {
    const { title, action } = explain(unauthorized, { signedIn: false })
    expect(title).toContain('does not know this token')
    // The theory that misled a newcomer must not survive here.
    expect(action).not.toContain('withdrawn')
    expect(action).toContain('copying')
  })

  it('assumes a session when nobody says otherwise', () => {
    // Every screen but the setup has one, so the default must be the old text.
    expect(explain(unauthorized).action).toContain('withdrawn')
  })

  it('keeps what Discogs actually said, either way', () => {
    for (const signedIn of [true, false]) {
      expect(explain(unauthorized, { signedIn }).detail).toBe(
        'You must authenticate to access this resource.',
      )
    }
  })
})

/**
 * And the same distinction in German.
 *
 * Worth its own block rather than a spot check: the two messages differ by one
 * theory about what happened, and that is exactly the kind of nuance a
 * translation flattens. Both languages have to keep them apart.
 */
describe('a rejected token, in German', () => {
  beforeAll(() => useLanguage().apply('de'))

  it('still tells a revocation from a typo', () => {
    expect(explain(unauthorized, { signedIn: true }).action).toContain('zurückgezogen')

    const newcomer = explain(unauthorized, { signedIn: false })
    expect(newcomer.title).toContain('kennt diesen Token nicht')
    expect(newcomer.action).not.toContain('zurückgezogen')
    expect(newcomer.action).toContain('Kopieren')
  })

  it('keeps the raw message untranslated, because Discogs wrote it', () => {
    expect(explain(unauthorized).detail).toBe('You must authenticate to access this resource.')
  })
})
