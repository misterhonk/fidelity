import { readFileSync } from 'node:fs'

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

/**
 * The service worker's ear.
 *
 * This worker is the last leg of a chain across four parties — hub, VAPID, the
 * platform's push service, the browser — and until 2026-08-13 it was the only
 * one with no way of reporting anything. The hub could say "delivered, no
 * error" while somebody looked at a silent phone, and there was no way to tell
 * "the device never got anything" from "the device got it and showed nothing".
 * Three hours disappeared into that gap on that day.
 *
 * The shape is checked, not the behaviour: a service worker runs when no page
 * runs, and its console is not reachable from here. The behaviour is in
 * `tests/e2e/service-worker.spec.ts` — and that runs only with a visible
 * browser, because a headless Chromium shows no notification.
 */
describe('what the service worker says out loud', () => {
  const SW = readFileSync('app/sw/sw.ts', 'utf8')

  it('reports every push before it does anything else', () => {
    // Before `announce`, so that unreadable content still counts as an arrival.
    const arrival = SW.indexOf("console.info('[fidelity] push arrived')")
    expect(arrival).toBeGreaterThan(-1)
    expect(arrival).toBeLessThan(SW.indexOf('event.waitUntil(announce('))
  })

  /**
   * Content that is not JSON must not take the handler down with it.
   *
   * `event.data.json()` throws, and a throw inside `waitUntil` is a rejected
   * promise nobody sees — the notification would simply not appear. Anybody
   * with the address may send to this endpoint; not everybody sends what is
   * expected here.
   */
  it('survives a payload that is not JSON, and says so', () => {
    expect(SW).toMatch(/try \{\s*data = event\.data\?\.json\(\)/)
    expect(SW).toMatch(/push carried nothing readable/)
  })

  /** Und Schweigen bekommt einen Grund statt gar keiner Spur. */
  it('names the two silences apart', () => {
    expect(SW).toMatch(/push was not the watchman speaking/)
    expect(SW).toMatch(/the system refused to show it/)
  })

  /**
   * A rejection from `showNotification` is caught.
   *
   * It comes when permission is missing or — on iOS — when the app is not
   * running from the home screen. Uncaught, the failure is recorded nowhere:
   * the hub reports clean delivery, the screen stays empty, and the two
   * together are the most confusing piece of information of all.
   */
  it('catches the refusal instead of rejecting into nowhere', () => {
    const shown = SW.indexOf('await self.registration.showNotification')
    const guard = SW.lastIndexOf('try {', shown)
    expect(guard).toBeGreaterThan(-1)
    expect(SW.indexOf('} catch (error) {', shown)).toBeGreaterThan(shown)
  })
})
