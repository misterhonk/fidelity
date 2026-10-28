import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { addPastedListings, parseListingIds } from '~~/worker/basket/listings'

/**
 * Was Leute wirklich einfügen.
 *
 * The Discogs cart is not readable over the API, so the way into the basket is
 * a paste: an address bar, three address bars, a column of numbers copied out
 * of somewhere. Being forgiving about the shape is the whole feature — and not
 * guessing is what keeps it trustworthy, because a wrong id costs a request
 * and produces a record nobody chose.
 */
describe('parseListingIds', () => {
  it('reads a plain listing url', () => {
    expect(parseListingIds('https://www.discogs.com/sell/item/1260275694')).toEqual([
      1260275694,
    ])
  })

  it('reads the shop address Discogs uses since September 2026', () => {
    expect(parseListingIds('https://www.discogs.com/shop/item/1260275694')).toEqual([
      1260275694,
    ])
  })

  it('survives a language segment and a tracking query', () => {
    expect(
      parseListingIds('https://www.discogs.com/de/sell/item/1260346497?ev=rb&format=Vinyl'),
    ).toEqual([1260346497])
  })

  it('takes several at once, in the order they were pasted', () => {
    const pasted = `
      https://www.discogs.com/sell/item/111111111
      https://www.discogs.com/sell/item/222222222
      https://www.discogs.com/sell/item/333333333
    `
    expect(parseListingIds(pasted)).toEqual([111111111, 222222222, 333333333])
  })

  it('accepts bare ids on their own lines', () => {
    expect(parseListingIds('1260275694\n1260346497')).toEqual([1260275694, 1260346497])
  })

  it('asks for each listing once, however often it was pasted', () => {
    // One request per listing is the cost, and paying it twice for the same
    // record is the easiest way to waste somebody's rate limit.
    const pasted = 'https://www.discogs.com/sell/item/999999999\n999999999'
    expect(parseListingIds(pasted)).toEqual([999999999])
  })

  it('does not mine numbers out of a url it has already read', () => {
    /*
     * `?ev=rb&offer=1234567890` next to a real listing id is the failure that
     * matters: it would look like a second record, cost a request, and come
     * back as something the person never put in their cart.
     */
    expect(
      parseListingIds('https://www.discogs.com/sell/item/1260275694?offer=1234567890'),
    ).toEqual([1260275694])
  })

  it('ignores prose, years and prices', () => {
    expect(parseListingIds('Booka Shade, 2006, 14,99 € — zwei Platten')).toEqual([])
  })

  it('says nothing about an empty paste', () => {
    expect(parseListingIds('   \n  ')).toEqual([])
  })
})

describe('addPastedListings', () => {
  afterEach(async () => {
    await deleteFidelityDb()
  })

  it('does not file a for-sale listing with no price as a fresh €0 line', async () => {
    const get = vi.fn(async (_path: string, schema: { parse: (v: unknown) => unknown }) =>
      schema.parse({
        id: 7,
        status: 'For Sale',
        price: { value: null, currency: 'EUR' },
        seller: { username: '430AM_Studio' },
        release: { id: 70, title: 'Dummy', artist: 'Portishead' },
      }),
    )

    const result = await addPastedListings({
      client: { get } as unknown as DiscogsClient,
      ids: [7],
      currency: 'EUR',
      now: 1_800_000_000_000,
    })

    expect(result).toMatchObject({ added: 0, unknown: 1 })
    expect(await (await openFidelityDb()).get('basket', 7)).toBeUndefined()
  })
})
