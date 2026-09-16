import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bareCode } from '../helpers/german'

/**
 * The other half of ADR-010, which nothing watched (M16).
 *
 * The comments got a ratchet on 2026-09-11 and reached zero the same day. The
 * identifiers got a count — "about thirty of them" — and a note saying they
 * would be fixed by hand, "and if one comes back, nothing will catch it". The
 * reason given was sound as far as it went: a word list over identifiers is a
 * guess, because `war`, `rest`, `die` and `man` are all English too.
 *
 * **What makes it not a guess is that the list is closed.** It is not German;
 * it is *the German this codebase actually used*, read off the tree on
 * 2026-09-16 and then removed from it. A word here earns its place by having
 * been a variable in this repository, which is also why the list may only ever
 * grow and never by invention.
 *
 * The second half is `bareCode`: comments and **text** are blanked before the
 * search. That is the whole line between "German the app says" and "German the
 * app is written in", and this project says a lot of German on purpose — the
 * `de` language pack, the eighteen renamed paths, the `?dicht=kiste` an old
 * link still carries, place names in a fixture. None of those is an
 * identifier, and none of them is searched.
 */
const GERMAN_IDENTIFIERS =
  /\b(antwort|ausAdresse|bloecke|datei|dateien|eintrag|eintraege|ergebnis|erwaehnung|gefunden|gekauft|gemeldet|gesehen|getrimmt|haendler|huelle|kandidat|kandidaten|lebt|nadel|pfad|platte|platten|regal|schluessel|stuecke|treffer|verzeichnis|vorhanden|wunsch|wurzel|zeile|zeilen|ziel)(?![a-z])/gi

const IGNORED = /node_modules|[/.](nuxt|output|nitro|cache)|dist\/|coverage\//
const SOURCES = globSync('**/*.{ts,mts,mjs,vue}', {
  exclude: (path) => IGNORED.test(path),
})

describe('identifiers are English (ADR-010)', () => {
  it('finds the files it is meant to look at', () => {
    // Without this the assertion below passes by finding nothing at all.
    expect(SOURCES.length).toBeGreaterThan(300)
  })

  it('has no German identifier anywhere', () => {
    const found: string[] = []
    for (const path of SOURCES) {
      const code = bareCode(readFileSync(path, 'utf8'))
      for (const match of code.matchAll(GERMAN_IDENTIFIERS)) {
        found.push(`${path}:${code.slice(0, match.index).split('\n').length} ${match[0]}`)
      }
    }
    expect(found).toEqual([])
  })

  /*
   * And the counter-check the comments ratchet has too: that the search still
   * searches. A `bareCode` that blanked everything, or a pattern that stopped
   * matching, would be green and worthless.
   */
  it('still recognises one when it sees one', () => {
    const code = bareCode("const treffer = 1 // a comment\nconst s = 'ein Treffer'\n")
    expect([...code.matchAll(GERMAN_IDENTIFIERS)].map((m) => m[0])).toEqual(['treffer'])
  })

  /*
   * The distinction this whole guard rests on, pinned as a case: German in a
   * string is the app speaking German, which ADR-010 asks for rather than
   * forbids. Nested templates are how the language pack is actually written.
   */
  it('leaves the language pack alone, nested templates included', () => {
    const pack = "const m = `${n === 1 ? 'Eine Platte' : `${n} Platten`} bei ${shop}`\n"
    expect([...bareCode(pack).matchAll(GERMAN_IDENTIFIERS)]).toEqual([])
  })
})
