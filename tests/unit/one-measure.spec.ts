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
 * Seitdem: ein Container, immer — und **ein** schmales Maß darin, zentriert.
 * Also zwei Kanten statt sechs: die des Containers, den sich die Hauptleiste
 * mit den breiten Seiten teilt, und die der schmalen Spalte.
 *
 * Zentriert statt links verankert, weil links verankert zwar die Kante hält,
 * aber eine 48rem-Spalte auf einem 1800er Schirm ans linke Drittel klebt. Der
 * Handel wurde am laufenden Bild entschieden, nicht am Prinzip.
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
   * **Und schmaler Inhalt hat *ein* schmales Maß.**
   *
   * Das war der zweite Teil des Befunds und der leiser versteckte. Auch unter
   * den schmalen Seiten gab es vier Breiten — 48rem für Korb, Orte und die
   * Rechtsseiten, 42rem für die Einrichtung, 36rem für „Was neu ist" und für
   * den Laden-Modus. Zentriert heißt: die Breite bestimmt die linke Kante.
   * Vier Breiten sind vier Kanten, nur langsamer bemerkt.
   *
   * Zentriert **und** einheitlich ist die Auflösung: der äußere Container hält
   * die Leiste in der Flucht, und innen steht jede schmale Seite an derselben
   * Stelle wie jede andere schmale Seite.
   *
   * Geprüft am Block direkt hinter `<main>` — der ist der Umschlag, den diese
   * Regel meint. Ein `max-w-…` weiter innen gehört einer Karte oder einem
   * Absatz und ist genau richtig dort.
   */
  it('gives narrow content one measure, centred', () => {
    /*
     * An den Klassen selbst geprüft, nicht an ihrer Reihenfolge.
     *
     * Der erste Anlauf verglich einen Präfix — und brach, sobald `@container`
     * davorrückte, obwohl an der Regel nichts falsch war. Ein Test, der die
     * Schreibweise festnagelt statt der Aussage, meldet Umbauten als Fehler.
     */

    const abweichend: string[] = []
    for (const { datei, quelle } of [
      ...SEITEN.map((s) => ({ ...s })),
      {
        datei: 'components/SettingsPage.vue',
        quelle: readFileSync('app/components/SettingsPage.vue', 'utf8'),
      },
    ]) {
      if (OHNE_MASS.includes(datei)) continue

      const auf = quelle.indexOf('<main')
      if (auf === -1) continue
      const nachTag = quelle.indexOf('>', auf) + 1

      // Der erste Block dahinter — nur wenn er überhaupt ein Maß trägt.
      const ersterDiv = quelle.slice(nachTag).match(/<div class="([^"]*)"/)
      if (!ersterDiv) continue
      const klassen = ersterDiv[1]!
      const teile = klassen.split(/\s+/)
      const masse = teile.filter((t) => t.startsWith('max-w-'))
      if (masse.length === 0) continue

      const stimmt = masse.length === 1 && masse[0] === 'max-w-3xl' && teile.includes('mx-auto')
      if (!stimmt) abweichend.push(`${datei}: ${klassen.slice(0, 60)}`)
    }

    expect(abweichend).toEqual([])
  })

  /**
   * **Und `@container` sitzt auf dem Kasten, dessen Breite der Inhalt hat.**
   *
   * Container-Queries messen genau das Element mit `@container`. Nach dem
   * Umbau war das auf den schmalen Seiten der 110rem-Container, während der
   * Inhalt in einer 48rem-Spalte steht — eine Variante darin hätte gegen die
   * falsche Kiste gemessen.
   *
   * **Kaputt war dadurch nichts**, und das ist nachgerechnet, nicht gehofft:
   * eine höhere Kappe ändert nur Schwellen *zwischen* alter und neuer Kappe,
   * und in den schmalen Spalten liegt keine über 768 px. Es war eine Falle für
   * die nächste Variante, nicht ein Fehler in der jetzigen — und die Art
   * Falle, die man beim Zuschlagen nicht mehr auf diesen Umbau zurückführt.
   */
  it('puts @container on the box the content actually fills', () => {
    const falsch: string[] = []
    for (const { datei, quelle } of [
      ...SEITEN,
      {
        datei: 'components/SettingsPage.vue',
        quelle: readFileSync('app/components/SettingsPage.vue', 'utf8'),
      },
    ]) {
      const auf = quelle.indexOf('<main')
      if (auf === -1) continue
      const tag = quelle.slice(auf, quelle.indexOf('>', auf))
      if (!tag.includes('@container')) continue

      // Ein `@container` am `<main>` ist nur richtig, wenn der Inhalt es auch
      // ausfüllt — also wenn es darunter keine schmale Spalte gibt.
      const nachTag = quelle.indexOf('>', auf) + 1
      const ersterDiv = quelle.slice(nachTag).match(/<div class="([^"]*)"/)
      if (ersterDiv && /\bmax-w-3xl\b/.test(ersterDiv[1]!)) falsch.push(datei)
    }

    expect(falsch).toEqual([])
  })
})
