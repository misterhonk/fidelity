import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { DigWithMatches } from '#shared/protocol'
import type { Dig, Match, Signal } from '#shared/types'
import { sharedUrl } from '~/utils/share-link'
import { createShare, encodeShare, readShare, toSharedDig } from '~~/worker/share'

import { withoutComments } from '../helpers/german'

/**
 * A shared find list, carried in the link itself (#249).
 *
 * No hub, and nothing in it that may not travel: no price, no condition, no
 * seller, no cover (Discogs Restricted Data). The link lives as long as
 * somebody keeps it, so what is in it has to be fine forever.
 */

const SIGNALS: Signal[] = [
  { type: 'WANTLIST_EXACT', confidence: 1, evidence: { want: 5 } },
  { type: 'LABEL_AFFINITY', confidence: 0.8, evidence: { label: 'Blue Note', owned: 14 } },
  {
    type: 'PRICE_SIGNAL',
    confidence: 0.6,
    evidence: { price: 1234, marketLowest: 2000, currency: 'EUR' },
  },
  { type: 'SCARCITY', confidence: 0.5, evidence: { numForSale: 2 } },
  { type: 'STYLE_ADJACENT', confidence: 0.4, evidence: { styles: ['Hard Bop'], owned: 9 } },
  { type: 'FORMAT_UPGRADE', confidence: 0.5, evidence: { album: 'Blue Train', ownedAs: 'CD' } },
]

function match(listingId: number): Match {
  return {
    digId: 'd1',
    listingId,
    releaseId: 1000 + listingId,
    score: 87,
    signals: SIGNALS,
    title: 'Blue Train',
    artist: 'John Coltrane',
    label: 'Blue Note',
    catno: 'BLP 1577',
    format: 'LP',
    year: 1957,
    condition: 'Very Good Plus (VG+)',
    sleeve: 'Near Mint (NM or M-)',
    price: 1234,
    currency: 'EUR',
    comments: 'seller remark',
    thumbUrl: 'https://i.discogs.com/cover.jpg',
    marketLowestPrice: 2000,
    marketNumForSale: 2,
    expired: false,
  }
}

function loaded(n: number, expiresAt = Date.now() + 3_600_000): DigWithMatches {
  const dig = {
    id: 'd1',
    dealer: 'plattenkiste',
    startedAt: Date.now(),
    expiresAt,
    coverage: 0.5,
    listingsTotal: 400,
  } as Dig
  const matches = Array.from({ length: n }, (_, i) => match(i + 1))
  return { dig, matches, topFive: [], folded: 0, showUntil: null }
}

describe('what travels', () => {
  it('carries no price, condition, seller or cover', () => {
    const snapshot = toSharedDig(loaded(3))
    const text = JSON.stringify(snapshot)

    for (const key of [
      'price',
      'currency',
      'condition',
      'sleeve',
      'comments',
      'thumbUrl',
      'marketLowest',
      'marketNumForSale',
      'numForSale',
      'dealer',
    ]) {
      expect(text).not.toContain(`"${key}"`)
    }
    for (const value of ['1234', 'VG+', 'plattenkiste', 'seller remark', 'cover.jpg', 'EUR']) {
      expect(text).not.toContain(value)
    }
  })

  it('keeps ids, catalogue facts and reasons', () => {
    const [first] = toSharedDig(loaded(1)).matches
    expect(first).toEqual({
      releaseId: 1001,
      listingId: 1,
      score: 87,
      artist: 'John Coltrane',
      title: 'Blue Train',
      label: 'Blue Note',
      catno: 'BLP 1577',
      format: 'LP',
      year: 1957,
      signals: [
        { type: 'WANTLIST_EXACT', confidence: 1, evidence: {} },
        { type: 'LABEL_AFFINITY', confidence: 0.8, evidence: {} },
        { type: 'STYLE_ADJACENT', confidence: 0.4, evidence: { styles: ['Hard Bop'] } },
        { type: 'FORMAT_UPGRADE', confidence: 0.5, evidence: {} },
      ],
    })
  })

  it('says how many there really were', () => {
    const snapshot = toSharedDig(loaded(130))
    expect(snapshot.matches).toHaveLength(50)
    expect(snapshot.matchesTotal).toBe(130)
  })

  it('fits the finds into a link a chat app will carry', async () => {
    const { data } = await createShare(loaded(130))
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(data.length).toBeLessThan(8_000)
  })

  it('hands back the top find for a share card, as cleaned as the link (#250)', async () => {
    const { top } = await createShare(loaded(3))
    expect(top).toEqual(toSharedDig(loaded(1)).matches[0])
  })

  it('refuses to share a dig past its six hours', async () => {
    await expect(createShare(loaded(1, Date.now() - 1))).rejects.toMatchObject({
      code: 'dig-expired',
    })
  })
})

describe('the recipient', () => {
  it('reads back what was sent', async () => {
    const snapshot = toSharedDig(loaded(5))
    expect(await readShare(await encodeShare(snapshot))).toEqual(snapshot)
  })

  it('refuses a damaged link with a code', async () => {
    await expect(readShare('not-a-link')).rejects.toMatchObject({ code: 'malformed-payload' })
    const broken = await encodeShare({ ...toSharedDig(loaded(1)), matches: 'many' } as never)
    await expect(readShare(broken)).rejects.toMatchObject({ code: 'malformed-payload' })
  })

  it('refuses an oversized link before inflating it', async () => {
    await expect(readShare('A'.repeat(20_001))).rejects.toMatchObject({
      code: 'malformed-payload',
      message: 'shared list too long',
    })
  })

  it('reads a link from a newer version as nothing, not as damaged', async () => {
    expect(await readShare(await encodeShare({ version: 3 } as never))).toBeNull()
  })

  it('drops a price somebody wrote into a link by hand', async () => {
    const snapshot = toSharedDig(loaded(1))
    const forged = {
      ...snapshot,
      matches: snapshot.matches.map((m) => ({
        ...m,
        price: 999,
        condition: 'Mint (M)',
        signals: [...SIGNALS],
      })),
    }
    const read = await readShare(await encodeShare(forged as never))
    const text = JSON.stringify(read)
    expect(text).not.toContain('999')
    expect(text).not.toContain('Mint')
    expect(text).not.toContain('PRICE_SIGNAL')
    expect(text).not.toContain('owned')
  })

  /** No token, no collection, nothing — or the link is a dead end. */
  it('reaches a screen that needs no setup', () => {
    const guard = readFileSync('app/middleware/setup.global.ts', 'utf8')
    expect(guard).toMatch(/'\/shared'/)
  })

  it('reads the list from the fragment, never the query', () => {
    const page = withoutComments(readFileSync('app/pages/shared.vue', 'utf8'))
    expect(page).toMatch(/location\.hash/)
    expect(page).not.toMatch(/route\.query/)
  })
})

describe('the link', () => {
  const at = (pathname: string) => ({ origin: 'https://sleeveside.app', pathname }) as Location

  it('hangs off the app root, with the list in the fragment', () => {
    expect(sharedUrl('abc', at('/shop'))).toBe('https://sleeveside.app/shared#d=abc')
    expect(sharedUrl('abc', at('/stack/'))).toBe('https://sleeveside.app/shared#d=abc')
    expect(sharedUrl('abc', at('/sub/shop'))).toBe('https://sleeveside.app/sub/shared#d=abc')
  })
})
