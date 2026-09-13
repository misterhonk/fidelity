import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { setMeta, updatePreferences } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { suggestShops } from '~~/worker/dealers/suggest'
import type { Dealer, DealerFingerprint, TasteProfile } from '#shared/types'

afterEach(async () => {
  await deleteFidelityDb()
  vi.unstubAllGlobals()
})

/**
 * Shops other people have dug (ADR-014).
 *
 * The first thing the hub carries that is about a shop rather than a record,
 * so most of what has to hold is the line that ADR draws: a name and a
 * distribution go up, a price and an affinity never do, and the ranking
 * happens here against a collection the hub never sees.
 */
const NOW = 1_800_000_000_000

const fingerprint = (labelDist: Record<string, number>): DealerFingerprint => ({
  sampledItems: 100,
  totalItems: 4_000,
  coverage: 0.025,
  labelDist,
  styleDist: {},
  decadeDist: { 1960: 40 },
  medianPrice: 22.75,
  priceCurrency: 'EUR',
})

async function localShop(username: string, over: Partial<Dealer> = {}) {
  const db = await openFidelityDb()
  await db.put('dealers', {
    ...blankDealer(username),
    displayName: username,
    numForSale: 4_000,
    lastScannedAt: NOW - 1_000,
    affinity: 4.2,
    fingerprint: fingerprint({ 'Blue Note': 40, Impulse: 10 }),
    ...over,
  })
}

/** A shelf with two labels on it. */
async function shelfWith(...labels: string[]) {
  const taste: TasteProfile = {
    releaseCount: 20,
    artists: {},
    labels: Object.fromEntries(
      labels.map((name, index) => [
        String(500 + index),
        { name, n: 5, weight: 0.25, lift: null },
      ]),
    ),
    styles: {},
    decades: {},
    computedAt: NOW,
  } as unknown as TasteProfile
  await setMeta('tasteProfile', taste)
}

const hubShop = (username: string, labelDist: Record<string, number>) => ({
  username,
  displayName: username,
  shipsFrom: 'Germany',
  numForSale: 5_000,
  avatarUrl: '',
  seenAt: NOW - 3_600_000,
  fingerprint: {
    sampledItems: 100,
    totalItems: 5_000,
    coverage: 0.02,
    labelDist,
    styleDist: {},
    decadeDist: {},
  },
})

/** Answers the hub's two routes and records what was sent. */
function fakeHub(shops: ReturnType<typeof hubShop>[]) {
  const sent: { url: string; body: unknown }[] = []
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'PUT') {
      sent.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({ stored: true }), { status: 200 })
    }
    return new Response(JSON.stringify({ shops }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchImpl)
  return { sent, fetchImpl }
}

describe('shops other people have dug', () => {
  it('asks nobody when there is no hub, and says so', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)

    await expect(suggestShops(NOW)).resolves.toEqual({ shops: [], shared: 0, hub: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  /*
   * The line ADR-014 draws, as a test rather than a promise. `affinity` is the
   * hit rate against *one* collection — a statement about a person — and the
   * median is the fingerprint's only marketplace number.
   */
  it('sends the name and what a shop stocks, never a price and never an affinity', async () => {
    await updatePreferences({ hubUrl: 'https://hub.test' })
    await shelfWith('Blue Note')
    await localShop('plattenkiste')
    const { sent } = fakeHub([])

    const result = await suggestShops(NOW)

    expect(result.shared).toBe(1)
    const [put] = sent
    expect(put?.url).toContain('/v1/shops/plattenkiste')

    const body = put?.body as Record<string, unknown>
    expect(body).toMatchObject({
      displayName: 'plattenkiste',
      shipsFrom: '',
      numForSale: 4_000,
    })
    expect(body.affinity).toBeUndefined()
    expect((body.fingerprint as Record<string, unknown>).medianPrice).toBeUndefined()
    expect((body.fingerprint as Record<string, unknown>).priceCurrency).toBeUndefined()
    expect((body.fingerprint as Record<string, unknown>).labelDist).toEqual({
      'Blue Note': 40,
      Impulse: 10,
    })
  })

  it('sends a shop once, and again only after a newer dig', async () => {
    await updatePreferences({ hubUrl: 'https://hub.test' })
    await shelfWith('Blue Note')
    await localShop('plattenkiste')
    const { sent } = fakeHub([])

    await suggestShops(NOW)
    expect(sent.length).toBe(1)

    // Nothing has changed about the shop, so nothing goes up.
    await suggestShops(NOW + 60_000)
    expect(sent.length).toBe(1)

    // A newer dig has learned something new; now it is worth sending.
    await localShop('plattenkiste', { sharedAt: NOW, lastScannedAt: NOW + 120_000 })
    await suggestShops(NOW + 180_000)
    expect(sent.length).toBe(2)
  })

  it('ranks by how much of a shop sits on labels you collect', async () => {
    await updatePreferences({ hubUrl: 'https://hub.test' })
    await shelfWith('Blue Note', 'Impulse')
    fakeHub([
      hubShop('jazzy', { 'Blue Note': 30, Impulse: 20, Verve: 50 }),
      hubShop('mostly-jazz', { 'Blue Note': 10, Kompakt: 90 }),
      hubShop('technoid', { Kompakt: 100 }),
    ])

    const { shops } = await suggestShops(NOW)

    expect(shops.map((shop) => shop.username)).toEqual(['jazzy', 'mostly-jazz'])
    // Half its sampled stock is on labels from the shelf.
    expect(shops[0]?.fit).toBeCloseTo(0.5)
    // And the labels behind the number, so it has a reason.
    expect(shops[0]?.labels).toEqual(['Blue Note', 'Impulse'])
  })

  it('does not suggest a shop this device already knows', async () => {
    await updatePreferences({ hubUrl: 'https://hub.test' })
    await shelfWith('Blue Note')
    await localShop('plattenkiste')
    fakeHub([hubShop('Plattenkiste', { 'Blue Note': 50 })])

    const { shops } = await suggestShops(NOW)
    expect(shops).toEqual([])
  })

  it('answers empty when the hub does not, and throws nothing', async () => {
    await updatePreferences({ hubUrl: 'https://hub.test' })
    await shelfWith('Blue Note')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    await expect(suggestShops(NOW)).resolves.toEqual({ shops: [], shared: 0, hub: true })
  })
})
