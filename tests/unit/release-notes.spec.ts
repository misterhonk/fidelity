import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { blocks, pieces } from '~/utils/release-notes'

/**
 * What is new in this release, readable in the app.
 *
 * The file is 47 kB and three quarters of it is written for the repository —
 * "fix(deploy): the hub check checked nothing" says nothing to somebody using
 * the app. So only the hand-written lead is shown, and that is one or two
 * kilobytes.
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
   * **In one pass, and this is why.**
   *
   * Searched one after another, the bold run swallowed the link's brackets —
   * `**[text](url)**` would come out as bold text `[text](url)`, with visible
   * brackets and no destination.
   */
  it('does not let one mark swallow another', () => {
    const out = pieces('siehe [docs/02](https://example.test/a) und **fett**')
    expect(out.filter((s) => s.kind === 'link')).toHaveLength(1)
    expect(out.filter((s) => s.kind === 'strong')).toHaveLength(1)
  })
})

describe('the shape of the notes', () => {
  it('joins the wrapped lines of a paragraph', () => {
    // The file is wrapped at a hundred characters; a screen breaks differently.
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
   * A multi-line bullet stays one bullet.
   *
   * The indented continuation is the rule in the changelog and not the
   * exception — without this line every longer bullet would fall into a bullet
   * and a paragraph, and the list would look broken.
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
 * **And this release has something to say.**
 *
 * The lead is written by hand, in the release PR — that is where five commit
 * subjects become a sentence somebody wants to read. This test is the
 * condition for it: a release with not one word to anybody turns the PR red
 * while it can still be written.
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
    // And it is a paragraph, not a line tossed off.
    expect(lead.length).toBeGreaterThan(80)
  })
})

describe('the line that asks something', () => {
  it('turns a "What to do:" paragraph into an action block', async () => {
    const { blocks } = await import('~/utils/release-notes')
    const out = blocks('The news.\n\n**What to do:** Reload once, then sync.\n\nMore news.')
    expect(out.map((b) => b.kind)).toEqual(['paragraph', 'action', 'paragraph'])
    expect(out[1]!.pieces.map((p) => p.text).join('')).toBe('Reload once, then sync.')
  })
})
