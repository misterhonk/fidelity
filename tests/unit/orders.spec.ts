import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { cleanOrderId, importOrder } from '~~/worker/orders'
import type { DiscogsClient } from '~~/worker/discogs/client'
import type { Feedback } from '#shared/types'

/**
 * Eine Bestellung einlesen (M14).
 *
 * Zwei Dinge tragen dieses Feature, und beide sind gemessen, nicht vermutet:
 *
 * 1. **`GET /marketplace/orders` ist die Verkäuferseite.** Für jemanden, der
 *    nur kauft, antwortet sie für immer mit `items: 0` — zweimal gemessen am
 *    2026-09-11, zehn Stunden auseinander. Deshalb die eingetippte Nummer:
 *    es gibt keinen API-Weg von „ich bin Käufer" zu „hier sind meine
 *    Bestellnummern".
 * 2. **`items[].id` ist die Listing-ID.** Belegt dadurch, dass
 *    `/marketplace/listings/{diese id}` mit 403 „authenticate as the owner"
 *    antwortet — ein verkauftes Angebot gehört nur noch seinem Verkäufer.
 *    Daran hängt, dass ein Import nichts verdoppelt.
 */

/** Die Form, die eine echte Antwort am 2026-09-11 hatte. */
const ANTWORT = {
  id: '259022-32308',
  created: '2026-09-11T00:33:31-07:00',
  seller: { username: '430AM_Studio', email: 'shop@example.invalid' },
  total: { value: 48.97, currency: 'EUR' },
  items: [
    {
      id: 4240795662,
      price: { value: 14.99, currency: 'EUR' },
      media_condition: 'Near Mint (NM or M-)',
      sleeve_condition: 'Very Good Plus (VG+)',
      condition_comments: 'tiny corner ding',
      release: { id: 201068, title: 'Something For Your Mind', artist: 'W.B.*' },
    },
    {
      id: 4240795728,
      price: { value: 16.99, currency: 'EUR' },
      media_condition: 'Mint (M)',
      sleeve_condition: 'Mint (M)',
      condition_comments: '',
      release: { id: 259733, title: 'Somewhere Over The Slippybergün', artist: 'W.B.*' },
    },
  ],
}

const GEKAUFT_AM = Date.parse(ANTWORT.created)
const JETZT = 1_800_000_000_000

function client(antwort: unknown = ANTWORT) {
  const gefragt: string[] = []
  const fake = {
    get: async (pfad: string, schema: { parse: (x: unknown) => unknown }) => {
      gefragt.push(pfad)
      return schema.parse(antwort)
    },
  } as unknown as DiscogsClient
  return { fake, gefragt }
}

beforeEach(async () => {
  const db = await openFidelityDb()
  await db.clear('feedback')
})

describe('the order number', () => {
  it('takes the shape a real one has', () => {
    expect(cleanOrderId('259022-32308')).toBe('259022-32308')
    expect(cleanOrderId('  259022-32308 ')).toBe('259022-32308')
  })

  /** Wer die Nummer im Browser kopiert, hat meistens die ganze Adresse. */
  it('takes a pasted address too', () => {
    expect(cleanOrderId('https://www.discogs.com/sell/order/259022-32308')).toBe('259022-32308')
  })

  /** Ein Vertipper soll keine Anfrage kosten. */
  it('refuses what cannot be one', () => {
    for (const unsinn of ['', '259022', 'abc-def', '259022–32308', 'W.B.*']) {
      expect(cleanOrderId(unsinn)).toBeNull()
    }
  })

  it('does not spend a request on a refused one', async () => {
    const { fake, gefragt } = client()
    expect(await importOrder(fake, 'gar keine Nummer')).toEqual({ ok: false, reason: 'shape' })
    expect(gefragt).toEqual([])
  })
})

describe('reading an order', () => {
  it('asks once and writes one bought row per record', async () => {
    const { fake, gefragt } = client()
    const ergebnis = await importOrder(fake, '259022-32308', JETZT)

    expect(gefragt).toEqual(['/marketplace/orders/259022-32308'])
    expect(ergebnis).toMatchObject({ ok: true, dealer: '430AM_Studio', added: 2, enriched: 0 })

    const db = await openFidelityDb()
    const zeile = await db.get('feedback', 4240795662)
    expect(zeile).toMatchObject({
      listingId: 4240795662,
      releaseId: 201068,
      dealer: '430AM_Studio',
      verdict: 'bought',
      title: 'Something For Your Mind',
    })
  })

  /**
   * Das Kaufdatum kommt aus der Bestellung, nicht von der Uhr.
   *
   * Daran hängt die Reifezeit: eine Bestellung von vor drei Wochen ist
   * angekommen, und ihre Frage ist sofort fällig. Mit `Date.now()` fingen alle
   * importierten Käufe bei null an, und der Import verschöbe genau die Frage,
   * für die es ihn gibt, um zehn Tage.
   */
  it('dates the purchase from the order, not from the clock', async () => {
    const { fake } = client()
    await importOrder(fake, '259022-32308', JETZT)

    const db = await openFidelityDb()
    expect((await db.get('feedback', 4240795662))?.createdAt).toBe(GEKAUFT_AM)
  })

  /**
   * Eine Platte, die ein Dig schon gefunden hat, wird ergänzt statt verdoppelt.
   *
   * Möglich, weil `items[].id` die Listing-ID ist. Und nötig, weil die Zeile
   * aus dem Dig Signale und eine Punktzahl trägt — die Auswertung, um
   * derentwillen dieser Store existiert.
   */
  it('enriches a row a dig already wrote instead of replacing it', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', {
      listingId: 4240795662,
      releaseId: 201068,
      title: 'Something For Your Mind',
      artist: 'W.B.*',
      dealer: '430AM_Studio',
      verdict: 'interesting',
      signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }],
      score: 71,
      createdAt: JETZT - 90 * 24 * 60 * 60 * 1000,
    } as unknown as Feedback)

    const { fake } = client()
    const ergebnis = await importOrder(fake, '259022-32308', JETZT)
    expect(ergebnis).toMatchObject({ added: 1, enriched: 1 })

    const zeile = await db.get('feedback', 4240795662)
    expect(zeile?.verdict).toBe('bought')
    expect(zeile?.score).toBe(71)
    expect(zeile?.signals).toHaveLength(1)
  })

  /**
   * Und ein Urteil, das schon da ist, bleibt.
   *
   * Wer bereits geantwortet hat, wie die Platte ankam, soll nach einem Import
   * nicht erneut gefragt werden — sonst ist der Import eine Maschine, die die
   * eigene Arbeit zurücksetzt.
   */
  it('leaves an answer that was already given', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', {
      listingId: 4240795662,
      releaseId: 201068,
      verdict: 'bought',
      arrived: 'worse',
      arrivedAt: JETZT - 1000,
      signals: [],
      score: 0,
      createdAt: JETZT - 1000,
    } as unknown as Feedback)

    const { fake } = client()
    await importOrder(fake, '259022-32308', JETZT)

    expect((await db.get('feedback', 4240795662))?.arrived).toBe('worse')
  })
})

describe('what an order never brings along', () => {
  /**
   * **Die versprochene Note, der Preis und die Adresse des Verkäufers.**
   *
   * Die Antwort enthält alle drei — `media_condition`, `sleeve_condition`,
   * `condition_comments`, `price` und `seller.email`. Das Zod-Schema an der
   * Grenze nennt keines davon, also existiert keines dahinter. Geprüft wird
   * am geschriebenen Datensatz und am Quelltext, weil beides schiefgehen kann:
   * ein Feld durchreichen, und ein Feld nachträglich ins Schema nehmen.
   */
  it('stores neither the promised grade nor the price nor an address', async () => {
    const { fake } = client()
    await importOrder(fake, '259022-32308', JETZT)

    const db = await openFidelityDb()
    const geschrieben = JSON.stringify(await db.getAll('feedback'))

    expect(geschrieben).not.toMatch(/Near Mint|Very Good|Mint \(M\)/)
    expect(geschrieben).not.toMatch(/corner ding/)
    expect(geschrieben).not.toMatch(/14\.99|16\.99|48\.97/)
    expect(geschrieben).not.toMatch(/example\.invalid|email/)

    const quelle = readFileSync('worker/orders.ts', 'utf8')
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const verboten of [
      'media_condition',
      'sleeve_condition',
      'condition_comments',
      'price',
      'email',
    ]) {
      expect(code).not.toContain(verboten)
    }
  })

  /** Und es geht nichts hinaus, was nicht angefragt wurde. */
  it('asks Discogs for one order and nothing else', async () => {
    const { fake, gefragt } = client()
    await importOrder(fake, '259022-32308', JETZT)
    expect(gefragt).toHaveLength(1)
  })
})
