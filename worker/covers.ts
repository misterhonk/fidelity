import { z } from 'zod'

import { unknownCovers, writeCovers } from '~~/db/covers'
import { getPreferences } from '~~/db/meta'

import type { DiscogsClient } from './discogs/client'
import { createHubClient } from './hub/client'
import { HUB_TIMEOUT_MS, withTimeout } from './hub/fallback'

/**
 * Cover nachholen, die der Marktplatz nicht mitliefert.
 *
 * `/users/{u}/inventory` returns `release.thumbnail` as an empty string — in
 * 1.200 of 1.200 rows across four shops, measured 2026-08-10, while the
 * releases behind them held between 1 and 29 images each. So a dig produces
 * matches with no picture, and every result card in the app has been drawing
 * the grey placeholder since the day it was written.
 *
 * `/releases/{id}` has the images and costs one request. That is exactly the
 * shape CLAUDE.md rule 2 forbids — walking releases one at a time — and the
 * rule is about walking *all* of them: ten thousand at 1,2 s is three hours.
 * This walks what is on somebody's screen, a dozen at a time, only when it has
 * nothing better to do, and never asks twice because the answer is kept
 * (`db/covers.ts`). A sleeve does not change.
 */

const releaseImagesSchema = z.object({
  id: z.number().int(),
  images: z
    .array(
      z.object({
        type: z.string().optional(),
        uri: z.string().optional(),
        uri150: z.string().optional(),
      }),
    )
    .optional(),
})

/**
 * Wie viele auf einen Rutsch.
 *
 * Twelve is about one screen of results and about fifteen seconds at the
 * signed-in pace. Small enough that a dig started right after does not queue
 * behind a minute of pictures — the pacer is one lane, and a cover must never
 * be the reason a scan feels broken.
 */
export const COVER_BATCH = 12

export interface CoverProgress {
  done: number
  total: number
}

/**
 * Holt die fehlenden Cover und legt sie ab.
 *
 * Returns what was newly learned. Releases Discogs has no picture for are
 * stored as empty rather than skipped, so they are asked about exactly once.
 */
export async function fetchCovers(options: {
  client: DiscogsClient
  releaseIds: number[]
  limit?: number
  report?: (progress: CoverProgress) => void
  signal?: AbortSignal
}): Promise<number> {
  const { client, report, signal } = options
  let missing = (await unknownCovers(options.releaseIds)).slice(0, options.limit ?? COVER_BATCH)
  if (missing.length === 0) return 0

  const learned: { releaseId: number; thumbUrl: string; coverUrl: string }[] = []

  /*
   * Erst den Hub fragen — ein Aufruf für alle auf einmal.
   *
   * This is the cheapest thing a hub can do and the most valuable: a cover
   * costs one request to Discogs, the answer is identical for everybody, and a
   * sleeve does not change. A dozen of them are one round trip here.
   *
   * All the usual rules (ADR-008, rule 8): two seconds, no retry, and any
   * failure falls through to the ordinary path without a word. The addresses
   * are re-checked inside the client — a hub is the component that code is
   * written not to trust.
   */
  const preferences = await getPreferences()
  const hub = createHubClient({ baseUrl: preferences.hubUrl, secret: preferences.hubSecret })
  let fromHub = 0

  if (hub) {
    try {
      const shared = await withTimeout(hub.covers(missing), HUB_TIMEOUT_MS)
      const hits = Object.entries(shared).map(([id, cover]) => ({
        releaseId: Number(id),
        ...cover,
      }))
      if (hits.length > 0) {
        await writeCovers(hits)
        fromHub = hits.length
        const known = new Set(hits.map((hit) => hit.releaseId))
        missing = missing.filter((releaseId) => !known.has(releaseId))
      }
    } catch {
      // A hub that is slow, off or broken is not an event. The requests below
      // are what would have happened anyway.
    }
  }

  for (const [index, releaseId] of missing.entries()) {
    signal?.throwIfAborted()
    report?.({ done: index, total: missing.length })

    try {
      const release = await client.get(`/releases/${releaseId}`, releaseImagesSchema, {
        signal,
      })
      const images = release.images ?? []
      const primary = images.find((image) => image.type === 'primary') ?? images[0]

      learned.push({
        releaseId,
        thumbUrl: primary?.uri150 ?? '',
        coverUrl: primary?.uri ?? '',
      })
    } catch (cause) {
      /*
       * A cover is decoration, and decoration may not take a screen down with
       * it. A deleted release 404s, a rate limit stalls, the network drops —
       * in every case the list keeps its placeholder and the app carries on.
       * Nothing is written, so the next visit tries again.
       */
      if (signal?.aborted) throw cause
      break
    }
  }

  await writeCovers(learned)
  report?.({ done: missing.length, total: missing.length })

  /*
   * Und zurückgeben, was wir gelernt haben.
   *
   * Fire-and-forget, and a courtesy rather than part of the request: whoever
   * shares this hub does not pay for these again. The negatives go too — "no
   * picture for this release" is worth exactly as much as a picture, and costs
   * the same request to find out.
   */
  if (hub && learned.length > 0) {
    void hub.contributeCovers(learned).catch(() => {
      // A hub that refuses a contribution changes nothing here.
    })
  }

  return learned.length + fromHub
}
