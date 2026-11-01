import { looksLikeBarcode } from '~~/worker/barcode'

/**
 * What the in-store field holds (#225): one field, three kinds of input.
 *
 * Digits only, and at least eight of them (EAN-8 is the shortest barcode), is
 * a barcode. Any other digit makes it a catalogue or run-out number — those
 * nearly always carry one. No digit at all is an artist or a title.
 */
export type LookupKind = 'barcode' | 'catno' | 'text'

export function lookupKind(text: string): LookupKind | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (looksLikeBarcode(trimmed) && trimmed.replace(/\D/g, '').length >= 8) return 'barcode'
  return /\d/.test(trimmed) ? 'catno' : 'text'
}

/** A code typed or read in a basement, waiting for signal. */
export interface QueuedLookup {
  code: string
  kind: Exclude<LookupKind, 'text'>
}

export function queueLookup(
  queue: readonly QueuedLookup[],
  entry: QueuedLookup,
): QueuedLookup[] {
  return queue.some((queued) => queued.code === entry.code) ? [...queue] : [...queue, entry]
}

/** The queue as kept in storage, with anything that is not one dropped. */
export function readQueue(raw: string | null): QueuedLookup[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item: unknown) => {
      const code = (item as { code?: unknown } | null)?.code
      if (typeof code !== 'string') return []
      const kind = lookupKind(code)
      return kind === 'barcode' || kind === 'catno' ? [{ code: code.trim(), kind }] : []
    })
  } catch {
    return []
  }
}

/**
 * Looks the queue up in order, one after the other (rule 3). A failure while
 * offline stops it: the rest would fail the same way. A failure while still
 * online is that entry's own (no token, an answer that does not parse) — it
 * is set aside with its error, so it cannot block the queue forever.
 */
export async function drainLookups<T>(
  queue: readonly QueuedLookup[],
  lookUp: (entry: QueuedLookup) => Promise<T>,
  stillOnline: () => boolean = () => false,
): Promise<{
  done: { entry: QueuedLookup; result: T }[]
  failed: { entry: QueuedLookup; cause: unknown }[]
  left: QueuedLookup[]
}> {
  const done: { entry: QueuedLookup; result: T }[] = []
  const failed: { entry: QueuedLookup; cause: unknown }[] = []
  for (const [index, entry] of queue.entries()) {
    try {
      done.push({ entry, result: await lookUp(entry) })
    } catch (cause) {
      if (!stillOnline()) return { done, failed, left: queue.slice(index) }
      failed.push({ entry, cause })
    }
  }
  return { done, failed, left: [] }
}
