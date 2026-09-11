import { describe, expect, it } from 'vitest'

import type { HorizonChunk } from '#shared/types'
import { buildLookup, pressingsOf } from '~~/worker/horizon/lookup'

/**
 * Scarcity as a hint (docs/06 M20 #6): how many pressings an album has,
 * from the horizon's master chunks — the scarcity proxy of docs/14 §3.2
 * without the dump, for the albums the horizon knows.
 */
const master = (entityId: number, ids: number[], complete = true): HorizonChunk => ({
  key: `master:${entityId}`,
  kind: 'master',
  entityId,
  name: `Album ${entityId}`,
  fetchedAt: 0,
  complete,
  requests: 1,
  releaseIds: Int32Array.from(ids),
  roles: new Uint8Array(ids.length),
  years: new Int16Array(ids.length),
})

describe('how many pressings an album has', () => {
  it('counts the versions of a complete master chunk', () => {
    const lookup = buildLookup([master(7, [100, 101, 102])], [], [])
    expect(pressingsOf(lookup, 101)).toBe(3)
  })

  it('says nothing for a release the horizon has no master for', () => {
    const lookup = buildLookup([master(7, [100, 101, 102])], [], [])
    expect(pressingsOf(lookup, 999)).toBeNull()
  })

  it('refuses a chunk cut short — 1,500 of 2,000 is not "one of 1,500"', () => {
    const lookup = buildLookup([master(7, [100, 101], false)], [], [])
    expect(pressingsOf(lookup, 100)).toBeNull()
  })
})
