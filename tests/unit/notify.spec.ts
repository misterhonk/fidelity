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
 * Der Wurm im Ohr des Service Workers.
 *
 * Dieser Worker ist die letzte Strecke einer Kette über vier Beteiligte — Hub,
 * VAPID, der Push-Dienst der Plattform, der Browser — und war bis zum
 * 2026-08-13 die einzige ohne jede Möglichkeit zu berichten. Der Hub konnte
 * „zugestellt, kein Fehler" melden, während jemand auf ein stummes Telefon
 * sah, und es gab keinen Weg, „das Gerät hat nie etwas bekommen" von „das
 * Gerät hat es bekommen und nichts gezeigt" zu unterscheiden. Genau in dieser
 * Lücke sind an dem Tag drei Stunden verschwunden.
 *
 * Geprüft wird die Form, nicht das Verhalten: ein Service Worker läuft, wenn
 * keine Seite läuft, und seine Konsole ist von hier aus nicht erreichbar. Das
 * Verhalten steht in `tests/e2e/service-worker.spec.ts` — und das läuft nur
 * mit sichtbarem Browser, weil ein headless Chromium keine Benachrichtigung
 * zeigt.
 */
describe('what the service worker says out loud', () => {
  const SW = readFileSync('app/sw/sw.ts', 'utf8')

  it('reports every push before it does anything else', () => {
    // Vor `announce`, damit auch ein unlesbarer Inhalt noch als Ankunft gilt.
    const arrival = SW.indexOf("console.info('[fidelity] push arrived')")
    expect(arrival).toBeGreaterThan(-1)
    expect(arrival).toBeLessThan(SW.indexOf('event.waitUntil(announce('))
  })

  /**
   * Ein Inhalt, der kein JSON ist, darf den Handler nicht mitnehmen.
   *
   * `event.data.json()` wirft, und ein Wurf in `waitUntil` ist ein abgelehntes
   * Versprechen, das niemand sieht — die Benachrichtigung bliebe einfach aus.
   * An diesen Endpunkt darf jeder schicken, der die Adresse hat; nicht jeder
   * schickt, was hier erwartet wird.
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
   * Die Ablehnung von `showNotification` wird gefangen.
   *
   * Sie kommt, wenn die Erlaubnis fehlt oder — auf iOS — die App nicht vom
   * Home-Bildschirm läuft. Ungefangen steht der Fehlschlag nirgends: der Hub
   * meldet saubere Zustellung, der Bildschirm bleibt leer, und beides
   * zusammen ist die verwirrendste aller Auskünfte.
   */
  it('catches the refusal instead of rejecting into nowhere', () => {
    const shown = SW.indexOf('await self.registration.showNotification')
    const guard = SW.lastIndexOf('try {', shown)
    expect(guard).toBeGreaterThan(-1)
    expect(SW.indexOf('} catch (error) {', shown)).toBeGreaterThan(shown)
  })
})
