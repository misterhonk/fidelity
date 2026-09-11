/**
 * Den handgeschriebenen Vorspann einer Ausgabe in etwas Zeichenbares zerlegen.
 *
 * **Warum nicht `v-html`, und warum keine Markdown-Bibliothek.** Ein Parser
 * wiegt dreißig Kilobyte und kann alles; gebraucht werden vier Dinge, die in
 * diesen Absätzen tatsächlich vorkommen: fette Stellen, Code in Backticks,
 * Links und Aufzählungspunkte. Und `v-html` auf Text, der durch einen Build
 * läuft, ist eine Tür, die man nicht aufmachen muss, wenn man sie nicht
 * braucht — hier wird strukturiert statt eingesetzt.
 *
 * **Der Text kommt aus `CHANGELOG.md`, zur Bauzeit** (`nuxt.config.ts`), und
 * zwar nur der Absatz zwischen Versionsüberschrift und erstem `###`. Die
 * Commit-Listen darunter sind für das Repository geschrieben.
 */

export type Stueck =
  | { art: 'text'; text: string }
  | { art: 'stark'; text: string }
  | { art: 'code'; text: string }
  | { art: 'link'; text: string; href: string }

export type Block = { art: 'absatz' | 'punkt'; stuecke: Stueck[] }

/**
 * Fett, Code und Links — in einem Durchgang, damit die Reihenfolge stimmt.
 *
 * Nacheinander gesucht käme `**[Text](url)**` falsch heraus: die fette Stelle
 * verschluckte die Klammern. Ein Ausdruck, eine Runde, keine Verschachtelung —
 * die gibt es in diesen Absätzen nicht, und wenn sie je vorkäme, fiele sie als
 * sichtbares Sternchen auf statt still falsch zu sein.
 */
const INLINE = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((\S+?)\)/g

export function stuecke(zeile: string): Stueck[] {
  const raus: Stueck[] = []
  let zuletzt = 0

  for (const treffer of zeile.matchAll(INLINE)) {
    const bei = treffer.index
    if (bei > zuletzt) raus.push({ art: 'text', text: zeile.slice(zuletzt, bei) })

    const [ganz, stark, code, linkText, href] = treffer
    if (stark !== undefined) raus.push({ art: 'stark', text: stark })
    else if (code !== undefined) raus.push({ art: 'code', text: code })
    else if (linkText !== undefined && href !== undefined) {
      raus.push({ art: 'link', text: linkText, href })
    }

    zuletzt = bei + ganz.length
  }

  if (zuletzt < zeile.length) raus.push({ art: 'text', text: zeile.slice(zuletzt) })
  return raus
}

/**
 * Absätze und Aufzählungspunkte.
 *
 * Zeilenumbrüche innerhalb eines Absatzes sind im Changelog reine Satzbreite —
 * die Datei ist auf hundert Zeichen umbrochen. Sie werden zu Leerzeichen, weil
 * ein Bildschirm anders bricht als ein Editor.
 */
export function bloecke(vorspann: string): Block[] {
  if (!vorspann.trim()) return []

  const raus: Block[] = []
  let absatz: string[] = []

  const absatzSchliessen = () => {
    if (absatz.length > 0) {
      raus.push({ art: 'absatz', stuecke: stuecke(absatz.join(' ')) })
      absatz = []
    }
  }

  let punkt: string[] = []
  const punktSchliessen = () => {
    if (punkt.length > 0) {
      raus.push({ art: 'punkt', stuecke: stuecke(punkt.join(' ')) })
      punkt = []
    }
  }

  for (const zeile of vorspann.split('\n')) {
    const roh = zeile.trim()

    if (roh === '') {
      absatzSchliessen()
      punktSchliessen()
      continue
    }

    const punktAnfang = roh.match(/^[-*]\s+(.*)$/)
    if (punktAnfang) {
      absatzSchliessen()
      punktSchliessen()
      punkt.push(punktAnfang[1]!)
      continue
    }

    // Eingerückte Fortsetzung gehört zum laufenden Punkt, nicht zu einem
    // neuen Absatz — sonst zerfällt jeder mehrzeilige Aufzählungspunkt.
    if (punkt.length > 0 && /^\s/.test(zeile)) {
      punkt.push(roh)
      continue
    }

    punktSchliessen()
    absatz.push(roh)
  }

  absatzSchliessen()
  punktSchliessen()
  return raus
}
