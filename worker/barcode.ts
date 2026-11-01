/*
 * Apart from worker/identify.ts because the in-store page needs it on the
 * main thread, and identify.ts brings zod — whose first schema probes for
 * `eval`, which the CSP reports as a violation (#204).
 */

/**
 * Barcode or run-out groove? The field takes both, so somebody has to decide.
 *
 * Digits only (plus the spaces and hyphens as they appear on the sleeve) is a
 * barcode. Anything else is a run-out — those nearly always carry letters,
 * often a mastering signature like `PHRUPMASTERGENERAL`.
 *
 * As a function and not as an expression in a template: a mutation probe
 * showed that a test which only reads the source never sees the decision —
 * nailed to `true`, it stayed green.
 */
export function looksLikeBarcode(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && /^[\d\s-]+$/.test(trimmed)
}
