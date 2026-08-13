import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Wo nach einem Hub gesucht wird, und in welcher Reihenfolge.
 *
 * The order is the feature. `/hub` on the app's own domain is the only
 * candidate that cannot fail for a reason outside the hub itself — no CORS, no
 * mixed content, no second certificate — and it is the only one that works on
 * a phone nowhere near the machine at home. `http://localhost:8787` is the
 * opposite: measured 2026-08-10, WebKit refuses it outright from an https
 * page, which is every iPhone.
 *
 * Reading the source rather than running the handler, because the handler
 * lives in a module that reaches for IndexedDB at import time. What is being
 * guarded is a decision, not an algorithm, and the decision is visible.
 */
const HANDLERS = readFileSync('worker/handlers.ts', 'utf8')

/** The `hub.discover` handler alone — the file is four thousand lines. */
const discover = HANDLERS.slice(
  HANDLERS.indexOf("'hub.discover'"),
  HANDLERS.indexOf("'hub.check'"),
)

describe('looking for a hub', () => {
  it('asks this domain before it asks this machine', () => {
    const sameOrigin = discover.indexOf('`${here}/hub`')
    const localhost = discover.indexOf('http://localhost:8787')

    expect(sameOrigin).toBeGreaterThan(-1)
    expect(localhost).toBeGreaterThan(-1)
    expect(sameOrigin).toBeLessThan(localhost)
  })

  /** Both spellings of the local one: 127.0.0.1 is not `localhost` on a box
   *  where that resolves to ::1 first, and the failure looks the same. */
  it('still tries both spellings of the local one', () => {
    expect(discover).toMatch(/http:\/\/localhost:8787/)
    expect(discover).toMatch(/http:\/\/127\.0\.0\.1:8787/)
  })

  /**
   * A hub that wants a secret is never reported as open.
   *
   * `secured` decides whether the app keeps the address by itself. Defaulting
   * it to `false` when the hub says nothing would have the app save an address
   * it cannot use — and then fail silently forever, because that is what a
   * hub does by design (rule 8).
   */
  it('assumes a secret is wanted unless the hub says otherwise', () => {
    expect(discover).toMatch(/secured: body\.secured !== false/)
    expect(discover).not.toMatch(/secured: body\.secured === true/)
  })
})

/**
 * Und der Bildschirm behält nur, was ohne Wort brauchbar ist.
 *
 * Auto-saving a secured hub would configure something that answers 401 to
 * everything except its own health check.
 */
describe('the hub settings screen', () => {
  const PANEL = readFileSync('app/components/HubSettings.vue', 'utf8')

  it('keeps an open one by itself', () => {
    expect(PANEL).toMatch(/await call\('preferences\.set', \{ hubUrl: found\.url/)
  })

  it('only fills in a secured one', () => {
    const secured = PANEL.indexOf('if (found.secured)')
    const kept = PANEL.indexOf("await call('preferences.set', { hubUrl: found.url")

    expect(secured).toBeGreaterThan(-1)
    // The early return for the secured case comes first, so the save below it
    // is unreachable for a hub that wants a word.
    expect(secured).toBeLessThan(kept)
    expect(PANEL).toMatch(/st\.value\.hubPanel\.foundSecured/)
  })
})
