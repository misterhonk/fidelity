import type { Page } from '@playwright/test'

import { DB_NAME } from '~~/db/schema'
import type {
  BasketItem,
  CollectionItem,
  Dealer,
  Dig,
  Identity,
  Match,
  Signal,
} from '#shared/types'

/**
 * A device that has already been used.
 *
 * Every browser test in this project ran signed out, on empty screens, and the
 * suite explained itself with "signed out is what a test can reach without a
 * token". That was never true. There is no backend (ADR-007), so every screen
 * in this app renders out of IndexedDB and nothing else — which means a test
 * can write the database directly and reach *all* of it without a token,
 * without a request, and without waiting for a scan.
 *
 * What that leaves untested is precisely the half worth testing. A find list, a
 * match card, a basket that sums postage, a shelf of records: none of them had
 * ever been rendered by anything but a person looking at a screen. Right after
 * moving thirty-six files' worth of text into message packs, the screens that
 * only exist when there is something to show are the ones most likely to be
 * broken and least likely to be noticed.
 *
 * **The database is created by the app, not by this file.** The seed navigates
 * first, lets `openFidelityDb` run its own upgrade, and only then writes rows
 * into stores that already exist. Recreating the schema here would be a second
 * copy of `db/open.ts` that nobody remembers to update — and it would fail in
 * the most misleading way possible, by testing screens against a shape the app
 * itself stopped using.
 */

/** Kept in the past on purpose — see `freshDig`. */
const SCANNED_AT = 1_760_000_000_000

const DEALER = 'plattenkiste'

/**
 * Two signals, so the reason sentence has a lead *and* a supporting clause.
 *
 * One signal would exercise the easy branch only. The sentence is assembled in
 * `app/i18n/reason.ts` as "<lead>, and <the rest>", and the join is the part
 * that differs per language and therefore the part that breaks.
 */
const SIGNALS: Signal[] = [
  { type: 'WANTLIST_EXACT', confidence: 1, evidence: {} },
  { type: 'LABEL_AFFINITY', confidence: 0.8, evidence: { label: 'Blue Note', owned: 14 } },
]

export const seedCollection: CollectionItem[] = [
  {
    releaseId: 1_390_017,
    masterId: 45_678,
    title: 'Speak No Evil',
    artistIds: [128_996],
    artistNorms: ['wayne shorter'],
    artistNames: ['Wayne Shorter'],
    labelIds: [157],
    labelNorms: ['blue note'],
    labelNames: ['Blue Note'],
    catnos: ['BST 84194'],
    genres: ['Jazz'],
    styles: ['Post Bop', 'Hard Bop'],
    formats: ['Vinyl', 'LP', 'Album'],
    year: 1966,
    thumbUrl: '',
    coverUrl: '',
    rating: 5,
    addedAt: '2024-03-02T10:00:00-00:00',
    // A record that came from a sync new enough to keep its entry: writable.
    instanceId: 811_002_001,
    folderId: 1,
  },
  {
    releaseId: 2_460_881,
    masterId: 12_345,
    title: 'Maiden Voyage',
    artistIds: [116_054],
    artistNorms: ['herbie hancock'],
    artistNames: ['Herbie Hancock'],
    labelIds: [157],
    labelNorms: ['blue note'],
    labelNames: ['Blue Note'],
    catnos: ['BST 84195'],
    genres: ['Jazz'],
    styles: ['Post Bop'],
    formats: ['Vinyl', 'LP', 'Album'],
    year: 1965,
    thumbUrl: '',
    coverUrl: '',
    rating: 4,
    addedAt: '2024-05-11T10:00:00-00:00',
    /*
     * And one that came from an older sync, on purpose.
     *
     * Zero is the state every record was in before entries were kept, and it
     * will stay reachable for anyone who has not synced since. The screens
     * have to say so instead of offering a button that silently does nothing —
     * which is only testable if a record in this state exists.
     */
    instanceId: 0,
    folderId: 0,
  },
]

/**
 * A dig that is still inside its six hours, relative to when the test runs.
 *
 * Not a fixed timestamp, and this is the one place a hardcoded date would
 * quietly destroy the test rather than fail it: every screen refuses to show a
 * price past `expiresAt` (rule 4), so a frozen `startedAt` would make the
 * suite pass on the day it was written and then render nothing but empty
 * placeholders forever after — green, because the assertions would have been
 * written against whatever it happened to show.
 */
export function freshDig(now: number): Dig {
  return {
    id: '01J0000000000000000000DIG1',
    dealer: DEALER,
    status: 'done',
    startedAt: now - 60_000,
    finishedAt: now - 30_000,
    expiresAt: now + 5 * 60 * 60 * 1000,
    listingsTotal: 2_881,
    listingsScanned: 2_881,
    coverage: 1,
    truncated: false,
    matchCount: 2,
    apiRequests: 29,
    cursor: null,
  }
}

export function seedMatches(digId: string): Match[] {
  return [
    {
      digId,
      listingId: 3_204_119_887,
      releaseId: 9_912_345,
      score: 92,
      signals: SIGNALS,
      title: 'Point of Departure',
      artist: 'Andrew Hill',
      label: 'Blue Note',
      catno: 'BST 84167',
      format: 'Vinyl, LP, Album, Reissue',
      year: 1965,
      condition: 'Near Mint (NM or M-)',
      sleeve: 'Very Good Plus (VG+)',
      price: 34,
      currency: 'EUR',
      comments: 'Gatefold, light ring wear',
      thumbUrl: null,
      marketLowestPrice: 29,
      marketNumForSale: 12,
      expired: false,
    },
    {
      digId,
      listingId: 3_204_119_912,
      releaseId: 9_912_999,
      score: 71,
      signals: [SIGNALS[1] as Signal],
      title: 'Unity',
      artist: 'Larry Young',
      label: 'Blue Note',
      catno: 'BST 84221',
      format: 'Vinyl, LP, Album',
      year: 1966,
      condition: 'Very Good Plus (VG+)',
      sleeve: 'Very Good Plus (VG+)',
      price: 21.5,
      currency: 'EUR',
      comments: null,
      thumbUrl: null,
      marketLowestPrice: 20,
      marketNumForSale: 5,
      expired: false,
    },
  ]
}

/**
 * Two lines from one shop, because one line cannot show what the basket is for.
 *
 * The whole screen exists to answer "does a second record make the postage
 * worth it", and that question needs two.
 */
export function seedBasket(now: number): BasketItem[] {
  return [
    {
      listingId: 3_204_119_887,
      dealer: DEALER,
      releaseId: 9_912_345,
      title: 'Andrew Hill — Point of Departure',
      price: 34,
      currency: 'EUR',
      addedAt: now - 120_000,
      note: null,
    },
    {
      listingId: 3_204_119_912,
      dealer: DEALER,
      releaseId: 9_912_999,
      title: 'Larry Young — Unity',
      price: 21.5,
      currency: 'EUR',
      addedAt: now - 60_000,
      note: null,
    },
  ]
}

export const seedDealer: Dealer = {
  username: DEALER,
  displayName: 'Plattenkiste',
  shipsFrom: 'Germany',
  sellerRating: 99.6,
  ratingCount: 4_812,
  numForSale: 2_881,
  minOrderTotal: 0,
  shippingNote: 'DE 4,50 EUR, EU 12,00 EUR',
  lastScannedAt: SCANNED_AT,
  affinity: 4.2,
  fingerprint: null,
  /*
   * A real tier, not an empty list. The basket's whole argument is "a second
   * record ships for the same 4,50 €", and with no tiers there is no argument
   * to render — the screen falls back to "postage unknown" and a test would
   * pass against nothing.
   *
   * `source: 'user'` specifically, and not because it reads nicer. That is the
   * only rung of `resolveShipping` that is settled locally: everything below it
   * consults a hub, a bundled file, or the free-text parser, and the parser's
   * answer depends on which country the preferences say you are in. A test that
   * went in that way would be quietly testing the parser — which has unit tests
   * of its own — instead of the screen.
   */
  shippingTiers: [
    { minItems: 1, maxItems: 3, price: 4.5, currency: 'EUR', source: 'user' },
    { minItems: 4, maxItems: null, price: 7, currency: 'EUR', source: 'user' },
  ],
}

export const seedIdentity: Identity = {
  userId: 1_234_567,
  username: 'mrtnmlchr',
  avatarUrl: '',
}

/** The stores this seed writes — and therefore the ones it waits for. */
const STORES = ['meta', 'collection', 'digs', 'matches', 'basket', 'dealers'] as const

/**
 * Waits until the app has finished creating its database.
 *
 * Deliberately a poll rather than a signal. There is no event to listen for —
 * the database is created inside the Web Worker, the first time something asks
 * it a question, and any DOM marker a test could watch for instead would be a
 * guess about which screen happens to ask first.
 *
 * The failure message matters as much as the wait. A `NotFoundError` five
 * frames deep inside `page.evaluate` reads like a broken app; "the app never
 * created its stores" reads like what it is.
 */
async function waitForStores(page: Page): Promise<void> {
  const deadline = Date.now() + 15_000
  let seen = 'nothing at all'

  while (Date.now() < deadline) {
    const state = await page.evaluate(async (name) => {
      const listed = await indexedDB.databases()
      if (!listed.some((db) => db.name === name)) return null

      const open = indexedDB.open(name)
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => resolve(null)
      })
      if (!db) return null

      const stores = [...db.objectStoreNames]
      db.close()
      return { version: db.version, stores }
    }, DB_NAME)

    if (state) {
      if (STORES.every((store) => state.stores.includes(store))) return
      seen = `version ${state.version} with [${state.stores.join(', ')}]`
    }

    await page.waitForTimeout(100)
  }

  throw new Error(
    `The app never finished creating its database — found ${seen}. ` +
      `Expected the stores [${STORES.join(', ')}] from db/open.ts.`,
  )
}

export type SeedLanguage = 'en' | 'de'

/**
 * Fills the database of an already-loaded page, then reloads so the screens
 * read it.
 *
 * The reload is not politeness. Every page in this app queries the worker once
 * on mount, so rows written after that mount are invisible until something
 * asks again — and a test that asserted against the pre-write render would
 * fail for a reason that has nothing to do with the code it is testing.
 */
export async function seed(page: Page, language: SeedLanguage = 'en'): Promise<Dig> {
  // The app's own code creates the database, at whatever version it is on.
  await page.goto('/')

  /*
   * Wait for it, and wait for it *without opening it*.
   *
   * `indexedDB.open(name)` with no version does not politely fail on a
   * database that does not exist yet — it creates an empty one at version 1.
   * Which would be a slow-acting disaster rather than a test failure: the app's
   * own `openDB(name, 4)` would then see `oldVersion === 1`, skip the
   * `oldVersion < 1` branch that creates every store, and arrive at version 4
   * with nothing in it. The seed would have permanently broken the schema it
   * exists to fill, in a way that looks like an app bug.
   *
   * `databases()` is no help either: it names the database while the upgrade
   * that creates the stores is still queued, so asking it and then opening
   * lands on a version 1 with nothing in it — measured, not assumed.
   *
   * So the seed does not try to detect readiness at all. It asks the browser
   * whether the stores are there, and if they are not, waits and asks again.
   * The app creates the database when its worker first needs it, which is a
   * moment no test should be trying to predict from the outside.
   */
  await waitForStores(page)

  const now = Date.now()
  const dig = freshDig(now)

  await page.evaluate(
    async (rows) => {
      const open = indexedDB.open(rows.name)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })

      const tx = db.transaction(rows.stores, 'readwrite')
      tx.objectStore('meta').put({ key: 'identity', value: rows.identity })
      tx.objectStore('meta').put({ key: 'token', value: 'test-token-not-a-real-one' })
      tx.objectStore('dealers').put(rows.dealer)
      tx.objectStore('digs').put(rows.dig)
      for (const item of rows.collection) tx.objectStore('collection').put(item)
      for (const match of rows.matches) tx.objectStore('matches').put(match)
      for (const line of rows.basket) tx.objectStore('basket').put(line)

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    {
      // Passed in rather than written out: `page.evaluate` runs in the browser
      // and cannot import, and a second copy of the database name is a second
      // thing to rename.
      name: DB_NAME,
      stores: [...STORES],
      identity: seedIdentity,
      dealer: seedDealer,
      dig,
      collection: seedCollection,
      matches: seedMatches(dig.id),
      basket: seedBasket(now),
    },
  )

  await page.evaluate((lang) => localStorage.setItem('fidelity:language', lang), language)
  await page.reload()

  /*
   * Wait for the reload to be finished with, not merely started.
   *
   * `page.reload()` resolves on `load`, which is before Nuxt has hydrated —
   * and hydration ends in a client-side navigation of its own. In WebKit that
   * navigation landed *after* the caller's `page.goto('/basket')` and cancelled
   * it: "Navigation to /basket is interrupted by another navigation to /".
   * Chromium happened to win the race. A test that passes in one engine and
   * not the other, for reasons that have nothing to do with the code under
   * test, is worse than one that fails in both.
   */
  await page.waitForLoadState('networkidle')

  return dig
}
