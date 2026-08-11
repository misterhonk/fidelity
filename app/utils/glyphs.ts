/**
 * Sechs Zeichen, die es bei Lucide nicht gibt.
 *
 * Lucide has a shopping basket and a house and a magnifying glass, and it has
 * no word for the things this app is actually about. A record, a sleeve, a
 * crate you dig through, a stylus, a shelf, and a record you do not own yet:
 * that is the vocabulary, and every one of them had to be drawn.
 *
 * They are on Lucide's grid — 24×24, 2px stroke, round caps and joins, no
 * fills — because a set that mixes two drawing systems reads as a mistake even
 * when nobody can name which icon is the foreign one. The outer <svg> in
 * FidIcon carries all of that, so nothing here repeats it.
 *
 * Drawn to survive 20px: three details, no hairlines, nothing that depends on
 * a gap smaller than a stroke.
 */

export type Shape = readonly [tag: string, attributes: Readonly<Record<string, string>>]

/**
 * A circle as a path, so the whole set is one kind of element where it can be.
 * Two arcs rather than one: a single 360° arc has identical endpoints and is
 * undefined.
 */
function ring(cx: number, cy: number, r: number): Shape {
  return [
    'path',
    { d: `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0` },
  ]
}

export const GLYPHS = {
  /**
   * Platte: Rand, zwei Rillen, Label.
   *
   * Two rings alone are a bullseye — the first attempt looked like an archery
   * target at every size. The grooves are what make it a record: they break
   * the concentric symmetry, and they are the thing a record has that a target
   * does not.
   */
  platte: [
    ring(12, 12, 9),
    ['path', { d: 'M12 5.5a6.5 6.5 0 0 1 5.6 3.2' }],
    ['path', { d: 'M12 18.5a6.5 6.5 0 0 1-5.6-3.2' }],
    ring(12, 12, 2.5),
  ],

  /**
   * Sleeve: the record in its cardboard.
   *
   * The first version put the disc half out of the sleeve, which at 20px is a
   * coffee mug with a handle. A disc squarely inside a square is unmistakable,
   * and it differs from `platte` by exactly the thing it adds.
   */
  huelle: [
    ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '1' }],
    ring(12, 12, 5),
    ring(12, 12, 1),
  ],

  /**
   * Crate: records upright, fingers over the top.
   *
   * The verb the whole app is named after. The records stick out above the rim
   * because that is what you see looking down into one.
   */
  kiste: [
    ['path', { d: 'M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
    ['path', { d: 'M7 10V5m5 5V3m5 7V6' }],
  ],

  /**
   * Stylus: tonearm over the edge of the record.
   *
   * A circle with a stick on it is a magnifying glass, and this set already
   * has one of those. What makes it an arm is the bend at the far end — the
   * headshell sits at an angle to the tube on every turntable ever built, and
   * it is the one detail that survives being drawn at 16 pixels.
   */
  nadel: [
    ['path', { d: 'M3 21a11 11 0 0 1 4.4-8.8' }],
    ring(19, 4.5, 1.5),
    ['path', { d: 'm17.6 5.9l-6.4 6.4' }],
    ['path', { d: 'm11.2 12.3l-2.6 1l-1 2.6' }],
  ],

  /**
   * Regal: Platten auf einem Brett, unterschiedlich hoch.
   *
   * Spines rather than covers — a shelf seen from across a room is a row of
   * edges. The first version boxed them in and came out as a floppy disk: the
   * outer rectangle was doing the work the records should have been doing.
   */
  regal: [
    ['path', { d: 'M3 21h18' }],
    ['path', { d: 'M6 21V6.5m4 14.5V6.5m4 14.5V6.5' }],
    ['path', { d: 'm17.5 21l2-14.2' }],
  ],

  /**
   * Wantlist: die Platte, die noch fehlt.
   *
   * A gap in the ring where the record is not, and the plus that would close
   * it. A heart would have said "favourite", which is the collection's job.
   */
  wantlist: [
    ['path', { d: 'M15.5 4.2A9 9 0 1 0 19.8 8.5' }],
    ring(12, 13, 3),
    ['path', { d: 'M19 2v6m-3-3h6' }],
  ],
} as const satisfies Record<string, readonly Shape[]>

export type GlyphName = keyof typeof GLYPHS
