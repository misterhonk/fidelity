import { beforeEach, describe, expect, it } from 'vitest'

import { forgetLedger, ledger, note, noteFree, purposeOf } from '~~/worker/discogs/ledger'

/**
 * What this device asked Discogs for, and what it was spared (M31.9).
 *
 * Never Discogs' own counter — `x-discogs-ratelimit-*` is not exposed to
 * JavaScript and a 429 arrives without CORS headers (docs/02). This is the
 * app's record of what it put on the wire, and of what the catalogue and the
 * hub answered instead.
 */
beforeEach(() => forgetLedger())

describe('what a request was for', () => {
  /**
   * Read out of the address rather than tagged at the call site: forty edits
   * for a fact every URL already states.
   */
  it('reads the purpose out of the path', () => {
    expect(purposeOf('/users/plattenkiste/inventory')).toBe('dig')
    expect(purposeOf('/marketplace/stats/1234')).toBe('dig')
    expect(purposeOf('/releases/1234')).toBe('record')
    expect(purposeOf('/masters/5542/versions')).toBe('horizon')
    expect(purposeOf('/artists/1234/releases')).toBe('horizon')
    expect(purposeOf('/labels/157/releases')).toBe('horizon')
    expect(purposeOf('/users/me/collection/folders/0/releases')).toBe('sync')
    expect(purposeOf('/users/me/wants')).toBe('sync')
    expect(purposeOf('/oauth/identity')).toBe('other')
  })

  /**
   * The one that has to be ordered right: a shop's inventory is a dig, and the
   * shop's own page is the watcher asking how big it is.
   */
  it('tells a shop apart from its inventory', () => {
    expect(purposeOf('/users/plattenkiste')).toBe('watch')
    expect(purposeOf('/users/plattenkiste/inventory')).toBe('dig')
  })
})

describe('the count', () => {
  it('keeps spent and saved apart', () => {
    note('/releases/1')
    note('/releases/2')
    noteFree('record', 3)

    const found = ledger()
    expect(found.spent.record).toBe(2)
    expect(found.saved.record).toBe(3)
    expect(found.spentTotal).toBe(2)
    expect(found.savedTotal).toBe(3)
  })

  /** The pulse is the last minute, and only the last minute. */
  it('shows one minute in the pulse and the whole session in the totals', () => {
    const now = Date.now()
    note('/releases/1', now - 90_000)
    note('/releases/2', now - 10_000)

    const found = ledger(now)
    expect(found.minute).toHaveLength(1)
    expect(found.spentTotal).toBe(2)
  })

  it('says when counting began, and nothing before that', () => {
    expect(ledger().since).toBeNull()
    const at = Date.now() - 5000
    note('/releases/1', at)
    expect(ledger().since).toBe(at)
  })

  /**
   * A saved answer is counted in the units it replaced, so the two columns are
   * comparable: "horizon saved 600" means six hundred requests not made.
   */
  it('counts a saved answer under the purpose it replaced', () => {
    noteFree('horizon', 2)
    expect(ledger().saved.horizon).toBe(2)
    expect(ledger().spent.horizon).toBe(0)
  })
})
