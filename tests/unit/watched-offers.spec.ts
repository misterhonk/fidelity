import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { checkWatched } from '~~/worker/watched/check'
import { MAX_CONFIRM, seenOffers } from '~~/worker/watched/offers'
import type { DiscogsClient } from '~~/worker/discogs/client'
import type { Dig, Match, WatchedRelease } from '#shared/types'

/**
 * „Ein Angebot weniger" wird zu „die Kopie bei X ist weg" (M11).
 *
 * Der Wächter darf normalerweise keinen Laden nennen: `/marketplace/listings?
 * release_id=…` antwortet mit 405, und „wer verkauft Release X" ist per API
 * nicht beantwortbar. Die eine Ausnahme sind Angebote, an denen ein Dig dieses
 * Geräts selbst vorbeigekommen ist — die haben eine Listing-ID, und die ist
 * einzeln abrufbar.
 *
 * Was hier geprüft wird, ist deshalb vor allem **Zurückhaltung**: nur fragen,
 * wenn die Zahl gefallen ist, höchstens dreimal, und dieselbe Kopie nie
 * zweimal.
 */

const TAG = 24 * 60 * 60 * 1000
const JETZT = 1_800_000_000_000

const dig = (id: string, dealer: string, tageZurueck: number): Dig =>
  ({
    id,
    dealer,
    status: 'expired',
    startedAt: JETZT - tageZurueck * TAG,
    finishedAt: JETZT - tageZurueck * TAG,
    expiresAt: JETZT - tageZurueck * TAG,
    listingsTotal: 100,
    listingsScanned: 100,
    coverage: 1,
    uniqueSeen: 100,
    matchCount: 1,
  }) as unknown as Dig

const treffer = (digId: string, listingId: number, releaseId: number): Match =>
  ({
    digId,
    listingId,
    releaseId,
    score: 80,
    signals: [],
    expired: true,
  }) as unknown as Match

const beobachtet = (over: Partial<WatchedRelease> = {}): WatchedRelease => ({
  releaseId: 42,
  kind: 'shelf',
  artist: 'Alice Coltrane',
  title: 'Journey in Satchidananda',
  since: JETZT - 90 * TAG,
  threshold: null,
  // Von fünf auf zwei: `fewer` greift, also wird nachgefragt.
  points: [
    { at: JETZT - 60 * TAG, lowestPrice: 40, currency: 'EUR', numForSale: 5 },
    { at: JETZT - TAG, lowestPrice: 44, currency: 'EUR', numForSale: 2 },
  ],
  checkedAt: null,
  notifiedAt: null,
  ...over,
})

/** Ein Client, der Buch führt: erst die Statistik, dann die Angebote. */
function client(status: Record<number, string>) {
  const asked: string[] = []
  const fake = {
    get: async (path: string) => {
      asked.push(path)
      if (path.startsWith('/marketplace/stats/')) {
        return { lowest_price: { value: 44, currency: 'EUR' }, num_for_sale: 2 }
      }
      const id = Number(path.split('/').at(-1))
      return { id, status: status[id] ?? 'For Sale' }
    },
  } as unknown as DiscogsClient
  return { fake, asked }
}

beforeEach(async () => {
  const db = await openFidelityDb()
  for (const store of ['watched', 'digs', 'matches'] as const) await db.clear(store)
})

describe('the offers a dig walked past', () => {
  /**
   * Jüngstes zuerst, und jedes nur einmal.
   *
   * Dieselbe Kopie taucht in zwei Digs desselben Ladens auf — das ist ein
   * Angebot, keine zwei. Behalten wird der jüngere Fund, weil er sagt, wo es
   * zuletzt stand.
   */
  it('lists each offer once, newest first', async () => {
    const db = await openFidelityDb()
    /*
     * Die IDs sind absichtlich verdreht: `matches` liegt nach `[digId,
     * listingId]`, also läuft der **ältere** Dig als letzter durch. Ein
     * Zusammenfassen, das einfach den zuletzt gelesenen behält, käme damit
     * durch und stünde trotzdem falsch — eine Mutationsprobe hat genau das
     * gezeigt, solange beide Digs demselben Laden gehörten.
     */
    await db.put('digs', dig('zz-alt', 'staubkiste', 30))
    await db.put('digs', dig('aa-neu', 'plattenkiste', 2))
    await db.put('digs', dig('mm-woanders', 'vinyltresor', 10))
    await db.put('matches', treffer('zz-alt', 500, 42))
    await db.put('matches', treffer('aa-neu', 500, 42))
    await db.put('matches', treffer('mm-woanders', 600, 42))
    // Eine andere Platte im selben Dig geht das hier nichts an.
    await db.put('matches', treffer('aa-neu', 700, 99))

    const offers = await seenOffers(42)
    expect(offers.map((o) => o.listingId)).toEqual([500, 600])
    // Der jüngere Fund trägt den Laden, unter dem es zuletzt gesehen wurde.
    expect(offers[0]!.dealer).toBe('plattenkiste')
  })
})

describe('a copy that is no longer listed', () => {
  it('names the shop the dig walked past', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', treffer('d1', 500, 42))
    await db.put('watched', beobachtet())

    const { fake } = client({ 500: 'Sold' })
    const result = await checkWatched(fake, { now: () => JETZT, force: true })

    expect(result.news[0]!.news).toMatchObject({
      kind: 'gone',
      dealer: 'plattenkiste',
      listingId: 500,
    })
  })

  /**
   * Und beim nächsten Durchlauf kostet sie nichts mehr.
   *
   * Ohne dieses Gedächtnis fragt der Wächter dieselbe verschwundene Kopie
   * jeden Tag erneut ab und meldet sie jeden Tag erneut — ein Request für eine
   * Nachricht, die schon gelesen ist.
   */
  it('remembers it instead of asking again tomorrow', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', treffer('d1', 500, 42))
    await db.put('watched', beobachtet())

    const erste = client({ 500: 'Sold' })
    await checkWatched(erste.fake, { now: () => JETZT, force: true })
    expect(erste.asked).toContain('/marketplace/listings/500')

    const zweite = client({ 500: 'Sold' })
    await checkWatched(zweite.fake, { now: () => JETZT, force: true })
    expect(zweite.asked).not.toContain('/marketplace/listings/500')
    // Und ohne zweite Kopie bleibt es bei der Zahl.
    const news = (await checkWatched(client({}).fake, { now: () => JETZT, force: true })).news
    expect(news[0]!.news.kind).toBe('fewer')
  })

  /** Ein Angebot, das noch steht, ist keine Nachricht — nur ein Request. */
  it('says nothing when the copy is still for sale', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', treffer('d1', 500, 42))
    await db.put('watched', beobachtet())

    const { fake, asked } = client({ 500: 'For Sale' })
    const result = await checkWatched(fake, { now: () => JETZT, force: true })

    expect(asked).toContain('/marketplace/listings/500')
    expect(result.news[0]!.news.kind).toBe('fewer')
  })

  /**
   * Höchstens drei, auch wenn ein Dig zwanzig Exemplare gesehen hat.
   *
   * Der Wächter läuft über bis zu hundert Platten; ohne Deckel wäre ein
   * einziger gefallener Zähler ein Durchgang von einer halben Stunde.
   */
  it('asks at most three times', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    for (let i = 0; i < 8; i += 1) await db.put('matches', treffer('d1', 500 + i, 42))
    await db.put('watched', beobachtet())

    const { fake, asked } = client({})
    await checkWatched(fake, { now: () => JETZT, force: true })

    const listings = asked.filter((path) => path.startsWith('/marketplace/listings/'))
    expect(listings).toHaveLength(MAX_CONFIRM)
  })

  /**
   * Und gar nicht gefragt wird, solange die Zahl steht.
   *
   * Das ist der ganze Grund, warum das Feature bezahlbar ist: die teure
   * Nachfrage hängt an einem billigen Signal.
   */
  it('asks nothing at all while the count holds', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', treffer('d1', 500, 42))
    await db.put(
      'watched',
      beobachtet({
        points: [
          { at: JETZT - 60 * TAG, lowestPrice: 40, currency: 'EUR', numForSale: 2 },
          { at: JETZT - TAG, lowestPrice: 44, currency: 'EUR', numForSale: 2 },
        ],
      }),
    )

    const { fake, asked } = client({ 500: 'Sold' })
    await checkWatched(fake, { now: () => JETZT, force: true })

    expect(asked.filter((path) => path.startsWith('/marketplace/listings/'))).toEqual([])
  })
})
