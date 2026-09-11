import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Ein Maß für die ganze App.
 *
 * **Der Anlass war ein Screenshot-Stapel, nicht eine Idee.** Am 2026-09-11
 * gemeldet: beim Durchklicken der fünf Sammlungs-Reiter springt die Seite bei
 * jedem Wechsel seitwärts. Nachgemessen war es schlimmer als vermutet — fünf
 * Reiter, vier Breiten:
 *
 * | Regal | Landkarte | Wantlist | Im Blick · Orte |
 * |---|---|---|---|
 * | 110rem | 90rem | 80rem | 48rem |
 *
 * Und die Hauptleiste lag bei 48rem, floh also auf keiner einzigen Seite mit
 * dem Inhalt darunter. Sechs verschiedene linke Kanten über dreizehn Seiten.
 *
 * `docs/05` §3a hatte die Breiten je *Seite* vergeben, mit einer richtigen
 * Begründung — „Daten dürfen breit werden, Text nicht". Falsch war die Ebene:
 * eine Breite gehört zu einem *Bereich*. Zwei Sichten auf dieselbe Sammlung
 * dürfen kein Umzug sein.
 *
 * Seitdem: ein Container, immer. Was schmal bleiben muss, bekommt sein Maß
 * innen und wird **links verankert** statt zentriert — sonst wandert die Kante
 * wieder. Nachgemessen bei 1800 px: dreizehn Seiten, eine Kante, 44 px.
 */

const SEITEN = readdirSync('app/pages', { recursive: true, encoding: 'utf8' })
  .filter((datei) => datei.endsWith('.vue'))
  .map((datei) => ({ datei, quelle: readFileSync(`app/pages/${datei}`, 'utf8') }))

/**
 * Der Bildschirm, der kein Container ist.
 *
 * Im Stapel *ist* die Karte die Seite: ganzflächig, eine nach der anderen,
 * gewischt statt gescrollt. Ein Seitenmaß darüber wäre ein Rahmen um etwas,
 * das keinen haben soll. Benannt statt erkannt — ein zweiter Eintrag hier
 * braucht ein Argument, keinen Commit.
 */
const OHNE_MASS = ['stack.vue']

describe('every screen shares one measure', () => {
  it('uses fid-page, or says why not', () => {
    const abweichler = SEITEN.filter(({ datei, quelle }) => {
      if (OHNE_MASS.includes(datei)) return false
      /*
       * Seiten ohne eigenes `<main>` erben einen Rahmen — die
       * Einstellungs-Unterseiten liegen alle in `SettingsPage.vue`. Sie hier
       * zu verlangen hieße, denselben Container achtmal zu setzen.
       */
      if (!quelle.includes('<main')) return false
      return !/class="[^"]*\bfid-page(-flush)?\b/.test(quelle)
    }).map(({ datei }) => datei)

    expect(abweichler).toEqual([])
  })

  /** Und der geerbte Rahmen trägt es auch. */
  it('includes the frame the settings pages sit in', () => {
    expect(readFileSync('app/components/SettingsPage.vue', 'utf8')).toMatch(/\bfid-page\b/)
  })

  /**
   * Und keine Seite setzt daneben ihr eigenes Maß.
   *
   * Ein `max-w-…` am `<main>` neben `fid-page` wäre die alte Welt zurück: die
   * Klasse sagt „ein Maß" und die Zeile daneben widerspricht ihr. Innen ist
   * ein `max-w-…` dagegen genau richtig — dort entscheidet der Inhalt.
   */
  it('does not set a second width on the page itself', () => {
    const doppelt = SEITEN.filter(({ datei, quelle }) => {
      if (OHNE_MASS.includes(datei)) return false
      const auf = quelle.indexOf('<main')
      if (auf === -1) return false
      const tag = quelle.slice(auf, quelle.indexOf('>', auf))
      return /\bmax-w-/.test(tag)
    }).map(({ datei }) => datei)

    expect(doppelt).toEqual([])
  })

  /**
   * Die Hauptleiste gehört dazu.
   *
   * Sie lag bei `max-w-3xl` und war damit auf jeder Seite gegen den Inhalt
   * versetzt — der auffälligste Teil des Problems und der, den man am
   * wenigsten einem einzelnen Bildschirm anlastet.
   */
  it('includes the navigation bar', () => {
    expect(readFileSync('app/components/AppNav.vue', 'utf8')).toMatch(/\bfid-page\b/)
  })

  /**
   * Schmaler Inhalt wird links verankert, nicht zentriert.
   *
   * `mx-auto` innerhalb einer Seite bringt genau das zurück, was hier
   * abgeschafft wurde: ein Block, dessen linke Kante von seiner eigenen Breite
   * abhängt. Der Container zentriert bereits — ein zweites Mal zentrieren
   * heißt, gegen ihn zu arbeiten.
   */
  it('anchors narrow content instead of centring it again', () => {
    const zentriert = SEITEN.filter(({ datei, quelle }) => {
      if (OHNE_MASS.includes(datei)) return false
      return /class="[^"]*\bmx-auto\b[^"]*\bmax-w-/.test(quelle)
    }).map(({ datei }) => datei)

    expect(zentriert).toEqual([])
  })
})
