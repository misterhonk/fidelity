import { describe, expect, it } from 'vitest'

import { watchNotice } from '#shared/notify'

/**
 * The sentence on a lock screen.
 *
 * It is here rather than in an end-to-end test for a measured reason: a
 * headless browser refuses to show a notification at all — `showNotification`
 * throws "No notification permission has been granted for this origin" even
 * with the permission granted, and a headed one shows it fine (2026-08-12). So
 * the browser test can prove the worker was reached and no more; everything
 * that is a decision rather than a call is decided here.
 */

describe('what a watch push says', () => {
  it('names the shop and how far its stock moved', () => {
    expect(watchNotice({ dealer: 'plattenladen', newListings: 12 }, 'en')).toEqual({
      title: 'plattenladen',
      body: '12 listings more on offer than last time.',
    })
  })

  it('speaks German when the app does', () => {
    expect(watchNotice({ dealer: 'plattenladen', newListings: 12 }, 'de')?.body).toBe(
      '12 Listings mehr im Angebot als beim letzten Mal.',
    )
  })

  it('counts one as one, in both languages', () => {
    expect(watchNotice({ dealer: 'a', newListings: 1 }, 'en')?.body).toBe(
      '1 listing more on offer than last time.',
    )
    expect(watchNotice({ dealer: 'a', newListings: 1 }, 'de')?.body).toBe(
      '1 Listing mehr im Angebot als beim letzten Mal.',
    )
  })

  /*
   * The wording is a promise about what the number is.
   *
   * `newListings` is how far the shop's *total* moved — somebody who sells
   * five and lists five moved by zero. "12 new records" would be a claim the
   * data cannot support, and it is the same phrasing the in-app banner uses so
   * that one fact is never told two ways.
   */
  it('never claims the records are new', () => {
    const notice = watchNotice({ dealer: 'a', newListings: 12 }, 'en')
    expect(notice?.body).not.toMatch(/\bnew\b/)
  })

  /*
   * A push this app did not send shows nothing.
   *
   * Every platform insists that a push results in something being displayed,
   * so the alternative to dropping it is an empty notification — a buzz with
   * nothing behind it, at an hour somebody did not choose.
   */
  it.each([
    ['nothing at all', null],
    ['a string', 'plattenladen'],
    ['no shop', { newListings: 3 }],
    ['an empty shop name', { dealer: '', newListings: 3 }],
    ['a count that is not a number', { dealer: 'a', newListings: '3' }],
    ['a count that is not finite', { dealer: 'a', newListings: Number.NaN }],
  ])('shows nothing for %s', (_what, payload) => {
    expect(watchNotice(payload, 'en')).toBeNull()
  })
})
