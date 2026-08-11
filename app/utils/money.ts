import { activeLocale } from '~/composables/useMessages'

/**
 * An amount, the way this app writes one.
 *
 * There were ten of these: six `money()` functions across six files and four
 * more built inline in a computed. Nine of them agreed. The tenth defaulted
 * the currency to euros, which is not a formatting difference — it is a pound
 * price with a euro sign in front of it.
 *
 * Money is the output this whole app exists to produce. It gets one place.
 *
 * Returns `null` rather than a placeholder when either half is missing: a
 * price without its currency is not a small problem to paper over with "0.00 €"
 * — six hours after a dig it is the marketplace data that may no longer be
 * shown at all (CLAUDE.md rule 4), and every caller already has a branch for
 * "nothing to say".
 *
 * The decimal mark follows the interface language, which is why the locale is
 * read on every call rather than baked into a formatter once: somebody reading
 * German expects `14,00 €`, somebody reading English expects `€14.00`, and the
 * switch has to move both. Building an `Intl.NumberFormat` is cheap enough that
 * doing it per price does not show up next to what the list around it costs.
 */
export function money(
  value: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !currency) return null
  return new Intl.NumberFormat(activeLocale(), { style: 'currency', currency }).format(value)
}

/**
 * Counts, thousands separated. The same formatter every screen was building
 * for itself — twenty-one of them.
 *
 * A function rather than a formatter held in a constant, for the same reason as
 * above: a constant is built once at import, and the language is not known yet
 * then — nor would it follow a switch afterwards.
 */
export function count(value: number): string {
  return new Intl.NumberFormat(activeLocale()).format(value)
}

/**
 * A number that is not a count and not a price: a rate, a factor, a lift, the
 * megabytes a collection takes up.
 *
 * Six screens each built one of these, all with the same two options and the
 * same hard-wired `de-DE`. That is the shape the mistake at the top of this
 * file already took once, one file up the ladder — so it lands here with the
 * others rather than being fixed six times.
 */
export function decimal(value: number, digits = 1): string {
  return new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: digits }).format(value)
}
