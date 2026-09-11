import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A shared find list — and the three promises that hold it together.
 *
 * 1. **The key is in the fragment.** That is the one part of an address no
 *    browser sends to a server. If it stood beside it as `?k=`, it would be in
 *    every access log of the hub and of every reverse proxy in front of it —
 *    and the whole encryption would be decoration.
 * 2. **The recipient sends no secret.** They have none; and even if they
 *    happened to have one for a different hub, it would have no business at
 *    somebody else's server.
 * 3. **The clock runs from the scan, not from the sending.** A find list five
 *    hours old, restarted on sharing, would end up eleven hours old — and rule
 *    4 allows six.
 *
 * The shape is checked, because none of these three is a computation. They are
 * decisions about where a value gets written, and what goes wrong with that
 * cannot be seen in a running app.
 */
const SHARE = readFileSync('worker/share.ts', 'utf8')
const CLIENT = readFileSync('worker/hub/client.ts', 'utf8')
const PAGE = readFileSync('app/pages/shared.vue', 'utf8')
const DIG = readFileSync('app/pages/dig.vue', 'utf8')

/** Without comments — this file explains what it checks, and so do the others. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('the link that carries a find list', () => {
  it('puts the key in the fragment, never in the query', () => {
    // `#k=` and nothing else. A `?k=` here would be the whole bug.
    expect(code(DIG)).toMatch(/\/shared\?id=\$\{[^}]+\}#k=\$\{[^}]+\}/)
    expect(code(DIG)).not.toMatch(/[?&]k=/)
  })

  it('reads it back out of the fragment', () => {
    expect(code(PAGE)).toMatch(/location\.hash/)
    // And the id from the query, because that is where it belongs: the server
    // has to see it or it finds nothing.
    expect(code(PAGE)).toMatch(/route\.query\.id/)
  })

  /**
   * The key is generated randomly, not derived.
   *
   * `Math.random()` is not a random generator for something that locks a find
   * list — and the difference is invisible in a running app.
   */
  it('draws the key from the browser’s own randomness', () => {
    expect(code(SHARE)).toMatch(/crypto\.getRandomValues/)
    expect(code(SHARE)).not.toMatch(/Math\.random/)
  })
})

describe('the recipient', () => {
  /**
   * The most important test in this file.
   *
   * `createHubClient` attaches `x-hub-secret` as soon as a secret is passed.
   * Reading a shared list must not do that: the recipient has none, and a
   * secret does not belong at a server just because a link points at it.
   */
  it('asks without a secret, because they have none', () => {
    expect(code(SHARE)).toMatch(
      /createHubClient\(\{\s*baseUrl:\s*hubUrl,\s*secret:\s*null\s*\}\)/,
    )
  })

  it('sends no secret header on the way out either', () => {
    // The method in the client builds its own headers rather than taking
    // `headers` — the *reading* device's secret is in there.
    // Read without comments: the reasoning beside it contains the word
    // `headers`, and that must not trip the test.
    const bare = code(CLIENT)
    const shareRead = bare.slice(bare.indexOf('async shareRead('))
    const body = shareRead.slice(0, shareRead.indexOf('async contributeHorizon'))
    expect(body).not.toMatch(/\bheaders\b(?!:)/)
    expect(body).toMatch(/headers: \{ 'content-type': 'application\/json' \}/)
  })

  /** No token, no collection, nothing — or the link is a dead end. */
  it('reaches a screen that needs no setup', () => {
    const guard = readFileSync('app/middleware/setup.global.ts', 'utf8')
    expect(guard).toMatch(/'\/shared'/)
  })
})

describe('the six-hour rule', () => {
  /**
   * The expiry comes from the dig and is not restarted.
   *
   * The expensive mistake would be `Date.now() + SIX_HOURS` — it looks right,
   * it is easier to write, and in the worst case it doubles the age of the
   * prices somebody gets to see.
   */
  it('carries the dig’s own clock, not a fresh one', () => {
    expect(code(SHARE)).toMatch(/expiresAt: dig\.expiresAt/)
    expect(code(SHARE)).toMatch(/hub\.shareWrite\(id, sealed, dig\.expiresAt\)/)
    // Keine eigene Frist irgendwo in dieser Datei.
    expect(code(SHARE)).not.toMatch(/6 \* 60 \* 60|21_600_000|SIX_HOURS/)
  })

  it('refuses to share what may no longer be shown', () => {
    expect(code(SHARE)).toMatch(/Date\.now\(\) >= dig\.expiresAt/)
  })

  it('checks again when the link is opened', () => {
    // And this time it is not a dead branch: the server has one clock, the
    // device another, and the one somebody is sitting in front of counts.
    expect(code(SHARE)).toMatch(/Date\.now\(\) >= snapshot\.expiresAt/)
  })

  it('takes the button away once the dig is stale', () => {
    expect(code(DIG)).toMatch(/v-if="!expired"/)
  })
})

describe('what travels', () => {
  /** The screen makes the selection, not a second database read. */
  it('shares the list that is on screen, folded copies and all', () => {
    expect(code(SHARE)).toMatch(/loaded\.matches\.slice\(0, MAX_SHARED_MATCHES\)/)
    expect(code(SHARE)).toMatch(/matchesTotal: loaded\.matches\.length/)
  })

  /**
   * And the snapshot does not claim a hundred was all of them.
   *
   * Without `matchesTotal` a truncated list reads like a complete one, and the
   * recipient infers from "a hundred matches" a shop that does not exist in
   * that form.
   */
  it('says how many there really were', () => {
    expect(code(PAGE)).toMatch(/snapshot\.matchesTotal/)
  })
})
