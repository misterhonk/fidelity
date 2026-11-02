import { z } from 'zod'

import type { DigWithMatches } from '#shared/protocol'
import type { SharedDig, SharedFind, Signal, SignalType } from '#shared/types'
import { fail } from './fail'
import { sharedDigSchema } from './payloads'

/**
 * Sending a find list without putting it anywhere (#249).
 *
 * The whole list travels in the `#` fragment of the link, compressed. No hub,
 * no server, nothing stored: whoever has the link has the list, and no browser
 * sends a fragment anywhere. Rule 8 holds — this used to need the hub.
 *
 * **What travels** is ids, catalogue facts, and why each one fits. Never a
 * price, a condition, the seller's name or a cover (Discogs Restricted Data,
 * docs/09): a link lives as long as somebody keeps it, and the six hours do not
 * reach into a chat history.
 */

/** 2: the fragment payload. 1 was the hub's sealed envelope. */
const SHARE_VERSION = 2

/**
 * How many finds travel along. The list is sorted by score, and the total
 * travels with it so the link does not claim that was all of them. Fifty keep
 * the link around 5,000 characters, which chat apps still carry whole.
 */
const MAX_SHARED_MATCHES = 50

/** Signals whose evidence is marketplace data — a price or a stock count. */
const MARKET_SIGNALS: ReadonlySet<SignalType> = new Set(['PRICE_SIGNAL', 'SCARCITY'])

/**
 * The evidence a reason may carry: catalogue names, never counts.
 *
 * How many records by an artist somebody owns, what format they own an album
 * in, how high a want ranks — those are the sender's collection and wantlist.
 * The plates on the shared page say the same thing without them.
 */
const NAMED_EVIDENCE = [
  'artist',
  'via',
  'relation',
  'label',
  'prefix',
  'person',
  'styles',
  'album',
] as const

function cleanSignals(signals: readonly Signal[]): Signal[] {
  return signals
    .filter((signal) => !MARKET_SIGNALS.has(signal.type))
    .map((signal) => ({
      type: signal.type,
      confidence: signal.confidence,
      evidence: Object.fromEntries(
        NAMED_EVIDENCE.filter((key) => signal.evidence[key] !== undefined).map((key) => [
          key,
          signal.evidence[key],
        ]),
      ),
    }))
}

/** What may leave the device, picked field by field rather than stripped. */
export function toSharedDig(loaded: DigWithMatches): SharedDig {
  return {
    version: SHARE_VERSION,
    coverage: loaded.dig.coverage,
    matchesTotal: loaded.matches.length,
    matches: loaded.matches.slice(0, MAX_SHARED_MATCHES).map((match): SharedFind => ({
      releaseId: match.releaseId,
      listingId: match.listingId,
      score: match.score,
      artist: match.artist,
      title: match.title,
      label: match.label,
      catno: match.catno,
      format: match.format,
      year: match.year,
      signals: cleanSignals(match.signals),
    })),
  }
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(body).arrayBuffer())
}

/** base64url: the fragment may hold `+` and `/`, but a chat app may not keep them. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function encodeShare(snapshot: SharedDig): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

/**
 * Takes what the screen has loaded anyway — `loadDig()` has already folded
 * duplicate copies away, and what is shared is what is on the screen.
 */
export async function createShare(
  loaded: DigWithMatches,
): Promise<{ data: string; matches: number }> {
  /*
   * An expired dig is not shared. Its listings may have sold, and the link
   * would send somebody to six-hour-old stock as if it were fresh (rule 4).
   */
  if (Date.now() >= loaded.dig.expiresAt) throw fail('dig-expired', 'dig expired')

  const snapshot = toSharedDig(loaded)
  return { data: await encodeShare(snapshot), matches: snapshot.matches.length }
}

/**
 * And the other side: opening a link. Runs **with no token and no sign-in**.
 *
 * Null for a link from a newer Sleeveside — too new, not damaged.
 */
export async function readShare(data: string): Promise<SharedDig | null> {
  let envelope: unknown
  try {
    const json = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'))
    envelope = JSON.parse(new TextDecoder().decode(json))
  } catch {
    throw fail('malformed-payload', 'shared list does not decode')
  }

  const version = z.looseObject({ version: z.number() }).safeParse(envelope)
  if (version.success && version.data.version > SHARE_VERSION) return null

  const parsed = sharedDigSchema.safeParse(envelope)
  if (!parsed.success) throw fail('malformed-payload', 'shared list does not match the schema')

  // A hand-made link is cut to the same names an honest one carries.
  const snapshot = parsed.data
  return {
    ...snapshot,
    matches: snapshot.matches.map((match) => ({
      ...match,
      signals: cleanSignals(match.signals),
    })),
  }
}
