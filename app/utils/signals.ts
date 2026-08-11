import type { SignalType } from '#shared/types'

import { useMessages } from '~/composables/useMessages'

/**
 * How the eleven signals are coloured, and where their names come from.
 *
 * The names are in the shell pack rather than here — they appear on a dig
 * result, on a basket card and in the detail sheet, so they belong to
 * everything rather than to one area. The colours stay: they are tokens, not
 * words.
 */

/** Which token colours a chip. S1 and S2 share one — ten colours for eleven signals. */
export const SIGNAL_TOKEN: Record<SignalType, string> = {
  WANTLIST_EXACT: 'wantlist',
  WANTLIST_PRESSING: 'wantlist',
  ARTIST_KNOWN: 'artist',
  ARTIST_GAP: 'gap',
  LABEL_AFFINITY: 'label',
  CATALOG_RUN: 'catalog',
  STYLE_ADJACENT: 'style',
  CREDIT_GRAPH: 'credit',
  FORMAT_UPGRADE: 'upgrade',
  PRICE_SIGNAL: 'price',
  SCARCITY: 'scarcity',
}

/**
 * Read per call, so a chip already on screen follows a language switch. The
 * fallback to the raw type is not decoration: a signal added to the engine
 * before it is added to the packs should show up as `NEW_SIGNAL` rather than
 * as an empty chip.
 */
export function signalLabel(type: SignalType): string {
  return useMessages().value.signals[type] ?? type
}

/** Chip colours, mixed from the signal token so both stay in one place. */
export function signalChipStyle(type: SignalType) {
  const token = `var(--fid-sig-${SIGNAL_TOKEN[type] ?? 'label'})`
  return {
    backgroundColor: `color-mix(in oklch, ${token} 12%, transparent)`,
    borderColor: `color-mix(in oklch, ${token} 40%, transparent)`,
  }
}
