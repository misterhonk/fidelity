import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { blocks, pieces } from '~/utils/release-notes'

/**
 * Was in dieser Ausgabe neu ist, in der App lesbar.
 *
 * Die Datei ist 47 kB groß und zu drei Vierteln für das Repository
 * geschrieben — „fix(deploy): die Hub-Prüfung hat nichts geprüft" sagt jemandem,
 * der die App benutzt, nichts. Gezeigt wird deshalb nur der handgeschriebene
 * Vorspann, und der ist ein bis zwei Kilobyte.
 */

describe('the inline marks', () => {
  it('keeps plain text plain', () => {
    expect(pieces('nichts besonderes')).toEqual([{ kind: 'text', text: 'nichts besonderes' }])
  })

  it('finds bold, code and links in one pass', () => {
    expect(pieces('ein **fettes** `wort` und [ein Link](https://example.test)')).toEqual([
      { kind: 'text', text: 'ein ' },
      { kind: 'strong', text: 'fettes' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'wort' },
      { kind: 'text', text: ' und ' },
      { kind: 'link', text: 'ein Link', href: 'https://example.test' },
    ])
  })

  /**
   * **In einem Durchgang, und das ist der Grund.**
   *
   * Nacheinander gesucht verschluckte die fette Stelle die Klammern des Links
   * — `**[Text](url)**` käme als fetter Text `[Text](url)` heraus, mit
   * sichtbaren Klammern und ohne Ziel.
   */
  it('does not let one mark swallow another', () => {
    const out = pieces('siehe [docs/02](https://example.test/a) und **fett**')
    expect(out.filter((s) => s.kind === 'link')).toHaveLength(1)
    expect(out.filter((s) => s.kind === 'strong')).toHaveLength(1)
  })
})

describe('the shape of the notes', () => {
  it('joins the wrapped lines of a paragraph', () => {
    // Die Datei ist auf hundert Zeichen umbrochen; ein Bildschirm bricht anders.
    expect(blocks('eine Zeile\nund ihre Fortsetzung')).toEqual([
      {
        kind: 'paragraph',
        pieces: [{ kind: 'text', text: 'eine Zeile und ihre Fortsetzung' }],
      },
    ])
  })

  it('separates paragraphs on a blank line', () => {
    expect(blocks('erster\n\nzweiter')).toHaveLength(2)
  })

  it('reads a bullet list', () => {
    const out = blocks('- eins\n- zwei')
    expect(out.map((b) => b.kind)).toEqual(['bullet', 'bullet'])
  })

  /**
   * Ein mehrzeiliger Punkt bleibt einer.
   *
   * Die eingerückte Fortsetzung ist im Changelog die Regel und nicht die
   * Ausnahme — ohne diese Zeile zerfiele jeder längere Punkt in einen Punkt
   * und einen Absatz, und die Liste sähe zerbrochen aus.
   */
  it('keeps an indented continuation with its bullet', () => {
    const out = blocks('- eins,\n  das weitergeht\n- zwei')
    expect(out).toHaveLength(2)
    expect(out[0]!.pieces[0]).toEqual({ kind: 'text', text: 'eins, das weitergeht' })
  })

  it('is empty for nothing', () => {
    expect(blocks('')).toEqual([])
    expect(blocks('   \n\n  ')).toEqual([])
  })
})

/**
 * **Und diese Ausgabe hat etwas zu sagen.**
 *
 * Der Vorspann wird von Hand geschrieben, im Release-PR — das ist die Stelle,
 * an der aus fünf Commit-Betreffs ein Satz wird, den jemand lesen will. Dieser
 * Test ist die Bedingung dafür: ein Release ohne ein Wort an die Leute macht
 * den PR rot, solange man es noch schreiben kann.
 */
describe('the release that is about to ship', () => {
  it('has notes written for people, not for the repository', () => {
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string
    const text = readFileSync('CHANGELOG.md', 'utf8')

    const start = text.search(new RegExp(`^## \\[?${version.replace(/\./g, '\\.')}[\\](]`, 'm'))
    expect(start, `kein CHANGELOG-Eintrag für ${version}`).toBeGreaterThanOrEqual(0)

    const rest = text.slice(start)
    const nachUeberschrift = rest.indexOf('\n') + 1
    const ende = rest.slice(nachUeberschrift).search(/^(###? )/m)
    const lead = rest
      .slice(nachUeberschrift, ende === -1 ? undefined : nachUeberschrift + ende)
      .trim()

    expect(lead, `${version} hat keinen handgeschriebenen Vorspann`).not.toBe('')
    // Und er ist ein Absatz, keine hingeworfene Zeile.
    expect(lead.length).toBeGreaterThan(80)
  })
})
