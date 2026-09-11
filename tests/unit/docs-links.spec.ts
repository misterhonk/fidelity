import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Zeigt noch jeder Verweis zwischen den Dokumenten irgendwohin?
 *
 * **Weil genau das beim Umbenennen bricht, und zwar lautlos.** Am 2026-09-11
 * wurden mit der Übersetzung sechs Dokumente und elf ADRs umbenannt —
 * `00-KONZEPT.md` zu `00-CONCEPT.md` und so weiter — und 63 Verweise zogen
 * mit. Ein einziger vergessener hätte ausgesehen wie ein Link und ins Leere
 * geführt; niemand bemerkt das, weil Markdown tote Links nicht anzeigt.
 *
 * Geprüft werden beide Formen, in denen dieses Projekt zitiert: der echte
 * Markdown-Link `[Text](pfad.md)` und die Erwähnung in Backticks,
 * `` `docs/02-DISCOGS-API.md` ``. Die zweite ist häufiger und trägt genauso
 * viel Bedeutung — nur merkt es dort noch weniger jemand.
 *
 * **Kurzformen ohne Endung bleiben außen vor.** `docs/02` und `docs/09 §1.1`
 * stehen rund zweihundert Mal im Code und sind Absicht: sie nennen die Nummer,
 * und die ist der stabile Teil. Wer sie mitprüfen wollte, müsste raten, welcher
 * Suffix gemeint ist — und genau deshalb sind sie die haltbare Form.
 */

const WURZEL = process.cwd()

/** Alle Markdown-Dateien, die dieses Projekt selbst geschrieben hat. */
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
        if (eintrag.isFile() && eintrag.name.endsWith('.md')) gefunden.push(eintrag.name)
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
         * Zwei Auflösungen, weil dieses Projekt beide schreibt: relativ zur
         * Datei (`adr/010-…md` aus docs/ heraus) und von der Wurzel aus
         * (`docs/02-DISCOGS-API.md` aus einem Kommentar im Code).
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
   * Und die Gegenprobe: der Test prüft überhaupt etwas.
   *
   * Ein Muster, das nichts mehr findet — weil jemand die Zitierweise ändert —
   * wäre grün und wertlos. Die Zahl ist bewusst niedrig angesetzt; sie soll
   * „der Mechanismus greift" belegen, nicht einen Stand einfrieren.
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
