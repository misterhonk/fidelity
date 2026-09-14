#!/usr/bin/env node
/**
 * The Lucide icons this app uses, and only those.
 *
 * `@iconify-json/lucide` carries 1.834 icons. Depending on it at runtime, or
 * copying path data by hand into a component, are both wrong for different
 * reasons: the first spends the bundle budget on 1.816 icons nobody asked for
 * (CLAUDE.md rule 7), the second produces geometry that is Lucide-ish rather
 * than Lucide, and drifts the moment somebody nudges a curve.
 *
 * So it is a devDependency and this script, in the same shape as the design
 * tokens: a source of truth outside the app, a generated file inside it, and a
 * list naming exactly what crosses over. Adding an icon is a line in NEEDED
 * plus `pnpm icons:build`.
 *
 * Output: app/utils/lucide.generated.ts — generated, git-ignored.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = resolve(root, 'app/utils/lucide.generated.ts')

/**
 * Every Lucide icon the app draws, with the place that earns it.
 *
 * Kept short on purpose. An icon that does not replace a word or speed up
 * recognition is decoration, and decoration is what this design language is
 * supposed to be free of.
 */
const NEEDED = {
  house: 'Navigation: start',
  'shopping-basket': 'Navigation: basket',
  store: 'Navigation: shops',
  settings: 'Navigation: settings',
  map: 'Collection tab: map',
  calendar: 'Collection tab: a year on the shelf',
  'arrow-left': 'Back, in the settings',
  'arrow-up': 'Back to the top of a long list',
  search: 'Command palette and search fields',
  download: 'Export',
  'trash-2': 'Delete everything',
  'wifi-off': 'The offline notice',
  /*
   * Save and Bought are actions, not ratings.
   *
   * They were once two of four thumb-and-smiley symbols in a row, and the
   * fourth carried a shopping trolley of all things — right beside the "add to
   * basket" button, which does something else entirely. A bookmark says "set
   * aside", a tick says "have it", and both read without a label.
   */
  /*
   * The trolley stays — but only for the basket now, on the shop screen. It
   * was also the symbol of the "bought" rating, and so stood twice side by
   * side for two different things.
   */
  'shopping-cart': 'Add to basket (shop screen)',

  /*
   * The arrow pointing out of the box. A link that leaves the app should say
   * so beforehand — "View at Discogs" looked like any other text link, and the
   * jump into a new tab came unannounced.
   */
  'external-link': 'Leads out of the app',
  layers: 'The stack — the same finds, one at a time (dig screen)',

  bookmark: 'Save — enters it on the saved list',
  check: 'Bought — enters it on the bought list',

  /*
   * The wantlist, and it needed a symbol of its own.
   *
   * Saving and wanting sat side by side in the sheet's foot wearing the same
   * bookmark — two different things under one sign, which is the one thing a
   * symbol may never do. Reported on 2026-09-14. Saving is this app's own
   * shortlist; a want is entered at Discogs and everybody there can see it.
   */
  heart: 'Wantlist — the want that lives at Discogs',

  /*
   * The two ratings with no consequence. They are stored and read by nothing —
   * the learning they were meant for was never built (worker/match/ does not
   * touch the feedback store). So they are switched off in the interface but
   * not deleted: if the learning arrives, they come back with a switch. Their
   * symbols stay here so that the switch is exactly that — a switch, not a
   * rebuild.
   */
  'thumbs-down': 'Rating: not for me (switched off)',
  meh: 'Rating: so-so (switched off)',

  /*
   * The stack (M15). Six buttons in a row, side by side on a phone — there the
   * symbol carries what the text can no longer carry at 360 px.
   *
   * `arrow-left` already existed; `arrow-right` is its counterpart and was
   * missing only because nothing had ever gone forwards. Deliberately **no**
   * new symbols for "save" and "add to basket": those are `bookmark` and
   * `shopping-cart`, the same as on the match card. Two symbols for one action
   * would be two things to learn instead of one.
   */
  'arrow-right': 'Stack: one record on',
  play: 'Stack: start the audio preview',
  square: 'Stack: stop the audio preview — a square, because pause promises something else',
  'share-2': 'Stack: share the find list',

  /* Collection tab: watched (M11) — the records whose market value is tracked. */
  eye: 'Collection tab: watched',
  'eye-off': 'Hub settings: hide the secret again',
  /* Collection tab: places (M12) — where the record stands in the flat. */
  'map-pin': 'Collection tab: places',
  /* In the shop: scanning a barcode (M13). */
  scan: 'Scan a barcode',
}

/**
 * What the outer <svg> already says. Iconify repeats it on every element;
 * carrying it per shape would trade bytes for nothing.
 */
const PRESENTATIONAL = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
])

/** The tags FidIcon knows how to render. Anything else has to be added there first. */
const RENDERABLE = new Set(['path', 'circle', 'rect', 'line'])

function attributes(source) {
  const found = {}
  for (const match of source.matchAll(/([a-z-]+)="([^"]*)"/g)) {
    const [, name, value] = match
    if (!PRESENTATIONAL.has(name)) found[name] = value
  }
  return found
}

/**
 * Iconify bodies are either a bare element or a <g> wrapping several. Both
 * flatten to the same thing once the presentational attributes are dropped,
 * because the wrapper never carries geometry.
 */
function shapes(body, name) {
  const found = []

  for (const match of body.matchAll(/<([a-z]+)([^>]*)\/?>/g)) {
    const [, tag, rest] = match
    if (tag === 'g') continue

    if (!RENDERABLE.has(tag)) {
      throw new Error(`${name}: <${tag}> kann FidIcon nicht zeichnen`)
    }
    found.push([tag, attributes(rest)])
  }

  if (found.length === 0) throw new Error(`${name}: keine Formen gefunden`)
  return found
}

const require = createRequire(import.meta.url)
const collection = JSON.parse(
  await readFile(require.resolve('@iconify-json/lucide/icons.json'), 'utf8'),
)

if (collection.height !== 24) {
  // FidIcon hard-codes viewBox="0 0 24 24" so the hand-drawn glyphs can share
  // a grid with these. A collection on another grid would silently rescale.
  throw new Error(`Lucide liegt auf ${collection.height}, erwartet wurde 24`)
}

const entries = Object.entries(NEEDED).map(([name, why]) => {
  const icon = collection.icons[name]
  if (!icon) throw new Error(`Lucide kennt kein "${name}"`)
  return `  /** ${why} */\n  '${name}': ${JSON.stringify(shapes(icon.body, name))},`
})

await writeFile(
  out,
  [
    '/* GENERATED by scripts/icons/lucide.mjs. Do not edit. */',
    '',
    '/*',
    ' * Lucide, ISC licence:',
    ' *',
    ' * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as',
    ' * part of Feather (MIT). All other copyright (c) for Lucide are held by',
    ' * Lucide Contributors 2022.',
    ' *',
    ' * Permission to use, copy, modify, and/or distribute this software for any',
    ' * purpose with or without fee is hereby granted, provided that the above',
    ' * copyright notice and this permission notice appear in all copies.',
    ' */',
    '',
    "import type { Shape } from './glyphs'",
    '',
    'export const LUCIDE = {',
    ...entries,
    '} as const satisfies Record<string, Shape[]>',
    '',
  ].join('\n'),
)

console.log(`lucide → app/utils/lucide.generated.ts (${entries.length} Icons)`)
