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
    const lift = typeof evidence.lift === 'number' ? evidence.lift : null
    return lift
      ? `${label} sammelst du gezielt – ${number.format(owned)} Platten, ${lift.toFixed(0)}× so viel wie zu erwarten wäre.`
      : `${label} sammelst du – ${number.format(owned)} Platten stehen schon da.`
  },

  WANTLIST_PRESSING: (evidence) => {
    const album = String(evidence.album ?? '')
    if (!album) return null
    const wanted = Number(evidence.wantedYear ?? 0)
    const pressing = Number(evidence.pressingYear ?? 0)
    if (wanted > 0 && pressing > 0 && pressing - wanted >= 15) {
      return `Dasselbe Album wie auf deiner Wantlist – aber eine Pressung von ${pressing}, nicht das Original von ${wanted}.`
    }
    return `Nicht die Pressung von deiner Wantlist, aber dasselbe Album: ${album}.`
  },

  ARTIST_GAP: (evidence) => {
    const artist = String(evidence.artist ?? '')
    const owned = Number(evidence.owned ?? 0)
    const total = Number(evidence.total ?? 0)
    if (!artist || total === 0) return null
    return `Du hast ${number.format(owned)} von ${number.format(total)} Platten von ${artist} – diese fehlt.`
  },

  CATALOG_RUN: (evidence) => {
    const label = String(evidence.label ?? '')
    const owned = Number(evidence.owned ?? 0)
    const inRun = Number(evidence.inRun ?? 0)
    const prefix = String(evidence.prefix ?? '')
    if (!label || inRun === 0) return null
    return `${label}-Serie ${prefix}: von ${number.format(inRun)} Nummern in der Nähe hast du ${number.format(owned)} – diese nicht.`
  },

  CREDIT_GRAPH: (evidence) => {
    const person = String(evidence.person ?? '')
    const owned = Number(evidence.owned ?? 0)
    if (!person) return null
    return owned > 1
      ? `${person} hat hier mitgewirkt – du hast ${number.format(owned)} Platten von ihm.`
      : `${person} hat hier mitgewirkt.`
  },

  STYLE_ADJACENT: (evidence) => {
    const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
    if (styles.length === 0) return null
    return `${styles.slice(0, 3).join(', ')} – dein Kernrevier.`
  },

  FORMAT_UPGRADE: (evidence) => {
    const album = String(evidence.album ?? '')
    const ownedAs = String(evidence.ownedAs ?? '')
    if (!album) return null
    return ownedAs
      ? `${album} hast du schon – aber als ${ownedAs}. Hier ist es auf Vinyl.`
      : `${album} hast du in einem anderen Format.`
  },
}

const SUPPORT: Partial<Record<Signal['type'], Phrase>> = {
  WANTLIST_EXACT: () => 'steht auf deiner Wantlist',
  ARTIST_KNOWN: (evidence) =>
    evidence.artist ? `Künstler bekannt (${String(evidence.artist)})` : null,
  LABEL_AFFINITY: (evidence) => (evidence.label ? `Label ${String(evidence.label)}` : null),
  WANTLIST_PRESSING: (evidence) =>
    evidence.album ? `anderes Pressing von ${String(evidence.album)}` : null,
  ARTIST_GAP: (evidence) =>
    evidence.artist ? `Diskografie-Lücke bei ${String(evidence.artist)}` : null,
  CATALOG_RUN: (evidence) =>
    evidence.prefix ? `Katalogserie ${String(evidence.prefix)}` : null,
  CREDIT_GRAPH: (evidence) => (evidence.person ? `${String(evidence.person)} am Werk` : null),
  FORMAT_UPGRADE: () => 'Format-Upgrade',
  STYLE_ADJACENT: (evidence) => {
    const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
    return styles.length > 0 ? `Stil passt (${styles[0]})` : null
  },
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
