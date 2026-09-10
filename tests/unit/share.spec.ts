import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Eine geteilte Fundliste — und die drei Zusagen, die sie zusammenhalten.
 *
 * 1. **Der Schlüssel steht im Fragment.** Das ist der einzige Teil einer
 *    Adresse, den kein Browser an einen Server schickt. Stünde er als `?k=`
 *    daneben, läge er in jedem Zugriffs-Log des Hubs und jedes Reverse Proxy
 *    davor — und die ganze Verschlüsselung wäre Zierde.
 * 2. **Der Empfänger schickt kein Secret mit.** Er hat keins; und selbst wenn
 *    er zufällig eines für einen anderen Hub hätte, hätte es an einem fremden
 *    Server nichts zu suchen.
 * 3. **Die Uhr läuft ab dem Scan, nicht ab dem Verschicken.** Eine fünf
 *    Stunden alte Fundliste, beim Teilen neu gestartet, wäre am Ende elf
 *    Stunden alt — und Regel 4 erlaubt sechs.
 *
 * Geprüft wird die Form, weil keine dieser drei eine Rechnung ist. Sie sind
 * Entscheidungen darüber, wohin ein Wert geschrieben wird, und was daran
 * schiefgeht, sieht man einer laufenden App nicht an.
 */
const SHARE = readFileSync('worker/share.ts', 'utf8')
const CLIENT = readFileSync('worker/hub/client.ts', 'utf8')
const PAGE = readFileSync('app/pages/shared.vue', 'utf8')
const DIG = readFileSync('app/pages/dig.vue', 'utf8')

/** Ohne Kommentare — diese Datei erklärt, was sie prüft, und die anderen auch. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('the link that carries a find list', () => {
  it('puts the key in the fragment, never in the query', () => {
    // `#k=` und nichts anderes. Ein `?k=` hier wäre der ganze Fehler.
    expect(code(DIG)).toMatch(/\/shared\?id=\$\{[^}]+\}#k=\$\{[^}]+\}/)
    expect(code(DIG)).not.toMatch(/[?&]k=/)
  })

  it('reads it back out of the fragment', () => {
    expect(code(PAGE)).toMatch(/location\.hash/)
    // Und die Kennung aus der Query, weil sie dort hingehört: der Server muss
    // sie sehen, sonst findet er nichts.
    expect(code(PAGE)).toMatch(/route\.query\.id/)
  })

  /**
   * Der Schlüssel wird zufällig erzeugt, nicht abgeleitet.
   *
   * `Math.random()` ist kein Zufallsgenerator für etwas, das eine Fundliste
   * verschließt — und der Unterschied ist im laufenden Betrieb unsichtbar.
   */
  it('draws the key from the browser’s own randomness', () => {
    expect(code(SHARE)).toMatch(/crypto\.getRandomValues/)
    expect(code(SHARE)).not.toMatch(/Math\.random/)
  })
})

describe('the recipient', () => {
  /**
   * Der wichtigste Test dieser Datei.
   *
   * `createHubClient` hängt `x-hub-secret` an, sobald ein Secret übergeben
   * wird. Beim Lesen einer geteilten Liste darf das nicht passieren: der
   * Empfänger hat keins, und ein Secret gehört nicht an einen Server, nur weil
   * ein Link auf ihn zeigt.
   */
  it('asks without a secret, because they have none', () => {
    expect(code(SHARE)).toMatch(
      /createHubClient\(\{\s*baseUrl:\s*hubUrl,\s*secret:\s*null\s*\}\)/,
    )
  })

  it('sends no secret header on the way out either', () => {
    // Die Methode im Client baut ihre Kopfzeilen selbst, statt `headers` zu
    // nehmen — dort steckt das Secret des *lesenden* Geräts.
    // Ohne Kommentare gelesen: in der Begründung daneben steht das Wort
    // `headers`, und die soll den Test nicht auslösen.
    const bare = code(CLIENT)
    const shareRead = bare.slice(bare.indexOf('async shareRead('))
    const body = shareRead.slice(0, shareRead.indexOf('async contributeHorizon'))
    expect(body).not.toMatch(/\bheaders\b(?!:)/)
    expect(body).toMatch(/headers: \{ 'content-type': 'application\/json' \}/)
  })

  /** Ohne Token, ohne Sammlung, ohne alles — sonst ist der Link eine Sackgasse. */
  it('reaches a screen that needs no setup', () => {
    const guard = readFileSync('app/middleware/setup.global.ts', 'utf8')
    expect(guard).toMatch(/'\/shared'/)
  })
})

describe('the six-hour rule', () => {
  /**
   * Die Ablaufzeit kommt aus dem Dig und wird nicht neu gestartet.
   *
   * Der teure Fehler wäre `Date.now() + SECHS_STUNDEN` — er sieht richtig aus,
   * ist einfacher zu schreiben, und verdoppelt im schlechtesten Fall das
   * Alter der Preise, die jemand zu sehen bekommt.
   */
  it('carries the dig’s own clock, not a fresh one', () => {
    expect(code(SHARE)).toMatch(/expiresAt: dig\.expiresAt/)
    expect(code(SHARE)).toMatch(/hub\.shareWrite\(id, sealed, dig\.expiresAt\)/)
    // Keine eigene Frist irgendwo in dieser Datei.
    expect(code(SHARE)).not.toMatch(/6 \* 60 \* 60|21_600_000|SIX_HOURS/)
  })

  it('refuses to share what may no longer be shown', () => {
    expect(code(SHARE)).toMatch(/Date\.now\(\) >= dig\.expiresAt/)
  })

  it('checks again when the link is opened', () => {
    // Und diesmal ist es kein toter Zweig: der Server hat eine Uhr, das Gerät
    // eine andere, und es zählt die, vor der jemand sitzt.
    expect(code(SHARE)).toMatch(/Date\.now\(\) >= snapshot\.expiresAt/)
  })

  it('takes the button away once the dig is stale', () => {
    expect(code(DIG)).toMatch(/v-if="!expired"/)
  })
})

describe('what travels', () => {
  /** Die Auswahl trifft der Bildschirm, nicht ein zweiter Datenbankzugriff. */
  it('shares the list that is on screen, folded copies and all', () => {
    expect(code(SHARE)).toMatch(/loaded\.matches\.slice\(0, MAX_SHARED_MATCHES\)/)
    expect(code(SHARE)).toMatch(/matchesTotal: loaded\.matches\.length/)
  })

  /**
   * Und der Schnappschuss behauptet nicht, hundert seien alles gewesen.
   *
   * Ohne `matchesTotal` liest sich eine gekappte Liste wie eine vollständige,
   * und der Empfänger schließt aus „hundert Treffer" auf einen Laden, den es
   * so nicht gibt.
   */
  it('says how many there really were', () => {
    expect(code(PAGE)).toMatch(/snapshot\.matchesTotal/)
  })
})
