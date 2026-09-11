import { openFidelityDb } from '~~/db/open'
import { marketStatsSchema } from '../dig/enrich'
import { addPoint, judge, type WatchNews } from './judge'
import { MAX_CONFIRM, seenOffers } from './offers'
import { FOR_SALE, listingSchema } from '../dig/refresh'
import type { DiscogsClient } from '../discogs/client'
import type { WatchedRelease } from '#shared/types'

/**
 * Die beobachteten Platten nachschlagen (M11).
 *
 * Ein Request je Platte über `/marketplace/stats/{id}` — **ohne Token
 * möglich**, aber durch denselben Taktgeber wie alles andere (Regel 3). Mit
 * Token sind fünfzig Platten eine Minute.
 *
 * **Warum nicht die ganze Sammlung:** fünfhundert Platten wären zehn Minuten,
 * jeden Tag, und damit genau die Form, die Regel 2 verbietet. Die Obergrenze
 * ist nicht ein Schönheitsfehler, sondern der Entwurf — man beobachtet, was
 * man verkaufen würde, und was man wirklich sucht.
 */

/**
 * Wie viele Platten überhaupt beobachtet werden dürfen.
 *
 * Bei 1,2 s pro Anfrage sind das zwei Minuten je Durchlauf. Darüber wird aus
 * „nachsehen" ein Vorgang, den man plant — und ein Wächter, den man plant,
 * läuft nicht mehr nebenbei.
 */
export const MAX_WATCHED = 100

/** Häufiger als einmal täglich ändert sich am Markt einer Platte nichts. */
const MIN_GAP_MS = 20 * 60 * 60 * 1000

export interface WatchedCheck {
  checked: number
  requests: number
  news: { releaseId: number; artist: string; title: string; news: WatchNews }[]
}

export interface CheckProgress {
  done: number
  total: number
}

export async function checkWatched(
  client: DiscogsClient,
  options: {
    now?: () => number
    force?: boolean
    signal?: AbortSignal
    report?: (progress: CheckProgress) => void
  } = {},
): Promise<WatchedCheck> {
  const { now = Date.now, force = false, signal, report } = options
  const db = await openFidelityDb()
  const all = await db.getAll('watched')

  const at = now()
  const due = force
    ? all
    : all.filter((row) => row.checkedAt === null || at - row.checkedAt >= MIN_GAP_MS)

  const result: WatchedCheck = { checked: 0, requests: 0, news: [] }

  for (const [index, row] of due.entries()) {
    signal?.throwIfAborted()
    report?.({ done: index, total: due.length })

    let stats
    try {
      stats = await client.get(`/marketplace/stats/${row.releaseId}`, marketStatsSchema, {
        signal,
      })
      result.requests += 1
    } catch (cause) {
      if (signal?.aborted) throw cause
      /*
       * Eine Platte, die gerade nicht zu erreichen ist, ist kein Grund, den
       * Durchlauf abzubrechen: die anderen neunundneunzig hängen nicht an ihr,
       * und der nächste Durchlauf holt sie nach.
       */
      continue
    }

    const point = {
      at,
      // `blocked_from_sale` heißt „Discogs handelt sie nicht" — das ist kein
      // Preis von null, sondern gar keiner.
      lowestPrice: stats.blocked_from_sale ? null : (stats.lowest_price?.value ?? null),
      currency: stats.lowest_price?.currency ?? null,
      numForSale: stats.num_for_sale ?? 0,
    }

    const updated: WatchedRelease = {
      ...row,
      points: addPoint(row.points, point),
      checkedAt: at,
    }

    let news = judge(updated, at)

    /*
     * „Ein Angebot weniger" ist die ehrliche Aussage über die Zahl — aber
     * nicht die beste, die möglich ist.
     *
     * Wenn ein Dig dieses Geräts konkrete Angebote dieser Platte gesehen hat,
     * lässt sich nachsehen, ob *die* noch stehen. Das kostet einen Request je
     * Angebot, deshalb erst hier: gefragt wird nur, wenn die Zahl überhaupt
     * gefallen ist, und das ist selten. Bleibt die Antwort aus, bleibt es bei
     * `fewer` — schlechter informiert, aber nicht falsch.
     */
    if (news?.kind === 'fewer') {
      const gone = await confirmGone(client, row, {
        signal,
        report: () => (result.requests += 1),
      })
      if (gone) {
        updated.goneOffers = [...(row.goneOffers ?? []), gone.listingId]
        news = {
          kind: 'gone',
          dealer: gone.dealer,
          listingId: gone.listingId,
          from: news.from,
          to: news.to,
        }
      }
    }

    if (news) {
      result.news.push({
        releaseId: row.releaseId,
        artist: row.artist,
        title: row.title,
        news,
      })
      updated.notifiedAt = at
    }

    await db.put('watched', updated)
    result.checked += 1
  }

  report?.({ done: due.length, total: due.length })
  return result
}

/**
 * Nachsehen, ob eines der selbst gesehenen Angebote verschwunden ist.
 *
 * Höchstens `MAX_CONFIRM` Stück, jüngstes zuerst, und schon bekannte
 * Verschwundene werden übersprungen — sonst kostet dieselbe Kopie bei jedem
 * Durchlauf erneut einen Request und meldet sich erneut.
 *
 * Gibt das erste zurück, das nicht mehr `For Sale` ist. Ein Fehler ist kein
 * Ergebnis: dann bleibt es bei der Zahl, und der nächste Durchlauf sieht
 * wieder nach.
 */
async function confirmGone(
  client: DiscogsClient,
  row: WatchedRelease,
  options: { signal?: AbortSignal; report: () => void },
): Promise<{ listingId: number; dealer: string } | null> {
  const bekannt = new Set(row.goneOffers ?? [])
  const offers = (await seenOffers(row.releaseId))
    .filter((offer) => !bekannt.has(offer.listingId))
    .slice(0, MAX_CONFIRM)

  for (const offer of offers) {
    options.signal?.throwIfAborted()
    try {
      const listing = await client.get(
        `/marketplace/listings/${offer.listingId}`,
        listingSchema,
        { signal: options.signal },
      )
      options.report()
      if (listing.status !== FOR_SALE)
        return { listingId: offer.listingId, dealer: offer.dealer }
    } catch (cause) {
      if (options.signal?.aborted) throw cause
      /*
       * Eine 404 heißt hier „das Listing gibt es nicht mehr" und wäre eine
       * Antwort — aber im Browser kommt sie ohne CORS-Kopf an und ist von
       * einem Netzfehler nicht zu unterscheiden (`docs/02`). Also nichts
       * behaupten.
       */
      return null
    }
  }

  return null
}

/** Eine Platte in die Beobachtung nehmen. */
export async function watchRelease(
  entry: Omit<WatchedRelease, 'points' | 'checkedAt' | 'notifiedAt' | 'since'>,
  now = Date.now(),
): Promise<{ watched: boolean; full: boolean }> {
  const db = await openFidelityDb()
  const existing = await db.get('watched', entry.releaseId)

  if (existing) {
    // Schon dabei — dann ist das hier eine Änderung der Schwelle und kein
    // zweiter Eintrag. Der Verlauf bleibt, er gehört der Platte.
    await db.put('watched', { ...existing, ...entry })
    return { watched: true, full: false }
  }

  const count = await db.count('watched')
  if (count >= MAX_WATCHED) return { watched: false, full: true }

  await db.put('watched', {
    ...entry,
    since: now,
    points: [],
    checkedAt: null,
    notifiedAt: null,
  })
  return { watched: true, full: false }
}

export async function unwatchRelease(releaseId: number): Promise<void> {
  await openFidelityDb().then((db) => db.delete('watched', releaseId))
}

export async function listWatched(): Promise<WatchedRelease[]> {
  const db = await openFidelityDb()
  const all = await db.getAll('watched')
  // Zuletzt dazugekommene zuerst — was man gerade beobachtet, interessiert am
  // meisten.
  return all.sort((a, b) => b.since - a.since)
}
