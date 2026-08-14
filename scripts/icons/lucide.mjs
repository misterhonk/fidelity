#!/usr/bin/env node
/**
 * Die benutzten Lucide-Icons, und nur die.
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
  map: 'Sammlungsreiter: Landkarte',
  'arrow-left': 'Back, in the settings',
  'arrow-up': 'Back to the top of a long list',
  search: 'Befehlspalette und Suchfelder',
  download: 'Export',
  'trash-2': 'Delete everything',
  'wifi-off': 'Offline-Hinweis',
  /*
   * Merken und Gekauft sind Aktionen, keine Bewertungen.
   *
   * Sie waren einmal zwei von vier Daumen-und-Smiley-Symbolen in einer Reihe,
   * und der vierte trug ausgerechnet einen Einkaufswagen — direkt neben dem
   * Knopf „In den Korb", der etwas ganz anderes tut. Ein Lesezeichen merkt
   * vor, ein Häkchen sagt „habe ich", und beides ist ohne Beschriftung
   * erkennbar.
   */
  /*
   * Der Einkaufswagen bleibt — aber nur noch für den Korb, im Laden-Screen.
   * Er war zusätzlich das Symbol der Bewertung „gekauft" und stand damit
   * zweimal nebeneinander für zwei verschiedene Dinge.
   */
  'shopping-cart': 'In den Korb (Laden-Screen)',

  /*
   * Der Pfeil, der aus dem Kasten zeigt. Ein Link, der die App verlässt, soll
   * das vorher sagen — "View at Discogs" sah aus wie jeder andere Textlink,
   * und der Sprung in einen neuen Tab kam unangekündigt.
   */
  'external-link': 'Führt aus der App heraus',

  bookmark: 'Merken — trägt in die Merkliste ein',
  check: 'Gekauft — trägt in die Gekauft-Liste ein',

  /*
   * Die zwei folgenlosen Bewertungen. Sie werden gespeichert und von nichts
   * gelesen — das Lernen, für das sie gedacht waren, ist nie gebaut worden
   * (worker/match/ fasst den feedback-Store nicht an). Sie sind deshalb in der
   * Oberfläche abgeschaltet, aber nicht gelöscht: kommt das Lernen, kommen sie
   * mit einem Schalter zurück. Ihre Symbole bleiben hier, damit dieser
   * Schalter genau das ist — ein Schalter, kein Wiederaufbau.
   */
  'thumbs-down': 'Bewertung: danebengegriffen (abgeschaltet)',
  meh: 'Bewertung: naja (abgeschaltet)',
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
