import type { SignalType } from '#shared/types'

/**
 * How the eleven signals are named and coloured in the interface.
 *
 * One table, because the card, the filter bar and the detail sheet have to
 * agree: a chip that says "Label" in one place and "Labelnähe" in another
 * reads as two different things.
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

export const SIGNAL_LABEL: Record<SignalType, string> = {
  WANTLIST_EXACT: 'Wantlist',
  WANTLIST_PRESSING: 'Anderes Pressing',
  ARTIST_KNOWN: 'Künstler',
  ARTIST_GAP: 'Lücke',
  LABEL_AFFINITY: 'Label',
  CATALOG_RUN: 'Katalogserie',
  STYLE_ADJACENT: 'Stil',
  CREDIT_GRAPH: 'Credits',
  FORMAT_UPGRADE: 'Upgrade',
  PRICE_SIGNAL: 'Preis',
  SCARCITY: 'Seltenheit',
}

export function signalLabel(type: SignalType): string {
  return SIGNAL_LABEL[type] ?? type
}

/** Chip colours, mixed from the signal token so both stay in one place. */
export function signalChipStyle(type: SignalType) {
  const token = `var(--fid-sig-${SIGNAL_TOKEN[type] ?? 'label'})`
  return {
    backgroundColor: `color-mix(in oklch, ${token} 12%, transparent)`,
    borderColor: `color-mix(in oklch, ${token} 40%, transparent)`,
  }
}
