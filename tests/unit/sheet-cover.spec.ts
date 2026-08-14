import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Das Cover in den beiden Sheets: so groß wie es geht, und ohne falsche Zusage.
 *
 * Beides ist am 2026-08-14 gemessen worden, und beide Messungen widerlegen,
 * was vorher im Quelltext stand:
 *
 * 1. **Es gibt kein schärferes Bild.** `images[0]` aus `/releases/{id}` ist
 *    dieselbe Fassung wie `cover_image`, und der CDN-Pfad ist signiert — auf
 *    `h:1200/w:1200` umgeschrieben antwortet er mit 403. Wer das Cover größer
 *    zeigt, rechnet hoch; das ist die bewusste Entscheidung, nicht ein
 *    Versehen.
 *
 * 2. **`600w` war gelogen.** Der CDN passt in ein 600er Quadrat ein, ohne
 *    aufzublasen: Release 512 kommt als 313 × 238 heraus. Der `w`-Deskriptor
 *    ist eine Zusage über die tatsächliche Breite, und diese Zusage hielt für
 *    jedes Cover, dessen Vorlage kleiner ist, nicht.
 *
 * Der 150er-Kandidat daneben wurde ohnehin nie gezogen: im schmalsten Fall
 * dieser Bildschirme — 320 px Fensterbreite, 100vw, 2× — braucht der Browser
 * 640 Bildpunkte und wählt gemessen das Cover. Zwei Kandidaten, von denen einer
 * nie gewinnt, sind eine Auswahl ohne Auswahl.
 *
 * Geprüft wird die Form, weil es hier keine Rechnung gibt: `srcset` ist
 * Markup, und was daran schiefgehen kann, ist eine Zeile, die zurückkommt.
 */
const SHELF = readFileSync('app/components/ShelfSheet.vue', 'utf8')
const RELEASE = readFileSync('app/components/ReleaseSheet.vue', 'utf8')

/** Ohne Kommentare — diese Datei erklärt, was sie prüft, und die Sheets auch. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

describe.each([
  ['the shelf sheet', SHELF],
  ['the release sheet', RELEASE],
])('%s', (_name, source) => {
  /**
   * Kein `srcset`, und damit auch keine Breitenzusage, die niemand einlöst.
   *
   * Die Alternative wäre, die echten Maße mitzuführen — `images[0]` liefert
   * `width` und `height`. Das kostet ein Feld im Cover-Speicher und damit eine
   * Schema-Version, für eine Auswahl zwischen zwei Kandidaten, deren Ausgang
   * feststeht.
   */
  it('makes no promise about a width it cannot keep', () => {
    expect(code(source)).not.toMatch(/srcset/)
    expect(code(source)).not.toMatch(/600w/)
    // `sizes` ohne `srcset` ist wirkungslos und liest sich, als täte es etwas.
    expect(code(source)).not.toMatch(/\bsizes=/)
  })

  /**
   * Das größte vorhandene Bild, und der 150er nur, wenn es keines gibt.
   *
   * Am `:src` festgemacht und nicht bloß am Vorkommen: `v-if="… coverUrl ||
   * … thumbUrl"` steht eine Zeile darüber und erfüllt jedes lockerere Muster
   * mit. Eine Mutationsprobe hat genau das gezeigt — `:src` auf das Thumbnail
   * umgestellt, und der Test blieb grün, weil er die andere Zeile las.
   */
  it('shows the cover, and falls back to the thumb only when there is none', () => {
    expect(code(source)).toMatch(/:src="\w+\.coverUrl \|\| \w+\.thumbUrl"/)
  })

  /**
   * Und es wird weiterhin nicht aktiv geholt.
   *
   * Bilder haben bei Cloudflare ein eigenes Limit (~30–40/min, `docs/02`), das
   * vom API-Budget getrennt läuft. `loading="lazy"` ist die Regel, unter der
   * die App überhaupt Cover zeigen darf — ein größeres Bild ändert daran
   * nichts.
   */
  it('still waits to be scrolled into view', () => {
    expect(code(source)).toMatch(/loading="lazy"/)
  })
})

/**
 * Die Größen selbst, damit ein Schrumpfen eine Entscheidung bleibt.
 *
 * Am 2026-08-14 im Browser gemessen: Sheet 768 px ab 1280 px Fensterbreite,
 * Cover darin 384 px im Regal und 320 px in der Fundliste. Das Regal-Sheet
 * darf größer sein — es hat rechts nur die Faktenliste neben sich, und die
 * hielt bei 319 px jede Zeile einzeilig.
 */
describe('the cover sizes', () => {
  it('grows with the sheet instead of staying at the phone size', () => {
    expect(SHELF).toMatch(/sm:size-56 sm:w-56 lg:size-80 lg:w-80 xl:size-96 xl:w-96/)
    expect(RELEASE).toMatch(/sm:size-56 sm:w-56 lg:size-72 lg:w-72 xl:size-80 xl:w-80/)
  })

  /** Und das Sheet selbst hat den Platz dafür — sonst wäre das Cover das Sheet. */
  it('has a sheet wide enough to hold it', () => {
    for (const source of [SHELF, RELEASE]) {
      expect(source).toMatch(/max-w-lg .*lg:max-w-2xl xl:max-w-3xl/)
    }
  })
})
