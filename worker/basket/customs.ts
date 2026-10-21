import { unitsOf } from '#shared/shipping'
import type { ImportCharges } from '#shared/types'

/**
 * What a parcel from outside the EU costs on top of its price and postage.
 *
 * Two things, and Discogs' cart shows only one of them:
 *
 * - **Customs duty.** Since 1 July 2026 a flat €3 per tariff sub-heading in a
 *   parcel worth under €150 — an interim rule until 1 July 2028, agreed by the
 *   Council on 2025-12-12 and adopted on 2026-02-11. Two LPs are one
 *   sub-heading and €3; an LP and a CD are two and €6. Discogs says outright
 *   that it does not collect it at checkout: the seller pays it when buying
 *   the label and prices it into the postage, or the carrier asks at the door
 *   (Discogs Help, "Import and Customs Charges Guide", edited 2026-10-06).
 *   Over €150 the ordinary rules apply, and what they come to for a parcel of
 *   records is not something this file can say — so it says nothing.
 * - **Import VAT** at the destination's standard rate. Under €150 Discogs
 *   charges it at checkout (it is the deemed supplier); over €150 it is paid
 *   at import, on goods, postage and duty together.
 *
 * Everything here is an estimate and called one on screen. It is only worked
 * out in euros: the €3 and the €150 are euro figures, and a browser has no
 * exchange rate it may trust (the reason the basket refuses mixed currencies).
 */

/** The flat duty per tariff sub-heading, and the parcel value it applies under. */
export const FLAT_DUTY_EUR = 3
export const FLAT_DUTY_UNDER_EUR = 150

/**
 * Standard VAT rates of the 27, in per cent, as of October 2026 — recorded
 * music is standard-rated everywhere. Keyed by the English names Discogs'
 * `ships_from` and `Intl.DisplayNames` use; both spellings where they differ.
 */
export const EU_VAT_RATES: Readonly<Record<string, number>> = {
  Austria: 20,
  Belgium: 21,
  Bulgaria: 20,
  Croatia: 25,
  Cyprus: 19,
  'Czech Republic': 21,
  Czechia: 21,
  Denmark: 25,
  Estonia: 24,
  Finland: 25.5,
  France: 20,
  Germany: 19,
  Greece: 24,
  Hungary: 27,
  Ireland: 23,
  Italy: 22,
  Latvia: 21,
  Lithuania: 21,
  Luxembourg: 17,
  Malta: 18,
  Netherlands: 21,
  Poland: 23,
  Portugal: 23,
  Romania: 21,
  Slovakia: 23,
  Slovenia: 22,
  Spain: 21,
  Sweden: 25,
}

export function inEu(country: string | null | undefined): boolean {
  return Boolean(country && country.trim() in EU_VAT_RATES)
}

/** Cents, so the sums do not drift (CLAUDE.md: never float for money). */
const cents = (amount: number) => Math.round(amount * 100)

/**
 * The charges for one parcel, or null where none apply or none can be told.
 *
 * Null when the shop is inside the EU or its country is unknown, when the
 * destination is outside the EU, or when the basket is not in euros.
 * `subtotal` and `shipping` are the basket's own figures; a null shipping
 * leaves the VAT unknown, because VAT on the goods alone would be a smaller
 * number than the truth.
 */
export function importCharges(input: {
  from: string | null | undefined
  to: string | null | undefined
  currency: string | null
  subtotal: number | null
  shipping: number | null
  formats: (string | null | undefined)[]
}): ImportCharges | null {
  const { from, to, currency, subtotal, shipping, formats } = input
  if (!from || inEu(from) || !inEu(to)) return null
  if (currency !== 'EUR' || subtotal === null || formats.length === 0) return null

  const vatRate = EU_VAT_RATES[to!.trim()]!
  const overThreshold = cents(subtotal) >= cents(FLAT_DUTY_UNDER_EUR)

  // Vinyl in any size is one sub-heading, a CD another (HS 8523 splits them).
  const kinds = new Set(
    formats.map((format) => (unitsOf(format).unit === 'cd' ? 'cd' : 'vinyl')),
  )
  const dutyLines = kinds.size
  const duty = overThreshold ? null : dutyLines * FLAT_DUTY_EUR

  const vat =
    shipping === null
      ? null
      : Math.round(((cents(subtotal) + cents(shipping)) * vatRate) / 100) / 100

  return { duty, dutyLines, vat, vatRate, vatAtCheckout: !overThreshold, overThreshold }
}
