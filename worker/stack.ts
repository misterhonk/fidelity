import { openFidelityDb } from '~~/db/open'
import type { StackShop } from '#shared/types'

/**
 * Der Stapel: dieselben Funde, nur einer nach dem anderen.
 *
 * Dieses Modul liefert **nur die obere Reihe** — welche Läden einen frischen
 * Dig haben und wie weit man in jedem gekommen ist. Die Karten selbst kommen
 * aus `dig.get`, das es längst gibt: derselbe Dig, dieselbe Auswahl, dieselbe
 * Reihenfolge. Eine zweite Abfrage für dieselben Treffer wäre eine zweite
 * Stelle, an der „was zeigen wir zuerst" entschieden wird.
 *
 * **Kostet keinen einzigen Discogs-Request.** Alles hier steht schon in
 * IndexedDB, weil der Dig längst gelaufen ist. Das ist der Grund, warum ein
 * Wischstapel in dieser App überhaupt geht: bei 1,2 s pro Anfrage wäre ein
 * Feed, der beim Wischen nachlädt, unbenutzbar.
 */

/**
 * Wie weit jemand gekommen ist, steht am Dig.
 *
 * Ein eigener Store wäre eine zweite Zeile pro Dig, die mit der ersten
 * Schritt halten müsste — und die verwaiste, sobald ein Dig weggeräumt wird.
 * Als Feld verschwindet der Fortschritt mit dem Dig, zu dem er gehört.
 *
 * Das Feld ist optional: Digs, die vor dem Stapel geschrieben wurden, haben
 * es nicht, und „nicht da" liest sich als „noch nichts gesehen" — was
 * stimmt.
 */
export async function stackOverview(now = Date.now()): Promise<StackShop[]> {
  const db = await openFidelityDb()
  const [digs, dealers] = await Promise.all([db.getAll('digs'), db.getAll('dealers')])

  const byDealer = new Map(dealers.map((dealer) => [dealer.username, dealer]))
  const newest = new Map<string, (typeof digs)[number]>()

  for (const dig of digs) {
    // Abgelaufene Digs haben hier nichts verloren: der Stapel zeigt Preise,
    // und nach sechs Stunden dürfen die nicht mehr gezeigt werden (Regel 4).
    if (dig.expiresAt <= now) continue
    const held = newest.get(dig.dealer)
    if (!held || dig.startedAt > held.startedAt) newest.set(dig.dealer, dig)
  }

  const shops: StackShop[] = []
  for (const dig of newest.values()) {
    const count = await db
      .transaction('matches')
      .store.index('by-dig-score')
      .count(IDBKeyRange.bound([dig.id, -Infinity], [dig.id, Infinity]))

    if (count === 0) continue

    const dealer = byDealer.get(dig.dealer)
    shops.push({
      dealer: dig.dealer,
      displayName: dealer?.displayName || dig.dealer,
      avatarUrl: dealer?.avatarUrl,
      digId: dig.id,
      scannedAt: dig.startedAt,
      expiresAt: dig.expiresAt,
      matches: count,
      seen: Math.min(dig.stackSeen ?? 0, count),
    })
  }

  /*
   * Ungesehenes zuerst, danach das Neueste.
   *
   * Das ist der Ring: wo noch etwas liegt, steht vorn. Rein nach Datum zu
   * sortieren hieße, dass ein Laden, den man durchgesehen hat, einen anderen
   * verdeckt, in dem noch dreißig Funde warten.
   */
  return shops.sort((a, b) => {
    const openA = a.matches - a.seen > 0
    const openB = b.matches - b.seen > 0
    if (openA !== openB) return openA ? -1 : 1
    return b.scannedAt - a.scannedAt
  })
}

/**
 * Merkt sich, wie weit der Stapel gekommen ist.
 *
 * **Nur vorwärts.** Wer zurückwischt und noch einmal schaut, hat die Karten
 * trotzdem gesehen; den Zähler dabei zu senken würde den Ring wieder
 * anschalten und dem Bildschirm eine Behauptung aufdrücken, die nicht stimmt.
 */
export async function stackSeen(digId: string, seen: number): Promise<void> {
  const db = await openFidelityDb()
  const dig = await db.get('digs', digId)
  if (!dig) return

  const next = Math.max(dig.stackSeen ?? 0, Math.max(0, Math.floor(seen)))
  if (next === (dig.stackSeen ?? 0)) return

  await db.put('digs', { ...dig, stackSeen: next })
}
