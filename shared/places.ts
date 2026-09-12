import type { Finish, FinishMaterial, Place, PlaceNode, PlaceRule, UnitShape } from './types'

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
  | 'kallax-2x2'
  | 'kallax-4x2'
  | 'kallax-4x4'
  | 'kallax-5x5'
  | 'billy'
  | 'usm-haller'
  | 'tylko'
  | 'stocubo'
  | 'crate'
  | 'hhv-box'
  | 'box-7'
  | 'pile'

export interface UnitPreset {
  key: UnitPresetKey
  shape: UnitShape
  columns: number
  rows: number
  /** Per compartment; `null` for a pile, which has no edge to fill to. */
  capacity: number | null
  /** How it looks: the material of the walls, their thickness, a colour where the furniture has one. */
  finish: Finish
  /** The order inside: shelves alphabetical by artist, a crate or a pile by hand. */
  rule: PlaceRule
}

/**
 * The look of a piece of furniture (M27.1b), the way ModularGrid lets a rack
 * choose its theme. Not a picture of the shelf — a material for the walls,
 * a thickness for them, and a colour where the furniture has one (USM
 * panels, stocubo cubes). Drawn with CSS on the wall, nothing loaded.
 */
export const FINISH_MATERIALS: readonly FinishMaterial[] = [
  'white',
  'black',
  'birch',
  'oak',
  'walnut',
  'steel',
  'cardboard',
]

/** The colours furniture actually comes in — USM's ruby red, golden yellow and gentian blue among them. */
export const FINISH_COLOURS: readonly string[] = [
  '#c8102e',
  '#f5c400',
  '#00589c',
  '#3f7d20',
  '#e46b0a',
  '#7a1f4a',
  '#9ea3aa',
]

export const DEFAULT_FINISH: Finish = { material: 'white', thickness: 'thick', colour: null }

const white: Finish = { material: 'white', thickness: 'thick', colour: null }

export const UNIT_PRESETS: readonly UnitPreset[] = [
  {
    key: 'kallax-2x2',
    shape: 'shelf',
    columns: 2,
    rows: 2,
    capacity: 70,
    finish: white,
    rule: 'artist',
  },
  {
    key: 'kallax-4x2',
    shape: 'shelf',
    columns: 4,
    rows: 2,
    capacity: 70,
    finish: white,
    rule: 'artist',
  },
  {
    key: 'kallax-4x4',
    shape: 'shelf',
    columns: 4,
    rows: 4,
    capacity: 70,
    finish: white,
    rule: 'artist',
  },
  {
    key: 'kallax-5x5',
    shape: 'shelf',
    columns: 5,
    rows: 5,
    capacity: 70,
    finish: white,
    rule: 'artist',
  },
  {
    key: 'billy',
    shape: 'shelf',
    columns: 1,
    rows: 5,
    capacity: 100,
    finish: { material: 'birch', thickness: 'thin', colour: null },
    rule: 'artist',
  },
  {
    key: 'usm-haller',
    shape: 'shelf',
    columns: 3,
    rows: 2,
    capacity: 70,
    finish: { material: 'steel', thickness: 'thin', colour: '#c8102e' },
    rule: 'artist',
  },
  {
    key: 'tylko',
    shape: 'shelf',
    columns: 4,
    rows: 3,
    capacity: 60,
    finish: { material: 'birch', thickness: 'thin', colour: null },
    rule: 'artist',
  },
  {
    key: 'stocubo',
    shape: 'shelf',
    columns: 3,
    rows: 3,
    capacity: 70,
    finish: { material: 'white', thickness: 'medium', colour: '#00589c' },
    rule: 'artist',
  },
  {
    key: 'crate',
    shape: 'crate',
    columns: 1,
    rows: 1,
    capacity: 90,
    finish: { material: 'oak', thickness: 'medium', colour: null },
    rule: 'manual',
  },
  {
    key: 'hhv-box',
    shape: 'box',
    columns: 1,
    rows: 1,
    capacity: 60,
    finish: { material: 'cardboard', thickness: 'thin', colour: null },
    rule: 'manual',
  },
  {
    key: 'box-7',
    shape: 'box',
    columns: 1,
    rows: 1,
    capacity: 150,
    finish: { material: 'black', thickness: 'thin', colour: null },
    rule: 'manual',
  },
  {
    key: 'pile',
    shape: 'pile',
    columns: 1,
    rows: 1,
    capacity: null,
    finish: { material: 'white', thickness: 'thin', colour: null },
    rule: 'manual',
  },
]

/**
 * The walls as CSS: a material is a background, a thickness is a gap. Wood
 * is a gradient with a grain, steel a brushed one, cardboard flat — enough
 * to tell a Kallax from a USM at a glance, nothing photographic.
 */
export function finishStyle(finish: Finish | undefined): {
  frame: string
  gap: string
  face: string | null
} {
  const f = finish ?? DEFAULT_FINISH
  const frames: Record<FinishMaterial, string> = {
    white: 'linear-gradient(180deg, #f3f0ea, #e6e2da)',
    black: 'linear-gradient(180deg, #2a2a2a, #161616)',
    birch: 'repeating-linear-gradient(90deg, #e9dcc0 0 6px, #e1d2b3 6px 9px, #ecdfc5 9px 16px)',
    oak: 'repeating-linear-gradient(90deg, #c99a5f 0 5px, #b98a50 5px 8px, #cfa36a 8px 14px)',
    walnut:
      'repeating-linear-gradient(90deg, #5e3f2c 0 6px, #4d3223 6px 9px, #66452f 9px 15px)',
    steel: 'linear-gradient(180deg, #d5d8dc, #a9aeb5 50%, #c3c7cc)',
    cardboard: 'linear-gradient(180deg, #c19a6b, #ad8656)',
  }
  const gaps = { thin: '2px', medium: '6px', thick: '12px' }
  // Coloured furniture: the colour is the frame for a cube system, the face for a panel system.
  const frame = f.colour && f.material !== 'steel' ? f.colour : frames[f.material]
  const face = f.colour && f.material === 'steel' ? f.colour : null
  return { frame, gap: gaps[f.thickness], face }
}

/** Dark text on a light face, light text on a dark one — for a coloured compartment. */
export function textOn(colour: string): string {
  const hex = colour.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1a1a1a' : '#f4f1ea'
}

/** The most anybody builds by hand — a 10 × 10 wall is a hundred places. */
export const MAX_GRID = 10
