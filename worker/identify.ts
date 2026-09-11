import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from './discogs/client'
import type { CollectionItem, Identified, WantlistItem } from '#shared/types'

/**
 * Eine Platte in der Hand erkennen (M13, Stufe 1: Barcode).
 *
 * **Ein Barcode ist nicht eindeutig, und das ist der wichtigste Fund hier.**
 * Am 2026-09-11 gemessen: `5012394144777` liefert **acht** Releases in fünf
 * Ländern — UK, Italien, Frankreich, Portugal, Europe — und das Release, aus
 * dem der Barcode stammt, steht auf Platz sieben. Ein Barcode benennt eine
 * *Veröffentlichung*, keine *Pressung*.
 *
 * Für Fidelitys Frage macht das nichts, im Gegenteil: „habe ich die schon?"
 * ist ohnehin eine Frage nach der Platte und nicht nach dem Presswerk. Die
 * Oberfläche darf nur nicht so tun, als sei die Antwort eine.
 *
 * **Und nicht jede Platte hat einen.** Stichprobe über zehn Platten aus einer
 * echten Sammlung: acht ja, zwei nein — eine Club-12" und ein White Label.
 * Genau die Fälle, für die Stufe 2 (Cover erkennen) gedacht ist.
 */

const searchSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string().optional(),
        year: z.union([z.number().int(), z.string()]).optional(),
        country: z.string().optional(),
        thumb: z.string().optional(),
        format: z.array(z.string()).optional(),
      }),
    )
    .default([]),
})

/** Genug, um die Auswahl zu zeigen, ohne eine Seite damit zu füllen. */
const MAX_CANDIDATES = 12

/** Nur Ziffern — ein Scanner liefert manchmal Leerzeichen oder Bindestriche mit. */
export function cleanBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // EAN-8 bis EAN-13/UPC-A. Alles darunter ist kein Barcode, alles darüber
  // ist keiner, den eine Platte trägt.
  return digits.length >= 8 && digits.length <= 14 ? digits : null
}

/**
 * Barcode oder Auslaufrille? Das Feld nimmt beides, also muss es jemand
 * entscheiden.
 *
 * Nur Ziffern (plus Leerzeichen und Bindestriche, wie sie auf der Hülle
 * stehen) sind ein Barcode. Alles andere ist ein Runout — die tragen fast
 * immer Buchstaben, oft eine Mastering-Signatur wie `PHRUPMASTERGENERAL`.
 *
 * Als Funktion und nicht als Ausdruck in einem Template: eine Mutationsprobe
 * hat gezeigt, dass ein Test, der nur den Quelltext liest, die Entscheidung
 * gar nicht sieht — auf `true` festgenagelt blieb er grün.
 */
export function looksLikeBarcode(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && /^[\d\s-]+$/.test(trimmed)
}

export async function identify(
  client: DiscogsClient,
  raw: string,
  signal?: AbortSignal,
): Promise<Identified> {
  const barcode = cleanBarcode(raw)
  if (!barcode) return { barcode: raw, candidates: [], owned: [], wanted: [] }

  const answer = await client.get('/database/search', searchSchema, {
    query: { barcode, type: 'release', per_page: String(MAX_CANDIDATES) },
    signal,
  })

  return withOwnership(barcode, answer.results.slice(0, MAX_CANDIDATES))
}

/**
 * Und der zweite Weg: die Nummer aus der Auslaufrille (M13, Stufe 2).
 *
 * **Der bessere Ausweis, und das ist gemessen.** Stichprobe über zwölf Platten
 * einer echten Sammlung am 2026-09-11: zehn hatten einen Barcode, **elf einen
 * Runout**, keine hatte keins von beidem — und die zwei ohne Barcode hatten
 * einen Runout. Bei Club-Vinyl steht der Ausweis im Auslauf, nicht auf der
 * Hülle.
 *
 * Er ist außerdem **genauer**: die volle Zeichenkette
 * `MPO SK 032 A1 G PHRUPMASTERGENERAL T2T LONDON` liefert genau **einen**
 * Treffer, wo ein Barcode acht liefert.
 *
 * Bruchstücke gehen auch, werden aber schnell unbrauchbar: `MPO SK 032 A1`
 * ergab 21 Treffer, `SK 032 A1` dreitausendvierhundert. Eine markante
 * Mastering-Signatur allein (`PHRUPMASTERGENERAL T2T`) grenzte auf zwei ein.
 * Deshalb sagt der Bildschirm, wie viele es waren — je mehr abgetippt wird,
 * desto kürzer die Liste.
 */
export async function identifyByRunout(
  client: DiscogsClient,
  runout: string,
  signal?: AbortSignal,
): Promise<Identified> {
  const text = runout.trim()
  // Kürzer als das ist kein Runout, sondern ein Tippfehler — und eine Suche
  // nach drei Zeichen holt den halben Katalog.
  if (text.length < 6) return { barcode: text, candidates: [], owned: [], wanted: [] }

  const answer = await client.get('/database/search', searchSchema, {
    query: { q: text, type: 'release', per_page: String(MAX_CANDIDATES) },
    signal,
  })

  return withOwnership(text, answer.results.slice(0, MAX_CANDIDATES))
}

/**
 * Die Frage, für die jemand im Laden steht — gegen die **eigene** Datenbank.
 *
 * Das kostet nichts und funktioniert auch, wenn die Verbindung wieder weg
 * ist. Geprüft wird **jeder** Kandidat: die eigene Pressung kann eine andere
 * sein als die, die die Suche zuerst nennt — in der Messung vom 2026-09-11
 * stand sie an siebter Stelle von acht. Wer nur den ersten prüft, sagt „hast
 * du nicht" zu einer Platte im eigenen Regal.
 */
async function withOwnership(
  code: string,
  results: {
    id: number
    title?: string
    year?: number | string
    country?: string
    thumb?: string
    format?: string[]
  }[],
): Promise<Identified> {
  const candidates = results.map((row) => ({
    releaseId: row.id,
    title: row.title ?? '',
    year: typeof row.year === 'number' ? row.year : Number(row.year) || null,
    country: row.country ?? '',
    thumbUrl: row.thumb ?? '',
    format: (row.format ?? []).join(' · '),
  }))

  const db = await openFidelityDb()
  const owned: CollectionItem[] = []
  const wanted: WantlistItem[] = []

  for (const candidate of candidates) {
    for (const item of await db.getAllFromIndex(
      'collection',
      'by-release',
      candidate.releaseId,
    )) {
      owned.push(item)
    }
    const want = await db.get('wantlist', candidate.releaseId)
    if (want) wanted.push(want)
  }

  return { barcode: code, candidates, owned, wanted }
}
