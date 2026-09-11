import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from './discogs/client'
import type { Feedback, OrderImport } from '#shared/types'

/**
 * Eine Bestellung einlesen — und daraus die Ankunftsfragen stellen (M14).
 *
 * **Warum es das überhaupt geben kann.** `GET /marketplace/orders` ist die
 * Verkäuferseite; für jemanden, der nur kauft, antwortet sie für immer mit
 * `items: 0` (am 2026-09-11 zweimal gemessen, zehn Stunden auseinander,
 * `docs/02`). Eine **einzelne** Bestellung ist ihrem Käufer dagegen zugänglich:
 * `GET /marketplace/orders/{id}` liefert sie vollständig.
 *
 * **Warum es eine eingetippte Nummer braucht.** Weil die Liste die
 * Verkäuferseite ist, führt kein API-Weg von „ich bin Käufer" zu „hier sind
 * meine Bestellnummern". Die Nummer steht im Web unter `/sell/purchases` und
 * sonst nirgends. Das ist keine Bequemlichkeitsentscheidung, sondern die
 * einzige Form, die die API zulässt.
 *
 * **Was es spart:** drei Platten in einer Bestellung sind sonst drei Haken bei
 * „gekauft", von Hand, nachdem der Dig längst weggeräumt ist. Hier ist es eine
 * Nummer und eine Anfrage.
 *
 * **`items[].id` ist die Listing-ID** — gemessen an der Form (zehn Ziffern wie
 * jede andere) und daran, dass `GET /marketplace/listings/{diese id}` mit
 * **403 „authenticate as the owner"** antwortet: ein verkauftes Angebot gehört
 * nur noch seinem Verkäufer. Das ist der Grund, warum ein Import nichts
 * verdoppelt: eine Platte, die ein Dig gefunden hat, trägt dieselbe Nummer,
 * und die Zeile wird ergänzt statt ein zweites Mal angelegt.
 */

/**
 * Was von einer Bestellung gelesen wird — und damit auch: was nicht.
 *
 * **Das Schema ist hier die Zusage, nicht ein Kommentar.** Die Antwort enthält
 * `media_condition`, `sleeve_condition`, `condition_comments`, `price` und
 * `seller.email`. Nichts davon steht unten, also existiert nichts davon
 * hinter dieser Zeile — es kann gar nicht erst versehentlich weitergereicht
 * werden.
 *
 * - Die **versprochene Note** wäre Discogs-Content und dürfte nach sechs
 *   Stunden nicht mehr gezeigt werden (Regel 4). M14 speichert deshalb nur den
 *   *Vergleich*, nie die Note — und ein Import, der sie mitbrächte, wäre die
 *   Hintertür in genau diese Zusage.
 * - **Preise** sind aus demselben Grund draußen.
 * - **`seller.email`** ist die Adresse eines Dritten in einer Antwort, in der
 *   diese App nichts damit zu tun hat.
 *
 * Titel, Künstler und Laden bleiben: das ist Katalog, kein Angebot, und ohne
 * sie ist eine Kaufliste zwei nackte Ganzzahlen (`docs/03` §7).
 */
const orderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  created: z.string().optional(),
  seller: z.object({ username: z.string().min(1) }).optional(),
  items: z
    .array(
      z.object({
        id: z.number().int(),
        release: z.object({
          id: z.number().int(),
          title: z.string().optional(),
          artist: z.string().optional(),
        }),
      }),
    )
    .default([]),
})

/**
 * Die Form einer Bestellnummer: `259022-32308`.
 *
 * Gemessen an einer echten. Geprüft wird sie, damit ein Vertipper keine
 * Anfrage kostet — nicht, um klug zu sein: was durchkommt, entscheidet
 * weiterhin Discogs.
 */
export function cleanOrderId(raw: string): string | null {
  const getrimmt = raw.trim()
  /*
   * Eine ganze Adresse ist auch eine Eingabe. Wer die Nummer aus dem Browser
   * kopiert, hat oft `discogs.com/sell/order/259022-32308` in der Zwischen-
   * ablage, und daran zu scheitern wäre eine Kleinlichkeit.
   */
  const ausAdresse = getrimmt.match(/(\d+-\d+)\s*$/)
  const kandidat = ausAdresse ? ausAdresse[1]! : getrimmt
  return /^\d{1,12}-\d{1,12}$/.test(kandidat) ? kandidat : null
}

export async function importOrder(
  client: DiscogsClient,
  rawId: string,
  now = Date.now(),
): Promise<OrderImport> {
  const id = cleanOrderId(rawId)
  if (!id) return { ok: false, reason: 'shape' }

  const order = await client.get(`/marketplace/orders/${id}`, orderSchema)

  const db = await openFidelityDb()
  const dealer = order.seller?.username ?? null

  /*
   * Das Kaufdatum kommt aus der Bestellung, nicht von der Uhr.
   *
   * Daran hängt die Reifezeit aus `worker/grading.ts`: eine Bestellung von vor
   * drei Wochen ist angekommen, und ihre Frage ist sofort fällig. Mit
   * `Date.now()` fingen alle importierten Käufe bei null an, und der ganze
   * Sinn des Imports — die Frage stellen zu können, wenn sie dran ist — wäre
   * um zehn Tage verschoben.
   */
  const gekauftAm = order.created ? Date.parse(order.created) : NaN
  const at = Number.isNaN(gekauftAm) ? now : gekauftAm

  let angelegt = 0
  let ergaenzt = 0

  for (const item of order.items) {
    const vorhanden = await db.get('feedback', item.id)

    /*
     * Eine vorhandene Zeile wird ergänzt, nicht ersetzt.
     *
     * Sie kann aus einem Dig stammen und trägt dann Signale und eine
     * Punktzahl — die Auswertung, um derentwillen dieser Store überhaupt
     * existiert (`docs/03` §7). Und sie kann bereits ein Urteil tragen: wer
     * schon geantwortet hat, wie die Platte ankam, soll nach einem Import
     * nicht erneut gefragt werden.
     */
    const zeile: Feedback = {
      ...(vorhanden ?? {
        listingId: item.id,
        releaseId: item.release.id,
        signals: [],
        score: 0,
      }),
      listingId: item.id,
      releaseId: item.release.id,
      title: vorhanden?.title ?? item.release.title ?? null,
      artist: vorhanden?.artist ?? item.release.artist ?? null,
      dealer: dealer ?? vorhanden?.dealer ?? null,
      verdict: 'bought',
      createdAt: at,
      updatedAt: now,
    }

    await db.put('feedback', zeile)
    if (vorhanden) ergaenzt += 1
    else angelegt += 1
  }

  return {
    ok: true,
    dealer,
    at,
    added: angelegt,
    enriched: ergaenzt,
    records: order.items.map((item) => ({
      listingId: item.id,
      title: item.release.title ?? null,
      artist: item.release.artist ?? null,
    })),
  }
}
