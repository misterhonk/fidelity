import type { WatchedRelease, WatchPoint } from '#shared/types'

/**
 * Wann eine beobachtete Platte eine Meldung wert ist (M11).
 *
 * **Reine Funktionen, kein I/O** — wie `worker/match/`, und aus demselben
 * Grund: das hier ist die einzige Stelle mit einer Entscheidung, und
 * Entscheidungen gehören geprüft, ohne eine Datenbank aufzumachen.
 *
 * Die Richtung hängt daran, wem die Platte gehört. Bei einer eigenen ist der
 * **Anstieg** die Neuigkeit („die billigste kostet jetzt 95 statt 40"), bei
 * einer gesuchten der **Fall** unter die eigene Schmerzgrenze.
 */

export type WatchNews =
  | { kind: 'rose'; from: number; to: number; percent: number; currency: string | null }
  | { kind: 'fell'; to: number; threshold: number; currency: string | null }
  | { kind: 'appeared'; numForSale: number; price: number | null; currency: string | null }
  | { kind: 'fewer'; from: number; to: number }

/**
 * Der älteste Punkt, mit dem verglichen wird.
 *
 * Nicht der vorletzte: zwischen zwei Messungen im Abstand eines Tages liegt
 * fast nie etwas, und wer nur Nachbarn vergleicht, sieht einen Anstieg von
 * vierzig auf fünfundneunzig nie — er kommt in dreißig kleinen Schritten.
 * Verglichen wird deshalb mit dem ältesten Punkt im Fenster.
 */
export const WINDOW_MS = 90 * 24 * 60 * 60 * 1000

/** Wie viele Messungen aufgehoben werden. Eine pro Tag, ein Vierteljahr weit. */
export const MAX_POINTS = 120

/**
 * Was sich seit dem ältesten Punkt im Fenster getan hat — oder nichts.
 *
 * `null` heißt „keine Nachricht", und das ist der Normalfall: eine Platte, die
 * seit drei Monaten dasselbe kostet, hat nichts zu sagen.
 */
export function judge(watched: WatchedRelease, now: number): WatchNews | null {
  const points = watched.points
  const latest = points.at(-1)
  if (!latest) return null

  const oldest = points.find((point) => point.at >= now - WINDOW_MS) ?? points[0]
  if (!oldest || oldest === latest) return null

  if (watched.kind === 'shelf') return judgeShelf(watched, oldest, latest)
  return judgeWantlist(watched, oldest, latest)
}

/**
 * Die eigene Platte: ist sie mehr wert geworden?
 *
 * Das ist die Frage, die sonst niemand beantwortet — Discogs sagt es einem
 * nicht, und wer verkaufen will, erfährt vom Anstieg heute durch Zufall.
 */
function judgeShelf(
  watched: WatchedRelease,
  oldest: WatchPoint,
  latest: WatchPoint,
): WatchNews | null {
  const threshold = watched.threshold ?? 25

  if (oldest.lowestPrice !== null && latest.lowestPrice !== null && oldest.lowestPrice > 0) {
    const percent = Math.round(
      ((latest.lowestPrice - oldest.lowestPrice) / oldest.lowestPrice) * 100,
    )
    if (percent >= threshold) {
      return {
        kind: 'rose',
        from: oldest.lowestPrice,
        to: latest.lowestPrice,
        percent,
        currency: latest.currency,
      }
    }
  }

  /*
   * Und die andere Hälfte: es verschwinden Exemplare.
   *
   * **„Verkauft" wird nicht behauptet.** Ein fallendes `num_for_sale` kann ein
   * Kauf sein oder ein zurückgezogenes Listing, und die API sagt nicht,
   * welches. Der Text sagt deshalb „ein Angebot weniger" — was gemessen wurde,
   * nicht was vermutet wird.
   *
   * Erst ab zwei, weil ein einzelnes Exemplar ständig kommt und geht.
   */
  if (oldest.numForSale - latest.numForSale >= 2) {
    return { kind: 'fewer', from: oldest.numForSale, to: latest.numForSale }
  }

  return null
}

/**
 * Die gesuchte Platte: ist sie erschwinglich geworden — oder überhaupt da?
 *
 * ⚠️ Hier ist Fidelity **schwächer als Discogs' eigener Wantlister**, und das
 * gehört gesagt: der weiß, *wer* gerade gelistet hat, weil Discogs den
 * Marktplatz besitzt. Wir sehen nur „es gibt jetzt drei, die billigste für
 * 24 €". Der Mehrwert ist die **Schwelle**, nicht die Entdeckung — deshalb
 * nennt keine dieser Nachrichten einen Laden.
 */
function judgeWantlist(
  watched: WatchedRelease,
  oldest: WatchPoint,
  latest: WatchPoint,
): WatchNews | null {
  if (watched.threshold !== null && latest.lowestPrice !== null) {
    const war = oldest.lowestPrice
    // Nur beim Übertreten melden, nicht solange es darunter bleibt.
    const drueber = war === null || war > watched.threshold
    if (drueber && latest.lowestPrice <= watched.threshold) {
      return {
        kind: 'fell',
        to: latest.lowestPrice,
        threshold: watched.threshold,
        currency: latest.currency,
      }
    }
  }

  // Von null auf irgendetwas: die Platte war nirgends zu haben und ist es
  // jetzt. Für eine seltene Platte ist das die eigentliche Nachricht.
  if (oldest.numForSale === 0 && latest.numForSale > 0) {
    return {
      kind: 'appeared',
      numForSale: latest.numForSale,
      price: latest.lowestPrice,
      currency: latest.currency,
    }
  }

  return null
}

/**
 * Einen Messpunkt anhängen und den Verlauf kurz halten.
 *
 * Höchstens einer pro Tag: wer die App fünfmal öffnet, misst fünfmal
 * dasselbe, und fünf identische Punkte machen aus dem ältesten im Fenster den
 * von heute Morgen.
 */
export function addPoint(points: WatchPoint[], next: WatchPoint): WatchPoint[] {
  const previous = points.at(-1)
  const sameDay =
    previous !== undefined &&
    new Date(previous.at).toDateString() === new Date(next.at).toDateString()

  const kept = sameDay ? points.slice(0, -1) : points
  return [...kept, next].slice(-MAX_POINTS)
}
