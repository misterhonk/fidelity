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

  const candidates = answer.results.slice(0, MAX_CANDIDATES).map((row) => ({
    releaseId: row.id,
    title: row.title ?? '',
    year: typeof row.year === 'number' ? row.year : Number(row.year) || null,
    country: row.country ?? '',
    thumbUrl: row.thumb ?? '',
    format: (row.format ?? []).join(' · '),
  }))

  /*
   * Und jetzt die Frage, für die jemand im Laden steht.
   *
   * Gegen die **eigene** Datenbank, nicht gegen Discogs: das kostet nichts und
   * funktioniert auch, wenn die Verbindung gerade wieder weg ist. Geprüft wird
   * jeder Kandidat, weil die eigene Pressung eine andere sein kann als die,
   * die die Suche zuerst nennt.
   */
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

  return { barcode, candidates, owned, wanted }
}
