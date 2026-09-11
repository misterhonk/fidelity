import { openFidelityDb } from '~~/db/open'
import type { GradingRecord } from '#shared/types'

/**
 * Gradet dieser Laden ehrlich? (M14)
 *
 * **Die Lücke, die Discogs strukturell nicht schließen kann.** Dort misst das
 * Feedback „quality of transaction" und sagt nichts über die
 * Bewertungsgenauigkeit; negative Bewertungen wegen Übergrading werden auf
 * Beschwerde des Verkäufers entfernt. Übrig bleibt Aberglaube — „kauf nichts
 * unter 100 %".
 *
 * Was hier entsteht, ist keine Fremdbewertung und kein Pranger, sondern eine
 * **private Aufzeichnung der eigenen Käufe**: bei diesem Laden waren sieben
 * von acht Platten so, wie sie beschrieben waren.
 *
 * **Die versprochene Note wird nirgends gespeichert.** Sie wäre
 * Discogs-Content und dürfte nach sechs Stunden nicht mehr gezeigt werden
 * (`docs/09` §1.1). Gespeichert wird nur der Vergleich — ein abgeleitetes
 * Datum, dieselbe Kategorie wie Scores und Fingerprint.
 *
 * Kostet keinen Request: alles steht im `feedback`-Store.
 */

/**
 * Unter dieser Zahl wird keine Quote gezeigt.
 *
 * Zwei von zwei sind 100 %, und das liest sich wie ein Urteil über einen
 * Laden, über den man nichts weiß. Ab fünf trägt die Zahl etwas; darunter
 * steht die nackte Anzahl, die niemanden in die Irre führt.
 */
export const MIN_FOR_RATE = 5

/**
 * Wie lange nach dem Kauf frühestens gefragt wird.
 *
 * Ein Haken bei „gekauft" heißt bestellt, nicht angekommen. Wer am selben
 * Abend gefragt wird, wie die Platte war, lernt in einer Woche, die Frage zu
 * überlesen — und dann sammelt sich nie genug an, um eine Quote zu tragen.
 *
 * Zehn Tage sind kein gemessener Wert, sondern eine bewusst großzügige Grenze:
 * Auslandsversand von Platten dauert regelmäßig zwei Wochen, und zu früh
 * gefragt ist teurer als zu spät. **Das betrifft nur die Frage von selbst.**
 * Auf der Kaufliste steht sie ab dem ersten Tag — wer die Platte schon in der
 * Hand hat, soll antworten dürfen.
 */
export const ASK_AFTER_MS = 10 * 24 * 60 * 60 * 1000

export async function gradingFor(dealer: string): Promise<GradingRecord> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')

  const mine = all.filter((row) => row.dealer === dealer && row.arrived)
  const asDescribed = mine.filter((row) => row.arrived === 'as-described').length
  const better = mine.filter((row) => row.arrived === 'better').length
  const worse = mine.filter((row) => row.arrived === 'worse').length

  return {
    dealer,
    judged: mine.length,
    asDescribed,
    better,
    worse,
    /*
     * „Besser als beschrieben" zählt als ehrlich mit.
     *
     * Wer untertreibt, hat einen nicht enttäuscht — und ein Laden, dessen
     * Platten regelmäßig besser ankommen als angesagt, ist genau das
     * Gegenteil des Problems, um das es hier geht.
     */
    rate: mine.length >= MIN_FOR_RATE ? (asDescribed + better) / mine.length : null,
  }
}

/** Wie eine gekaufte Platte ankam. Nur vom Käufer, nur auf diesem Gerät. */
export async function recordArrival(
  listingId: number,
  arrived: 'as-described' | 'better' | 'worse' | null,
): Promise<void> {
  const db = await openFidelityDb()
  const row = await db.get('feedback', listingId)
  if (!row) return

  await db.put('feedback', {
    ...row,
    arrived,
    arrivedAt: arrived ? Date.now() : null,
    updatedAt: Date.now(),
  })
}

/**
 * Was gekauft, lange genug her und noch nicht beurteilt ist — die offene Frage.
 *
 * Die Zeitgrenze gehört hierher und nicht in einen Bildschirm: „wann ist die
 * Frage fällig" ist eine Entscheidung über die Daten, und eine, die man
 * nachrechnen können muss.
 */
export async function awaitingArrival(
  now = Date.now(),
): Promise<
  { listingId: number; dealer: string | null; artist: string | null; title: string | null }[]
> {
  const db = await openFidelityDb()
  const all = await db.getAll('feedback')

  return all
    .filter(
      (row) => row.verdict === 'bought' && !row.arrived && now - row.createdAt >= ASK_AFTER_MS,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((row) => ({
      listingId: row.listingId,
      dealer: row.dealer ?? null,
      artist: row.artist ?? null,
      title: row.title ?? null,
    }))
}
