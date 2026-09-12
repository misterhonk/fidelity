/**
 * What is stamped on the record, in a form two people would type the same.
 *
 * Measured on 2026-09-11: a full run-out typed into the search returns one
 * hit, a fragment thousands. The index has to make the same distinction, so
 * `value_norm` keeps every character that carries information and drops only
 * the ones that vary with the typist: spaces, hyphens, case. A barcode
 * "7 24384 56142 3" and "724384561423" are one row; "MPO SK 032 A1" and
 * "MPO-SK032-A1" are one row.
 */
export type IdentifierKind = 'barcode' | 'matrix' | 'other'

export function identifierKind(type: string): IdentifierKind {
  const t = type.toLowerCase()
  if (t === 'barcode') return 'barcode'
  if (t.startsWith('matrix')) return 'matrix'
  return 'other'
}

export function normaliseIdentifier(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, '')
}
