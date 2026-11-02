import type { Dealer, StaleStock } from '#shared/types'

/**
 * How much of a shop has been up on Discogs for more than five years (#244).
 *
 * A count, not a judgement: the screen says "41 % listed more than five years
 * ago (as of …, n = …)" and nothing about why. A shop's slow stock is a fact
 * about one dig, said to you alone — never shared, because a number like this
 * passed around about a named shop stops being a count (§ 824 BGB).
 *
 * Only listings that carry `posted` are in the denominator; one without a date
 * is not quietly counted as young.
 */
export class StaleStockCounter {
  readonly #cutoff: number
  #old = 0
  #dated = 0

  constructor(readonly asOf: number) {
    const cutoff = new Date(asOf)
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5)
    this.#cutoff = cutoff.getTime()
  }

  add(posted: string | null | undefined): void {
    const at = posted ? Date.parse(posted) : Number.NaN
    if (Number.isNaN(at)) return
    this.#dated += 1
    if (at < this.#cutoff) this.#old += 1
  }

  build(): StaleStock | null {
    return this.#dated === 0 ? null : { old: this.#old, dated: this.#dated, asOf: this.asOf }
  }
}

/** A dealer row as it may leave the device: without the stale-stock count. */
export function withoutStaleStock(dealer: Dealer): Dealer {
  const { staleStock: _private, ...rest } = dealer
  return rest
}
