import { openFidelityDb } from '~~/db/open'

import type { StockRow } from '#shared/types'

/**
 * Das Sortiment eines Ladens, nach einem Balken gefiltert.
 *
 * Die Zahlen unter „Labels in stock" und „Decades" waren bis hierher tote
 * Auskunft: man sah, dass fatplastics 13 Platten auf Kompakt führt, und kam an
 * keine davon heran. Interessant ist das vor allem bei einem Label, von dem man
 * noch nichts besitzt — dort gibt es per Definition keinen Treffer, der einen
 * hinführen könnte.
 *
 * **Gelesen wird über einen Index, nicht über einen Durchlauf.** Ein großer
 * Laden hat zwanzigtausend Zeilen; sie alle zu holen, um zwanzig zu zeigen,
 * wäre auf einem Telefon spürbar. `by-dig-label` und `by-dig-decade` machen
 * daraus ein Bereichslesen, und der Ausschnitt kommt über einen Cursor.
 */

/** Wie viele Zeilen eine Seite hat, wenn niemand etwas anderes sagt. */
export const STOCK_PAGE = 50

export interface StockQuery {
  dealer: string
  /** Genau die Schreibweise aus dem Balken. */
  label?: string | null
  /** `1990` für die Neunziger. */
  decade?: number | null
  offset?: number
  limit?: number
}

export interface StockPage {
  rows: StockRow[]
  /** Wie viele es insgesamt sind — für „20 von 213" und fürs Blättern. */
  total: number
  /**
   * Wann der Dig lief, aus dem diese Zeilen stammen.
   *
   * Null heißt: es gibt keinen frischen. Das Sortiment ist ein Marktplatzdatum
   * und lebt sechs Stunden (Regel 4); danach ist es gelöscht, nicht veraltet.
   * Der Bildschirm muss den Unterschied zwischen „der Laden hat nichts davon"
   * und „wir wissen es gerade nicht" sagen können.
   */
  scannedAt: number | null
}

export async function dealerStock({
  dealer,
  label = null,
  decade = null,
  offset = 0,
  limit = STOCK_PAGE,
}: StockQuery): Promise<StockPage> {
  const db = await openFidelityDb()

  /*
   * Der jüngste Dig, der noch leben darf.
   *
   * Dig-Kennungen sind ULIDs, also ist die lexikographische Ordnung die
   * zeitliche. Ein abgelaufener zählt nicht: seine Zeilen sind weg, und ein
   * leeres Ergebnis von ihm hieße fälschlich „der Laden führt das nicht".
   */
  const now = Date.now()
  const fresh = (await db.getAll('digs'))
    .filter((dig) => dig.dealer === dealer && dig.status !== 'expired' && dig.expiresAt > now)
    .sort((a, b) => b.id.localeCompare(a.id))[0]

  if (!fresh) return { rows: [], total: 0, scannedAt: null }

  const store = db.transaction('stock').store
  const [index, value] =
    decade !== null
      ? ([store.index('by-dig-decade'), decade] as const)
      : ([store.index('by-dig-label'), label] as const)

  // `IDBKeyRange.only` auf den zusammengesetzten Schlüssel: derselbe Dig, genau
  // dieser Wert. Ohne den Dig vorne würden zwei Läden sich vermischen.
  const range = IDBKeyRange.only([fresh.id, value])
  const total = await index.count(range)

  const rows: StockRow[] = []
  let cursor = await index.openCursor(range)
  // `advance(0)` wirft, deshalb der Sprung nur, wenn es etwas zu überspringen
  // gibt.
  if (cursor && offset > 0) cursor = await cursor.advance(offset)

  while (cursor && rows.length < limit) {
    rows.push(cursor.value)
    cursor = await cursor.continue()
  }

  /*
   * Teuerstes zuerst ist die falsche Ordnung für eine Sortimentsliste — wer
   * ein Label durchsieht, will es der Reihe nach. Nach Jahr, und innerhalb
   * eines Jahres nach Titel: so steht eine Diskografie in jedem Regal.
   */
  rows.sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.title ?? '').localeCompare(b.title ?? ''),
  )

  return { rows, total, scannedAt: fresh.startedAt }
}
