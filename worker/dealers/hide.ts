import { blankDealer, isHidden } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'
import type { Dealer } from '#shared/types'

/**
 * Hiding a shop (docs/06 M19 #2).
 *
 * "Never show this one again" — asked for on Discogs since 2015 and the one
 * feature the Enhancer extension puts behind its paywall. Here it is a field
 * on the dealer row, like watching: a property of that shop, not a second
 * store keyed by the same name.
 *
 * Hidden means gone from every list this app draws — the shops screen, the
 * start page, the dig chips, the palette, the discovery suggestions — and no
 * longer watched, because a notification about a shop you asked never to see
 * would be the app contradicting itself. It does *not* stop a dig you start by
 * name: typing a shop is asking for it, and a finished dig brings the shop
 * back (`worker/dig/scan.ts`, `finishDealer`).
 */

export async function setHidden(
  username: string,
  hidden: boolean,
  now = Date.now(),
): Promise<Dealer> {
  const db = await openFidelityDb()
  const existing = await db.get('dealers', username)

  // A suggestion somebody hides has no row yet. It gets one, so the next
  // discovery run knows to leave it out — that is the whole point.
  const updated: Dealer = {
    ...(existing ?? blankDealer(username)),
    hiddenAt: hidden ? now : null,
    updatedAt: now,
  }
  if (hidden) {
    updated.watching = false
    updated.watchNumForSale = null
    updated.watchCheckedAt = null
  }

  await db.put('dealers', updated)
  return updated
}

/** Every shop that is not hidden — what every list starts from. */
export async function visibleDealers(): Promise<Dealer[]> {
  const db = await openFidelityDb()
  return (await db.getAll('dealers')).filter((dealer) => !isHidden(dealer))
}

/** The hidden ones, by name — for the one place they can be brought back. */
export async function hiddenDealers(): Promise<Dealer[]> {
  const db = await openFidelityDb()
  return (await db.getAll('dealers'))
    .filter((dealer) => isHidden(dealer))
    .sort((a, b) => a.username.localeCompare(b.username))
}
