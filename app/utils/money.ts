/**
 * Ein Betrag, wie ihn diese App schreibt.
 *
 * There were ten of these: six `money()` functions across six files and four
 * more built inline in a computed. Nine of them agreed. The tenth defaulted
 * the currency to euros, which is not a formatting difference — it is a pound
 * price with a euro sign in front of it.
 *
 * Money is the output this whole app exists to produce. It gets one place.
 *
 * Returns `null` rather than a placeholder when either half is missing: a
 * price without its currency is not a small problem to paper over with "0,00 €"
 * — six hours after a dig it is the marketplace data that may no longer be
 * shown at all (CLAUDE.md rule 4), and every caller already has a branch for
 * "nothing to say".
 */
export function money(
  value: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
}

/**
 * Counts, thousands separated. The same formatter every screen was building
 * for itself — twenty-one of them.
 */
export const number = new Intl.NumberFormat('de-DE')
