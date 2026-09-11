import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import {
  ASK_AFTER_MS,
  awaitingArrival,
  gradingFor,
  MIN_FOR_RATE,
  recordArrival,
} from '~~/worker/grading'
import type { Feedback } from '#shared/types'

/**
 * Gradet dieser Laden ehrlich? (M14)
 *
 * Die Lücke, die Discogs strukturell nicht schließen kann: dort misst das
 * Feedback „quality of transaction" und sagt nichts über die
 * Bewertungsgenauigkeit; negative Bewertungen wegen Übergrading werden auf
 * Beschwerde des Verkäufers entfernt.
 *
 * **Der Entwurf hängt an einer Zusage, und die steht im letzten Block:** die
 * versprochene Note wird nirgends gespeichert. Sie wäre Discogs-Content, und
 * `docs/09` §1.1 verbietet, ihn nach sechs Stunden zu zeigen. Ein *Vergleich*
 * ist dagegen abgeleitet und darf bleiben.
 */
const kauf = (listingId: number, dealer: string, over: Partial<Feedback> = {}): Feedback => ({
  listingId,
  releaseId: listingId * 10,
  dealer,
  artist: 'Probe',
  title: 'Platte',
  verdict: 'bought',
  signals: [],
  score: 80,
  createdAt: 1_700_000_000_000 + listingId,
  updatedAt: 1_700_000_000_000 + listingId,
  ...over,
})

beforeEach(async () => {
  const db = await openFidelityDb()
  await db.clear('feedback')
})

describe('a shop’s record', () => {
  it('counts what arrived as described', async () => {
    const db = await openFidelityDb()
    for (const [id, arrived] of [
      [1, 'as-described'],
      [2, 'as-described'],
      [3, 'better'],
      [4, 'as-described'],
      [5, 'worse'],
    ] as const) {
      await db.put('feedback', kauf(id, 'plattenkiste', { arrived }))
    }

    const record = await gradingFor('plattenkiste')
    expect(record.judged).toBe(5)
    expect(record.asDescribed).toBe(3)
    expect(record.worse).toBe(1)
    // „Besser als beschrieben" zählt als ehrlich mit: wer untertreibt, hat
    // niemanden enttäuscht.
    expect(record.rate).toBeCloseTo(4 / 5)
  })

  /**
   * Zwei von zwei sind hundert Prozent — und das liest sich wie ein Urteil
   * über einen Laden, über den man nichts weiß.
   */
  it('gives no rate until there is something to rate', async () => {
    const db = await openFidelityDb()
    for (let id = 1; id < MIN_FOR_RATE; id += 1) {
      await db.put('feedback', kauf(id, 'klein', { arrived: 'as-described' }))
    }

    const record = await gradingFor('klein')
    expect(record.judged).toBe(MIN_FOR_RATE - 1)
    expect(record.rate).toBeNull()
  })

  it('keeps shops apart', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', kauf(1, 'a', { arrived: 'worse' }))
    await db.put('feedback', kauf(2, 'b', { arrived: 'as-described' }))

    expect((await gradingFor('a')).worse).toBe(1)
    expect((await gradingFor('b')).worse).toBe(0)
  })

  it('ignores a purchase nobody has judged yet', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', kauf(1, 'a'))
    expect((await gradingFor('a')).judged).toBe(0)
  })
})

describe('the open question', () => {
  it('lists what was bought and not yet judged', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', kauf(1, 'a'))
    await db.put('feedback', kauf(2, 'a', { arrived: 'as-described' }))
    // Ein Daumen ist kein Kauf — hier wartet nichts.
    await db.put('feedback', kauf(3, 'a', { verdict: 'interesting' }))

    const offen = await awaitingArrival()
    expect(offen.map((o) => o.listingId)).toEqual([1])
  })

  it('takes the judgement back if it was a slip', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', kauf(1, 'a', { arrived: 'worse' }))

    await recordArrival(1, null)
    expect((await gradingFor('a')).judged).toBe(0)
    expect((await awaitingArrival()).map((o) => o.listingId)).toEqual([1])

    // Und der Zeitstempel geht mit. Ein Datum für ein Urteil, das es nicht
    // gibt, liest sich später als „beurteilt am" — und ist dann falsch.
    expect((await db.get('feedback', 1))?.arrivedAt).toBeNull()
  })

  /**
   * Und nicht am Kaufabend.
   *
   * Ein Haken bei „gekauft" heißt bestellt. Die Frage, wie die Platte ankam,
   * hat an dem Tag keine Antwort — und eine Frage ohne Antwort bringt man
   * jemandem bei zu überlesen.
   */
  /**
   * Und die Grenze ist eine Wartezeit, keine Formsache.
   *
   * Der Test darunter misst gegen `ASK_AFTER_MS` selbst und hält deshalb auch
   * bei null — eine Mutationsprobe hat genau das gezeigt. Er beweist, dass die
   * Grenze *eingehalten* wird; dass sie überhaupt eine ist, steht hier.
   *
   * Die Spanne statt einer Zahl: zehn Tage sind eine Einschätzung und dürfen
   * sich ändern. „Irgendwo zwischen einer Woche und zwei Monaten" ist die
   * Aussage, die dahinter wirklich steht.
   */
  it('waits a span that matches how long post takes', () => {
    const tag = 24 * 60 * 60 * 1000
    expect(ASK_AFTER_MS).toBeGreaterThanOrEqual(7 * tag)
    expect(ASK_AFTER_MS).toBeLessThanOrEqual(60 * tag)
  })

  it('waits until the post could plausibly have been', async () => {
    const db = await openFidelityDb()
    const jetzt = 1_800_000_000_000
    await db.put('feedback', kauf(1, 'a', { createdAt: jetzt - ASK_AFTER_MS + 1000 }))
    await db.put('feedback', kauf(2, 'a', { createdAt: jetzt - ASK_AFTER_MS }))

    expect((await awaitingArrival(jetzt)).map((o) => o.listingId)).toEqual([2])
  })

  it('says nothing about a listing it does not know', async () => {
    await recordArrival(999, 'worse')
    expect((await gradingFor('a')).judged).toBe(0)
  })
})

/**
 * Und die Zusage, ohne die dieser Entwurf nicht erlaubt wäre.
 */
describe('what is never stored', () => {
  /**
   * **Die versprochene Note.**
   *
   * Sie wäre Discogs-Content, und `docs/09` §1.1 verbietet, ihn zu zeigen,
   * wenn er mehr als sechs Stunden älter ist als das, was bei Discogs steht.
   * Ein *Vergleich* ist abgeleitet — dieselbe Kategorie wie Scores und der
   * Händler-Fingerprint, und die dürfen ausdrücklich bleiben.
   *
   * Die naheliegende Bequemlichkeit wäre, beim Kauf `match.condition`
   * mitzuschreiben und später danebenzustellen. Genau das darf nicht sein.
   */
  it('never keeps the condition a seller claimed', () => {
    const types = readFileSync('shared/types.ts', 'utf8')
    const feedback = types.slice(types.indexOf('export interface Feedback {'))
    const body = feedback.slice(0, feedback.indexOf('\n}'))

    expect(body).not.toMatch(/\bcondition\b/)
    expect(body).not.toMatch(/\bsleeve\b/)
    expect(body).toMatch(/arrived\?:/)

    const worker = readFileSync('worker/grading.ts', 'utf8')
    expect(worker).not.toMatch(/condition|sleeve|Mint|VG\+/)
  })

  /**
   * Und die Frage nennt sie auch nicht.
   *
   * Der Worker speichert keine Note — eine Oberfläche, die trotzdem „dir
   * wurde VG+ versprochen" schreibt, hätte sie sich aus dem Marktplatz geholt
   * und zeigte sie beliebig lange. Geprüft wird am Wortschatz und nicht am
   * Bildschirm: `tests/unit/template-text.spec.ts` verbietet Prosa im
   * Template, also **muss** so ein Satz durch diesen Block. Beide Sprachen,
   * weil eine Übersetzung ein zweiter Ort ist, an dem er entstehen kann.
   */
  it('asks without naming the grade that was promised', () => {
    const i18n = readFileSync('app/i18n/basket.ts', 'utf8')

    const blocks = [...i18n.matchAll(/arrival: \{([\s\S]*?)\n {4}\},/g)].map(
      (match) => match[1]!,
    )
    expect(blocks).toHaveLength(2)

    /*
     * Verboten sind die **Noten**, nicht das Wort „Note".
     *
     * Der erste Anlauf verbot `grade` und `Note` überhaupt — und fiel sofort
     * über den Satz, der erklärt, wozu es das hier gibt: „das Discogs-Feedback
     * bewertet den Ablauf, nicht die Richtigkeit der Note". Ein Test, der die
     * Begründung eines Features verbietet, prüft die falsche Sache. Was nicht
     * auf den Schirm darf, ist ein konkreter Wert — der käme aus dem Listing.
     */
    for (const block of blocks) {
      expect(block).not.toMatch(/\bMint\b|\bNM\b|\bVG\+?\b|\bGood \(G\)|\bPoor \(P\)/)
      expect(block).not.toMatch(/\bcondition\b|\bsleeve\b|\bMedia:|\bSleeve:/)
    }

    // Und der Bildschirm, der fragt, hält sich ebenfalls daran.
    const screen = readFileSync('app/components/ArrivalQuestion.vue', 'utf8')
    expect(screen).not.toMatch(/condition|sleeve|Mint|VG\+/)
  })

  /** Und es geht nirgendwohin — kein Pranger, keine Fremdbewertung. */
  it('stays on this device', () => {
    const worker = readFileSync('worker/grading.ts', 'utf8')
    expect(worker).not.toMatch(/fetch\(|hub|DiscogsClient|discogs\.com/i)
  })
})
