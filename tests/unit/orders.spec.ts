import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

import { openFidelityDb } from '~~/db/open'
import { cleanOrderId, importOrder } from '~~/worker/orders'
import type { DiscogsClient } from '~~/worker/discogs/client'
import type { Feedback } from '#shared/types'

/**
 * Reading an order (M14).
 *
 * Two things carry this feature, and both are measured, not assumed:
 *
 * 1. **`GET /marketplace/orders` is the seller side.** For somebody who only
 *    buys it answers `items: 0` forever — measured twice on 2026-09-11, ten
 *    hours apart. Hence the typed-in number: there is no API route from "I am
 *    the buyer" to "here are my order numbers".
 * 2. **`items[].id` is the listing id.** Evidenced by
 *    `/marketplace/listings/{that id}` answering 403 "authenticate as the
 *    owner" — a sold listing belongs only to its seller. That an import
 *    duplicates nothing hangs on it.
 */

/** The shape a real answer had on 2026-09-11. */
const ANSWER = {
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

const BOUGHT_AT = Date.parse(ANSWER.created)
const JETZT = 1_800_000_000_000

function client(answer: unknown = ANSWER) {
  const gefragt: string[] = []
  const fake = {
    get: async (path: string, schema: { parse: (x: unknown) => unknown }) => {
      gefragt.push(path)
      return schema.parse(answer)
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

  /** Anyone copying the number in a browser usually has the whole address. */
  it('takes a pasted address too', () => {
    expect(cleanOrderId('https://www.discogs.com/sell/order/259022-32308')).toBe('259022-32308')
  })

  /** A typo should cost no request. */
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
    const result = await importOrder(fake, '259022-32308', JETZT)

    expect(gefragt).toEqual(['/marketplace/orders/259022-32308'])
    expect(result).toMatchObject({ ok: true, dealer: '430AM_Studio', added: 2, enriched: 0 })

    const db = await openFidelityDb()
    const row = await db.get('feedback', 4240795662)
    expect(row).toMatchObject({
      listingId: 4240795662,
      releaseId: 201068,
      dealer: '430AM_Studio',
      verdict: 'bought',
      title: 'Something For Your Mind',
    })
  })

  /**
   * The purchase date comes from the order, not from the clock.
   *
   * The ripening time hangs on it: an order from three weeks ago has arrived,
   * and its question is due immediately. With `Date.now()` every imported
   * purchase would start at zero, and the import would push out by ten days
   * exactly the question it exists for.
   */
  it('dates the purchase from the order, not from the clock', async () => {
    const { fake } = client()
    await importOrder(fake, '259022-32308', JETZT)

    const db = await openFidelityDb()
    expect((await db.get('feedback', 4240795662))?.createdAt).toBe(BOUGHT_AT)
  })

  /**
   * A record a dig has already found is filled out, not duplicated.
   *
   * Possible because `items[].id` is the listing id. And necessary because the
   * row from the dig carries signals and a score — the appraisal this store
   * exists for.
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
    const result = await importOrder(fake, '259022-32308', JETZT)
    expect(result).toMatchObject({ added: 1, enriched: 1 })

    const row = await db.get('feedback', 4240795662)
    expect(row?.verdict).toBe('bought')
    expect(row?.score).toBe(71)
    expect(row?.signals).toHaveLength(1)
  })

  /**
   * And a verdict that is already there stays.
   *
   * Anyone who has answered how the record arrived should not be asked again
   * after an import — or the import is a machine that undoes its own work.
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
   * **The promised grade, the price and the seller's address.**
   *
   * The answer contains all three — `media_condition`, `sleeve_condition`,
   * `condition_comments`, `price` and `seller.email`. The Zod schema at the
   * boundary names none of them, so none exists behind it. Both the written
   * record and the source are checked, because both can go wrong: passing a
   * field through, and adding a field to the schema later.
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
    const code = withoutComments(quelle)
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

  /** And nothing goes out that was not asked for. */
  it('asks Discogs for one order and nothing else', async () => {
    const { fake, gefragt } = client()
    await importOrder(fake, '259022-32308', JETZT)
    expect(gefragt).toHaveLength(1)
  })
})
