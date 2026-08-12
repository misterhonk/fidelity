/**
 * What a push from the hub becomes on a lock screen.
 *
 * Pulled out of the service worker because that is the one place in this app a
 * test cannot easily reach: notifications need a browser that will show them,
 * and a headless one refuses outright (measured 2026-08-12 — `showNotification`
 * throws "No notification permission has been granted", with permission
 * granted). The worker keeps the wiring; the wording lives here, where a unit
 * test can read it in both languages.
 *
 * The payload carries numbers and no words. The hub has no business knowing
 * what language somebody reads, and it does not: `{ dealer, newListings }`.
 */

export interface WatchPush {
  dealer: string
  newListings: number
}

/**
 * A push this app did not send is not shown.
 *
 * Every platform insists that a push results in *something* being displayed,
 * so the alternative to dropping it is an empty notification — a buzz with
 * nothing behind it, which is worse than the missing one.
 */
export function isWatchPush(data: unknown): data is WatchPush {
  const push = data as Partial<WatchPush> | null
  return (
    typeof push?.dealer === 'string' &&
    push.dealer !== '' &&
    typeof push.newListings === 'number' &&
    Number.isFinite(push.newListings)
  )
}

export interface Notice {
  title: string
  body: string
}

/**
 * The sentence, in the language the app was last set to.
 *
 * Worded as what the number actually is: the shop's total moved. It is *not* a
 * count of new records — a dealer who sells five and lists five moves by zero —
 * and "5 new records" would be a claim the data does not support. The same
 * wording as the banner in the app, on purpose: one fact, one phrasing.
 */
export function watchNotice(data: unknown, language: string): Notice | null {
  if (!isWatchPush(data)) return null

  const one = data.newListings === 1
  const listings =
    language === 'de'
      ? `${one ? 'Listing' : 'Listings'} mehr im Angebot als beim letzten Mal`
      : `${one ? 'listing' : 'listings'} more on offer than last time`

  return { title: data.dealer, body: `${data.newListings} ${listings}.` }
}
