import { describe, expect, it } from 'vitest'

import { shelfSample } from '~~/worker/dealers/shelf'
import type { CollectionItem, Dealer } from '#shared/types'
import { norm } from '~~/worker/match/normalize'

/**
 * Four records of your own on the labels a shop carries (M31.4).
 *
 * A shop described in numbers is a shop nobody pictures. This turns the same
 * fact the bars carry — "stocks Kompakt, Ostgut Ton, Dekmantel" — into sleeves
 * from the collection, which say in half a second what the bars say in ten.
 */
function shelf(labels: string[]): CollectionItem[] {
  return labels.map((label, index) => ({
    releaseId: 100 + index,
    masterId: 0,
    title: `Record ${index}`,
    artistIds: [],
    artistNorms: ['someone'],
    artistNames: ['Someone'],
    labelIds: [],
    labelNorms: [norm(label)],
    labelNames: [label],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 2000,
    thumbUrl: '',
    coverUrl: '',
    addedAt: '2024-01-01T00:00:00-00:00',
  })) as CollectionItem[]
}

function dealer(labelDist: Record<string, number>): Dealer {
  return {
    username: 'shop',
    displayName: 'Shop',
    shipsFrom: '',
    sellerRating: 100,
    ratingCount: 1,
    numForSale: 10,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: null,
    affinity: null,
    fingerprint: {
      sampledItems: 100,
      totalItems: 100,
      coverage: 1,
      labelDist,
      styleDist: {},
      decadeDist: {},
      medianPrice: 0,
    },
    shippingTiers: [],
  } as Dealer
}

/**
 * A database stub: the one call this makes is a read through the `by-label`
 * index (M34.4) — one label's records, as a multi-entry index answers it.
 */
function db(items: CollectionItem[]) {
  return {
    getAllFromIndex: async (store: string, index: string, key: string) =>
      store === 'collection' && index === 'by-label'
        ? items.filter((item) => item.labelNorms.includes(key))
        : [],
  } as never
}

describe('the shelf sample', () => {
  it('takes one record per label, strongest label first', async () => {
    const found = await shelfSample(
      db(shelf(['Kompakt', 'Ostgut Ton', 'Dekmantel'])),
      dealer({ Kompakt: 120, 'Ostgut Ton': 80, Dekmantel: 40 }),
    )

    expect(found.map((record) => record.label)).toEqual(['Kompakt', 'Ostgut Ton', 'Dekmantel'])
  })

  /**
   * Four sleeves off one label describe the label, not the shop — and a shop
   * with a hundred and twenty Kompakt records would otherwise show four
   * Kompakt sleeves and nothing else.
   */
  it('never shows the same record twice, nor one label four times', async () => {
    const many = shelf(['Kompakt', 'Kompakt', 'Kompakt', 'Kompakt'])
    const found = await shelfSample(db(many), dealer({ Kompakt: 400 }))

    expect(found).toHaveLength(1)
  })

  it('stops at four', async () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const found = await shelfSample(
      db(shelf(labels)),
      dealer(Object.fromEntries(labels.map((label, index) => [label, 100 - index]))),
    )

    expect(found).toHaveLength(4)
  })

  /**
   * Compared on the plain lowered name: `labelDist` is built from inventory
   * rows and the collection comes from the sync — two pipelines, and the only
   * thing they are guaranteed to agree on is the name Discogs writes.
   */
  it('matches a label whatever it is capitalised as', async () => {
    const found = await shelfSample(db(shelf(['Blue Note'])), dealer({ 'BLUE NOTE': 12 }))
    expect(found).toHaveLength(1)
  })

  it('says nothing rather than guessing', async () => {
    expect(await shelfSample(db(shelf(['Kompakt'])), dealer({}))).toEqual([])
    expect(await shelfSample(db([]), dealer({ Kompakt: 10 }))).toEqual([])

    const noPrint = { ...dealer({ Kompakt: 10 }), fingerprint: null }
    expect(await shelfSample(db(shelf(['Kompakt'])), noPrint)).toEqual([])
  })
})
