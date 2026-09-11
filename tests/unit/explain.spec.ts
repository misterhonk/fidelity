import { beforeAll, describe, expect, it } from 'vitest'

import en from '~/i18n/en'
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

/**
 * And everything the worker throws arrives as words, in both languages.
 *
 * This is the half that used to be missing. Until 2026-09-11 the worker threw
 * sentences, ten of them German; `explain()` had no code to match, fell
 * through to its last line, and made the message the **title** — red, at the
 * top, in whichever language the worker happened to be written in.
 *
 * The table is walked rather than sampled. A code added to
 * `WorkerError['code']` and to `worker/fail.ts` with no words behind it would
 * otherwise reach a screen as a raw marker like `passphrase shorter than eight
 * characters`, and that is precisely the failure this replaced.
 */
describe('what the worker throws', () => {
  const codes = Object.keys(en.error.failed) as (keyof typeof en.error.failed)[]

  it.each(['en', 'de'] as const)('says something useful in %s', (language) => {
    useLanguage().apply(language)

    for (const code of codes) {
      const { title, action, detail } = explain(
        Object.assign(new Error('terse marker'), { code }),
      )
      expect(title, code).not.toBe('terse marker')
      expect(title.trim(), code).not.toBe('')
      expect(action, code).toBeTruthy()
      // The original stays reachable — somebody debugging needs the marker.
      expect(detail, code).toBe('terse marker')
    }
  })
})
