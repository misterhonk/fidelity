import { openFidelityDb } from '~~/db/open'

/**
 * Welche konkreten Angebote ein Dig für eine Platte gesehen hat (M11).
 *
 * **Warum es das überhaupt geben kann.** Der Wächter fragt
 * `/marketplace/stats/{id}` und bekommt eine Zahl: „drei Exemplare, billigstes
 * 24 €". Wer sie anbietet, sagt Discogs nicht — `/marketplace/listings?
 * release_id=…` antwortet mit 405, und einen Ersatz gibt es nicht (`docs/02`).
 * Deshalb steht auf dem Wächter-Bildschirm kein Laden.
 *
 * Mit **einer** Ausnahme, und die ist hier: ein Dig, den dieses Gerät selbst
 * gefahren hat, hat Angebote mit ihrer Listing-ID gesehen. Die überleben den
 * Ablauf — `db/expire.ts` nullt die Marktplatzfelder, `listingId` und `digId`
 * gehören uns. Über `GET /marketplace/listings/{id}` ist ein einzelnes Angebot
 * abrufbar, und `status` sagt, ob es noch zu haben ist.
 *
 * Das macht aus „ein Angebot weniger" ein „die Kopie bei Plattenkiste ist
 * weg". Nicht „verkauft" — ein Listing kann auch zurückgezogen werden, und die
 * API sagt nicht, welches von beidem.
 */

/**
 * Wie viele Angebote je Meldung nachgeschlagen werden.
 *
 * Jedes kostet einen Request, und der Wächter läuft über bis zu hundert
 * Platten. Drei ist die Grenze, an der aus „nachsehen" ein Vorgang würde:
 * gefragt wird ohnehin nur, wenn die Zahl gefallen ist, und das ist selten.
 */
export const MAX_CONFIRM = 3

export interface SeenOffer {
  listingId: number
  /** Wo es gesehen wurde. Der einzige Laden, den dieser Bildschirm nennen darf. */
  dealer: string
  /** Wann der Dig lief — das Jüngste zuerst, Altes ist wahrscheinlicher weg. */
  at: number
}

/**
 * Die Angebote aus den aufgehobenen Digs, jüngstes zuerst.
 *
 * Ohne Index über `releaseId`: die Digs sind auf fünf gedeckelt
 * (`DIG_HISTORY_LIMIT`), und ein Index, der bei jedem Scan mitgeschrieben
 * wird, kostet mehr als ein Durchlauf, der selten stattfindet.
 */
export async function seenOffers(releaseId: number): Promise<SeenOffer[]> {
  const db = await openFidelityDb()

  const whenAndWho = new Map<string, { at: number; dealer: string }>()
  for (const dig of await db.getAll('digs')) {
    whenAndWho.set(dig.id, { at: dig.startedAt, dealer: dig.dealer })
  }

  const found = new Map<number, SeenOffer>()
  for (const match of await db.getAll('matches')) {
    if (match.releaseId !== releaseId) continue

    const dig = whenAndWho.get(match.digId)
    if (!dig) continue

    /*
     * Dasselbe Angebot in zwei Digs ist ein Angebot. Behalten wird der
     * jüngere Fund — er trägt den Laden, unter dem es zuletzt gesehen wurde.
     */
    const known = found.get(match.listingId)
    if (known && known.at >= dig.at) continue

    found.set(match.listingId, { listingId: match.listingId, dealer: dig.dealer, at: dig.at })
  }

  return [...found.values()].sort((a, b) => b.at - a.at)
}
