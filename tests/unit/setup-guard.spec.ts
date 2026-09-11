import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

/**
 * Without a token, nobody belongs on a screen full of data.
 *
 * Until 2026-08-14 the redirect lived in the start page's `onMounted` alone
 * and so applied to exactly one of twelve screens. Anyone opening `/shelf`
 * from a bookmark saw "No records here yet. Fetch the collection in the
 * settings." — a statement about the collection where one about the state of
 * the app belongs.
 *
 * The shape is read: a middleware needs a router and a worker, and what can go
 * wrong here is not a computation but a list. `tests/e2e/setup-guard.spec.ts`
 * drives the route in a browser.
 */
const GUARD = readFileSync('app/middleware/setup.global.ts', 'utf8')

/** Without comments, because this file explains what it checks. */
const code = withoutComments(GUARD)

describe('the setup guard', () => {
  it('is global, so nobody has to remember it', () => {
    // The filename is the promise: `.global.ts` runs on every route.
    expect(GUARD).toMatch(/defineNuxtRouteMiddleware/)
  })

  /**
   * The most important exception, and not an oversight.
   *
   * The token is entered in the settings. Shutting that branch out shuts out
   * the way in — and shuts it out for exactly the people who need it. A guard
   * that locks itself is the most expensive kind of security.
   */
  it('always leaves the way in open', () => {
    for (const path of ['/welcome', '/settings', '/privacy', '/legal']) {
      expect(code).toContain(`'${path}'`)
    }
  })

  /** And the exceptions' subpages count too — /settings/hub is one. */
  it('lets the children of an open path through too', () => {
    expect(code).toMatch(/to\.path\.startsWith\(`\$\{path\}\/`\)/)
  })

  /**
   * Ask first, judge after.
   *
   * `identity` is empty on the first call, because the answer comes from the
   * worker. Anyone not waiting for `ready` redirects everybody on the first
   * load — including the one who has long been set up.
   */
  it('waits for the answer instead of assuming it', () => {
    expect(code).toMatch(/if \(!ready\.value\) await load\(\)/)
  })

  /** During static page generation there is neither IndexedDB nor a worker. */
  it('does nothing while there is no browser', () => {
    expect(code).toMatch(/import\.meta\.server/)
  })

  /**
   * Where somebody came from survives the detour — but only as a path.
   *
   * `next=https://…` in a shared link would be an open redirect. Preventing
   * that costs one line, and it stands where the value is read.
   */
  it('carries the way back, and only as a path', () => {
    expect(code).toMatch(/next: to\.fullPath/)

    const welcome = readFileSync('app/pages/welcome.vue', 'utf8')
    expect(welcome).toMatch(/next\.startsWith\('\/'\) && !next\.startsWith\('\/\/'\)/)
    expect(welcome).toMatch(/:to="backTo"/)
  })
})

/**
 * And the old redirect is gone, not merely outvoted.
 *
 * Two places deciding the same thing are one place too many: one is
 * maintained, the other is not, and which is which only becomes apparent when
 * they contradict each other.
 */
describe('the start screen', () => {
  const INDEX = readFileSync('app/pages/index.vue', 'utf8')

  it('no longer redirects on its own', () => {
    expect(INDEX).not.toMatch(/navigateTo\('\/welcome'\)/)
  })
})
