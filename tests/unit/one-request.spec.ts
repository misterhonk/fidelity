import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

/**
 * One address, one request (M31.7).
 *
 * Measured in the network log on 2026-09-14 while opening a single record:
 *
 *   /releases/9912345
 *   /releases/9912345?curr_abbr=EUR
 *
 * The same address twice — once for the sleeve, once for the tracklist — out
 * of a budget of sixty a minute. Whichever of the two asks first now files
 * both halves, so the second costs nothing and a record whose sleeve a list
 * already fetched opens without asking Discogs anything.
 */
const COVERS = withoutComments(readFileSync('worker/covers.ts', 'utf8'))
const DETAIL = withoutComments(readFileSync('worker/collection/detail.ts', 'utf8'))

describe('one request per record', () => {
  it('asks with the same schema from both sides', () => {
    expect(COVERS).toMatch(/releaseDetailSchema/)
    expect(DETAIL).toMatch(/releaseDetailSchema/)
    // The old images-only schema is gone: a second shape over one address is
    // how the second request came about in the first place.
    expect(COVERS).not.toMatch(/releaseImagesSchema/)
  })

  /** The currency has to travel, or the cover path stores a price with no unit. */
  it('carries the currency on both paths', () => {
    expect(COVERS).toMatch(/curr_abbr: preferences\.currency/)
    expect(DETAIL).toMatch(/curr_abbr: currency/)
  })

  it('files both halves from either side', () => {
    // The cover path stores the tracklist …
    expect(COVERS).toMatch(/storeReleaseDetail\(/)
    expect(COVERS).toMatch(/coverOf\(releaseId, release\.images\)/)
    // … and the detail path stores the sleeve.
    expect(DETAIL).toMatch(/writeCovers\(\[coverOf\(releaseId, answer\.images\)\]\)/)
  })

  /**
   * And a release with no picture is still written.
   *
   * An empty pair is a fact — Discogs has none for plenty of small pressings —
   * and storing it is what stops the app asking again on every visit.
   */
  it('stores the nothing as well as the something', () => {
    const picker = DETAIL.slice(DETAIL.indexOf('export function coverOf'))
    expect(picker).toMatch(/thumbUrl: primary\?\.uri150 \?\? ''/)
    expect(picker).toMatch(/coverUrl: primary\?\.uri \?\? ''/)
  })
})
