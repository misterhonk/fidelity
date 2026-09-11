import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Does every reference between the documents still point somewhere?
 *
 * **Because that is exactly what a rename breaks, and silently.** On
 * 2026-09-11 the translation renamed six documents and eleven ADRs —
 * `00-KONZEPT.md` to `00-CONCEPT.md` and so on — and 63 references came along.
 * A single forgotten one would have looked like a link and led nowhere; nobody
 * notices, because Markdown does not show dead links.
 *
 * Both forms this project cites in are checked: the real Markdown link
 * `[text](path.md)` and the mention in backticks,
 * `` `docs/02-DISCOGS-API.md` ``. The second is commoner and carries just as
 * much meaning — only there even fewer people notice.
 *
 * **Short forms without a suffix stay out.** `docs/02` and `docs/09 §1.1`
 * appear about two hundred times in the code and are deliberate: they name the
 * number, and the number is the stable part. Anybody wanting to check them
 * would have to guess which suffix is meant — which is precisely why they are
 * the durable form.
 *
 * **And `CHANGELOG.md` stays out too**, for a reason that showed up on the
 * first run: an entry there *names* old filenames in order to explain a rename
 * ("`00-KONZEPT.md` is now called `00-CONCEPT.md`"). A name being talked about
 * is not a reference — and a changelog is a record of the past, which by its
 * nature names things that no longer exist. Checking it would mean having to
 * rewrite history every time something is renamed.
 */

const WURZEL = process.cwd()

/** Every Markdown file this project wrote itself. */
function markdownDateien(): string[] {
  const gefunden: string[] = []
  const gehen = (verzeichnis: string) => {
    for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
      if (eintrag.name.startsWith('.')) continue
      const pfad = join(verzeichnis, eintrag.name)
      if (eintrag.isDirectory()) {
        if (['node_modules', 'coverage', 'dist'].includes(eintrag.name)) continue
        gehen(pfad)
      } else if (eintrag.name.endsWith('.md')) {
        gefunden.push(pfad)
      }
    }
  }
  for (const start of ['docs', '.']) {
    if (start === '.') {
      for (const eintrag of readdirSync(WURZEL, { withFileTypes: true })) {
        if (!eintrag.isFile() || !eintrag.name.endsWith('.md')) continue
        if (eintrag.name === 'CHANGELOG.md') continue // siehe oben
        gefunden.push(eintrag.name)
      }
    } else {
      gehen(start)
    }
  }
  return [...new Set(gefunden)]
}

const LINK = /\[[^\]]*\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g
const ERWAEHNUNG = /`((?:docs\/)?(?:adr\/)?[\w][\w./-]*\.md)`/g

describe('the documents point at one another', () => {
  it('has no link or mention that leads nowhere', () => {
    const tot: string[] = []

    for (const datei of markdownDateien()) {
      const text = readFileSync(join(WURZEL, datei), 'utf8')
      const verzeichnis = dirname(datei)

      for (const treffer of [...text.matchAll(LINK), ...text.matchAll(ERWAEHNUNG)]) {
        const ziel = treffer[1]!
        if (ziel.startsWith('http') || ziel.startsWith('mailto')) continue

        /*
         * Two resolutions, because this project writes both: relative to the
         * file (`adr/010-…md` from inside docs/) and from the root
         * (`docs/02-DISCOGS-API.md` from a comment in the code).
         */
        const kandidaten = [normalize(join(verzeichnis, ziel)), normalize(ziel)]
        if (!kandidaten.some((k) => existsSync(join(WURZEL, k)))) {
          tot.push(`${datei} → ${ziel}`)
        }
      }
    }

    expect(tot).toEqual([])
  })

  /**
   * And the counter-check: that the test checks anything at all.
   *
   * A pattern that finds nothing any more — because somebody changed how
   * references are written — would be green and worthless. The number is
   * deliberately set low; it is meant to show "the mechanism works", not to
   * freeze a state.
   */
  it('actually finds the references it checks', () => {
    let gezaehlt = 0
    for (const datei of markdownDateien()) {
      const text = readFileSync(join(WURZEL, datei), 'utf8')
      gezaehlt += [...text.matchAll(LINK)].length + [...text.matchAll(ERWAEHNUNG)].length
    }
    expect(gezaehlt).toBeGreaterThan(50)
  })
})
