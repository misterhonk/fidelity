import type { Signal } from '#shared/types'

import { WEIGHTS } from './score'

/**
 * The Barry sentence.
 *
 * "Eine Empfehlung ohne Begründung ist Rauschen. Eine Empfehlung mit
 * Begründung ist ein Verkäufer." The sentence is not decoration on top of the
 * score — it is the product, so it is generated from the same evidence the
 * score was computed from and can never drift away from it.
 *
 * Built from the strongest signal, with the runners-up appended as context.
 */

const number = new Intl.NumberFormat('de-DE')

type Phrase = (evidence: Record<string, unknown>) => string | null

const LEAD: Partial<Record<Signal['type'], Phrase>> = {
  WANTLIST_EXACT: () => 'Steht genau so auf deiner Wantlist.',

  ARTIST_KNOWN: (evidence) => {
    const artist = String(evidence.artist ?? '')
    const owned = Number(evidence.owned ?? 0)
    if (!artist) return null
    return owned > 1
      ? `Du hast ${number.format(owned)} Platten von ${artist} – diese nicht.`
      : `${artist} steht schon in deiner Sammlung – diese Platte nicht.`
  },

  LABEL_AFFINITY: (evidence) => {
    const label = String(evidence.label ?? '')
    const owned = Number(evidence.owned ?? 0)
    if (!label) return null
    return `${label} sammelst du – ${number.format(owned)} Platten stehen schon da.`
  },
}

const SUPPORT: Partial<Record<Signal['type'], Phrase>> = {
  WANTLIST_EXACT: () => 'steht auf deiner Wantlist',
  ARTIST_KNOWN: (evidence) =>
    evidence.artist ? `Künstler bekannt (${String(evidence.artist)})` : null,
  LABEL_AFFINITY: (evidence) => (evidence.label ? `Label ${String(evidence.label)}` : null),
}

/** Strongest signal first — the same ordering the score uses. */
function byStrength(a: Signal, b: Signal): number {
  return WEIGHTS[b.type] * b.confidence - WEIGHTS[a.type] * a.confidence
}

export function buildReason(signals: Signal[]): string {
  const ranked = [...signals].sort(byStrength)
  const [lead, ...rest] = ranked
  if (!lead) return ''

  const sentence = LEAD[lead.type]?.(lead.evidence) ?? 'Passt zu deiner Sammlung.'

  const extras = rest
    .map((signal) => SUPPORT[signal.type]?.(signal.evidence))
    .filter((phrase): phrase is string => typeof phrase === 'string' && phrase.length > 0)

  return extras.length === 0 ? sentence : `${sentence} Außerdem: ${extras.join(', ')}.`
}
