import type { Place, PlaceNode, UnitShape } from './types'

/**
 * A place, read from the front (docs/18, ADR-015).
 *
 * A record's address at home is room → unit → compartment, and inside the
 * compartment a rule, not a slot. The compartment is the smallest thing a
 * person can name — "third from the left, second row" — so it is the
 * smallest thing the app names too. Its coordinate is read the way a
 * spreadsheet is: columns as letters, rows as numbers, A1 top left.
 */

/** `0, 0` → "A1"; `26, 2` → "AA3". Columns beyond Z are two letters, like a spreadsheet. */
export function slotLabel(column: number, row: number): string {
  let letters = ''
  let c = column
  do {
    letters = String.fromCharCode(65 + (c % 26)) + letters
    c = Math.floor(c / 26) - 1
  } while (c >= 0)
  return `${letters}${row + 1}`
}

/**
 * The names from the top down to the place: `['Living room', 'Kallax', 'B3']`.
 * A compartment that was given a name of its own keeps its coordinate in
 * front of it — the coordinate is where you look, the name is why.
 */
export function addressOf(placeId: string | null, nodes: readonly PlaceNode[]): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const path: string[] = []
  let cursor = placeId ? byId.get(placeId) : undefined
  while (cursor) {
    path.unshift(labelOf(cursor))
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return path
}

/** What a place is called on screen: a compartment by its coordinate, then its name if it has one. */
export function labelOf(place: Place): string {
  if (place.kind !== 'compartment' || !place.slot) return place.name
  const coordinate = slotLabel(place.slot.column, place.slot.row)
  return place.name && place.name !== coordinate ? `${coordinate} · ${place.name}` : coordinate
}

/**
 * The furniture people actually own.
 *
 * Capacities are estimates for 12" records — an LP sleeve is three to five
 * millimetres, a Kallax compartment is 33 cm inside — and they are a fill
 * level, not a lock: a compartment with 82 of 70 is full, not refused.
 */
export type UnitPresetKey =
  'kallax-2x2' | 'kallax-4x2' | 'kallax-4x4' | 'kallax-5x5' | 'crate' | 'box-7' | 'pile'

export interface UnitPreset {
  key: UnitPresetKey
  shape: UnitShape
  columns: number
  rows: number
  /** Per compartment; `null` for a pile, which has no edge to fill to. */
  capacity: number | null
}

export const UNIT_PRESETS: readonly UnitPreset[] = [
  { key: 'kallax-2x2', shape: 'shelf', columns: 2, rows: 2, capacity: 70 },
  { key: 'kallax-4x2', shape: 'shelf', columns: 4, rows: 2, capacity: 70 },
  { key: 'kallax-4x4', shape: 'shelf', columns: 4, rows: 4, capacity: 70 },
  { key: 'kallax-5x5', shape: 'shelf', columns: 5, rows: 5, capacity: 70 },
  { key: 'crate', shape: 'crate', columns: 1, rows: 1, capacity: 90 },
  { key: 'box-7', shape: 'box', columns: 1, rows: 1, capacity: 150 },
  { key: 'pile', shape: 'pile', columns: 1, rows: 1, capacity: null },
]

/** The most anybody builds by hand — a 10 × 10 wall is a hundred places. */
export const MAX_GRID = 10
