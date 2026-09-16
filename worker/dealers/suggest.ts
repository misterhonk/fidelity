import { getMeta, getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Dealer, HubShop, TasteProfile } from '#shared/types'

import { shareOnKnownLabels } from '../dig/fingerprint'
import { createHubClient } from '../hub/client'
import { HUB_TIMEOUT_MS, withTimeout } from '../hub/fallback'
import { log } from '../log'
import { norm } from '../match/normalize'

/**
 * Shops other people have dug (ADR-014).
 *
 * The shops screen is a log of what this device happened to try. Every feature
 * that reasons about shops is bounded by it — the round walks it, the basket
 * comparison compares within it — and Discogs offers nothing to widen it:
 * there is no "which shops sell this sort of record", no list of good sellers,
 * and `/marketplace/search` is rule 5.
 *
 * What there is: other devices, digging other shops, and a hub that already
 * carries what one of them learned for the next. So a device hands up the
 * shops it knows and asks which ones it does not.
 *
 * **The ranking happens here, never up there.** The hub answers "here are
 * shops, and what they stock"; which of them suit you is a question about your
 * collection, and your collection does not leave the device. That is also what
 * keeps this from being a chart of the biggest shops: the order is what people
 * actually dug, weighted by what *this* shelf contains.
 *
 * Rule 8 throughout. Without a hub the answer is empty and the screen says so;
 * with a broken one it is empty two seconds later.
 */

export interface SuggestedShop {
  username: string
  displayName: string
  shipsFrom: string
  avatarUrl?: string
  numForSale: number
  /** When the device that shared it last looked — this is a sample, not a catalogue. */
  seenAt: number
  /** Share of its sampled stock on labels this collection has, 0–1. */
  fit: number
  /** The labels behind the number, best first, so the figure has a reason. */
  labels: string[]
}

export interface SuggestResult {
  shops: SuggestedShop[]
  /** How many of this device's shops went up this round. */
  shared: number
  /** Whether a hub was asked at all — the screen says something different without one. */
  hub: boolean
}

/**
 * How many shops one round hands up.
 *
 * A ceiling, not a target, and the same reasoning as the horizon's catch-up:
 * somebody who has dug two hundred shops before entering a hub should not
 * spend a minute of chatter on the first visit to this screen. The rest go on
 * the next one.
 */
const MAX_CONTRIBUTIONS = 20

/** Labels named per shop. Enough to recognise a shop, short enough for a line. */
const LABELS_SHOWN = 4

export async function suggestShops(
  now = Date.now(),
  signal?: AbortSignal,
): Promise<SuggestResult> {
  const preferences = await getPreferences()
  const hub = createHubClient({
    baseUrl: preferences.hubUrl,
    secret: preferences.hubSecret,
    accessKey: preferences.accessKey,
  })
  if (!hub) return { shops: [], shared: 0, hub: false }

  const db = await openFidelityDb()
  const known = await db.getAll('dealers')

  const shared = await contribute(hub, known, now)

  let offered: HubShop[]
  try {
    offered = await withTimeout(hub.shops(signal), HUB_TIMEOUT_MS)
  } catch (error) {
    // A hub that is slow or off costs two seconds and then stops existing for
    // this call (rule 8). It is not an error on a screen nobody asked to fix.
    log.warn('[shops] the hub did not answer', error)
    return { shops: [], shared, hub: true }
  }

  const mine = new Set(known.map((dealer) => dealer.username.toLowerCase()))
  const labels = collectedLabels((await getMeta('tasteProfile')) ?? null)

  const shops = offered
    // A shop this device already knows is not a suggestion. It is on the list
    // above, with its own dig date and its own hit rate.
    .filter((shop) => !mine.has(shop.username.toLowerCase()))
    .map((shop) => ({
      username: shop.username,
      displayName: shop.displayName || shop.username,
      shipsFrom: shop.shipsFrom,
      avatarUrl: shop.avatarUrl || undefined,
      numForSale: shop.numForSale,
      seenAt: shop.seenAt,
      fit: shareOnKnownLabels(
        shop.fingerprint.labelDist,
        shop.fingerprint.sampledItems,
        labels,
      ),
      labels: matchingLabels(shop.fingerprint.labelDist, labels),
    }))
    /*
     * Nothing in common is not a suggestion either. A shop with none of your
     * labels among its top twenty is a shop somebody else digs, and listing it
     * would turn this into the directory ADR-014 says it must not become.
     */
    .filter((shop) => shop.fit > 0)
    .sort((a, b) => b.fit - a.fit)

  return { shops, shared, hub: true }
}

/**
 * What this device knows, handed up — once per dig, not once per visit.
 *
 * `sharedAt` is compared against `lastScannedAt` rather than against a clock:
 * a shop is worth sending again when a newer dig has learned something new
 * about it, and never otherwise.
 */
async function contribute(
  hub: NonNullable<ReturnType<typeof createHubClient>>,
  known: Dealer[],
  now: number,
): Promise<number> {
  const db = await openFidelityDb()
  const due = known.filter(
    (dealer) =>
      dealer.fingerprint !== null &&
      dealer.lastScannedAt !== null &&
      !dealer.hiddenAt &&
      (dealer.sharedAt ?? 0) < dealer.lastScannedAt,
  )

  let shared = 0
  for (const dealer of due.slice(0, MAX_CONTRIBUTIONS)) {
    const fingerprint = dealer.fingerprint!
    try {
      const accepted = await withTimeout(
        hub.contributeShop({
          username: dealer.username,
          displayName: dealer.displayName || dealer.username,
          shipsFrom: dealer.shipsFrom,
          numForSale: dealer.numForSale,
          avatarUrl: dealer.avatarUrl,
          seenAt: dealer.lastScannedAt!,
          fingerprint: {
            sampledItems: fingerprint.sampledItems,
            totalItems: fingerprint.totalItems,
            coverage: fingerprint.coverage,
            labelDist: fingerprint.labelDist,
            styleDist: fingerprint.styleDist,
            decadeDist: fingerprint.decadeDist,
          },
        }),
        HUB_TIMEOUT_MS,
      )

      // Only marked after an accepted answer, or a rejected contribution would
      // count as done for ever — the same rule the horizon's catch-up follows.
      if (accepted) {
        await db.put('dealers', { ...dealer, sharedAt: now })
        shared += 1
      }
    } catch (error) {
      log.warn('[shops] contribution rejected', dealer.username, error)
    }
  }

  return shared
}

/** Every label on the shelf, normalised the way a fingerprint's keys are read. */
function collectedLabels(taste: TasteProfile | null): Set<string> {
  const labels = new Set<string>()
  for (const facet of Object.values(taste?.labels ?? {})) {
    const key = norm(facet.name)
    if (key.length > 0) labels.add(key)
  }
  return labels
}

function matchingLabels(labelDist: Record<string, number>, collected: Set<string>): string[] {
  return Object.entries(labelDist)
    .filter(([label]) => collected.has(norm(label)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, LABELS_SHOWN)
    .map(([label]) => label)
}
