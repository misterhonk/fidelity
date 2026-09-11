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
    const SCHMAL = 'mx-auto flex w-full max-w-3xl flex-col'

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
      if (!/\bmax-w-/.test(klassen)) continue

      if (!klassen.startsWith(SCHMAL)) abweichend.push(`${datei}: ${klassen.slice(0, 60)}`)
    }

    expect(abweichend).toEqual([])
  })
})
