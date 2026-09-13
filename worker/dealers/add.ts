import { blankDealer } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'

import type { DiscogsClient } from '../discogs/client'
import { dealerSchema } from '../discogs/inventory'

/**
 * A shop entered by hand (M30).
 *
 * "I want to enter dealers myself, so they are there for future digs." Until
 * now a shop reached the list by being dug or by being imported from a
 * discovery run, so somebody who knows where they want to look before they
 * have looked had nowhere to put it — and the shops screen stayed a log of
 * what had happened rather than a list of where to go.
 *
 * The row it writes is a blank one, exactly as a hand-entered postage table
 * creates: the shop is known by name until a dig fills in the rest, and every
 * screen says so rather than showing a hit rate nobody measured.
 */
export async function addDealerByHand(
  client: DiscogsClient,
  username: string,
  signal?: AbortSignal,
): Promise<string> {
  /*
   * The name arrives already read out of whatever was pasted.
   *
   * `dealerFromInput` lives on the main thread because that is where the field
   * is, and it is what disables the button on anything that is neither a name
   * nor a shop address — the same arrangement the dig field has had since M20.
   * Moving it in here would be a second copy of a parser whose whole value is
   * that there is one.
   */

  /*
   * One request, and it is not optional.
   *
   * Writing the row without asking would put a typo in the list for ever,
   * where it would be offered on two screens and walked by every round. The
   * answer also carries the shop sign and where it ships from, which the
   * screens need before any dig has run.
   */
  const profile = await client.get(`/users/${encodeURIComponent(username)}`, dealerSchema, {
    signal,
  })

  const db = await openFidelityDb()
  const existing = await db.get('dealers', profile.username)

  await db.put('dealers', {
    ...(existing ?? blankDealer(profile.username)),
    displayName: existing?.displayName || profile.username,
    numForSale: profile.num_for_sale ?? existing?.numForSale ?? 0,
    sellerRating: profile.seller_rating ?? existing?.sellerRating ?? 0,
    ratingCount: profile.seller_num_ratings ?? existing?.ratingCount ?? 0,
    shipsFrom: profile.location || existing?.shipsFrom || '',
    avatarUrl: profile.avatar_url || existing?.avatarUrl,
    // Kept where there is one: a shop dug last week and typed in today was
    // still met by digging, and the first reason is the true one.
    addedBy: existing?.addedBy ?? 'manual',
    // Entering a shop by hand is asking for it, whatever was said before.
    hiddenAt: null,
    updatedAt: Date.now(),
  })

  return profile.username
}
