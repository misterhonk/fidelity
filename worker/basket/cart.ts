import { blankDealer } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'

import type { CartBlock, Money } from './parse-cart'
import { readOffShipping } from './profiles'

/**
 * What a pasted cart page teaches about each shop (M34.3).
 *
 * Three facts per shop, all of them Discogs' own arithmetic for this buyer's
 * address, none of them available from any endpoint for more than one record:
 *
 * - the postage for exactly this many records, kept as a user tier the way
 *   the read-off field keeps one — and where the page says "add up to 42
 *   more at no additional shipping cost", the tier runs that far;
 * - the free-postage threshold, kept on the dealer so the card can say how
 *   far the basket is from it;
 * - the minimum order, from the shortfall the page names below the sum.
 *
 * No listing ids are on the page, so no basket line comes out of it. The
 * records themselves still arrive by link.
 */
export interface CartNote {
  dealer: string
  records: number
  postage: Money | null
  /** The last count the postage is known to cover. */
  upTo: number | null
  freeOver: Money | null
  minOrderTotal: number | null
}

const cents = (value: number) => Math.round(value * 100)

export async function noteCart(blocks: CartBlock[], now: number): Promise<CartNote[]> {
  const db = await openFidelityDb()
  const notes: CartNote[] = []

  for (const block of blocks) {
    const known = block.records > 0 && block.postage !== null
    const upTo = known ? block.records + (block.moreAtNoExtra ?? 0) : null

    if (known) {
      await readOffShipping(
        block.dealer,
        block.records,
        block.postage!.value,
        block.postage!.currency,
        upTo!,
      )
    }

    const minOrderTotal =
      block.minOrderShort && block.subtotal
        ? (cents(block.subtotal.value) + cents(block.minOrderShort.value)) / 100
        : null

    if (block.freeOver || minOrderTotal !== null) {
      const existing = (await db.get('dealers', block.dealer)) ?? blankDealer(block.dealer)
      await db.put('dealers', {
        ...existing,
        freeOver: block.freeOver
          ? { amount: block.freeOver.value, currency: block.freeOver.currency }
          : (existing.freeOver ?? null),
        minOrderTotal: minOrderTotal ?? existing.minOrderTotal,
        updatedAt: now,
      })
    }

    if (known || block.freeOver || minOrderTotal !== null) {
      notes.push({
        dealer: block.dealer,
        records: block.records,
        postage: block.postage,
        upTo,
        freeOver: block.freeOver,
        minOrderTotal,
      })
    }
  }

  return notes
}
