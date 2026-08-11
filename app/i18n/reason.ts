import type { Signal } from '#shared/types'

import { byStrength } from '~~/worker/match/reason'

import { activeLanguage } from '~/composables/useMessages'
import { count, money } from '~/utils/money'

/**
 * The Barry sentence.
 *
 * "A recommendation without a reason is noise. A recommendation with a reason
 * is a clerk." The sentence is not decoration on top of the score — it is the
 * product, so it is generated from the same evidence the score was computed
 * from and can never drift away from it.
 *
 * **Why it lives here and not in the worker any more.** It used to be built in
 * `worker/match/reason.ts` at scan time and stored on every match. That put
 * user-facing prose in a thread that has no idea what language the interface is
 * in — the same boundary mistake `vaultStatus` made — and it froze the wording
 * of a dig at the moment it ran, so switching language left a list of German
 * sentences under an English heading.
 *
 * Building it where it is read fixes both, and costs less: a dig produces
 * hundreds of matches and a screen shows twenty.
 *
 * What stayed in the worker is `byStrength` — the ordering, which is the
 * engine's own and reads `WEIGHTS`. Which signal leads is a scoring decision;
 * how it reads is not.
 */

type Phrase = (evidence: Record<string, unknown>) => string | null
type Table = Partial<Record<Signal['type'], Phrase>>

/** A price in the sentence carries its currency: a London dealer quotes pounds. */
const price = (evidence: Record<string, unknown>, key: string): string | null => {
  const value = Number(evidence[key] ?? 0)
  const currency = String(evidence.currency ?? '')
  if (value <= 0 || !currency) return null
  return money(value, currency) ?? `${count(value)} ${currency}`
}

const en: { lead: Table; support: Table; fallback: string; also: (rest: string) => string } = {
  lead: {
    WANTLIST_EXACT: () => 'Exactly this is on your wantlist.',

    ARTIST_KNOWN: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!artist) return null
      return owned > 1
        ? `You have ${count(owned)} records by ${artist} — not this one.`
        : `${artist} is already on your shelf — this record is not.`
    },

    LABEL_AFFINITY: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!label) return null
      const lift = typeof evidence.lift === 'number' ? evidence.lift : null
      return lift
        ? `You collect ${label} on purpose — ${count(owned)} records, ${lift.toFixed(0)}× what would be expected.`
        : `You collect ${label} — ${count(owned)} records are already there.`
    },

    WANTLIST_PRESSING: (evidence) => {
      const album = String(evidence.album ?? '')
      if (!album) return null
      const wanted = Number(evidence.wantedYear ?? 0)
      const pressing = Number(evidence.pressingYear ?? 0)
      if (wanted > 0 && pressing > 0 && pressing - wanted >= 15) {
        return `The same album as on your wantlist — but a pressing from ${pressing}, not the ${wanted} original.`
      }
      return `Not the pressing from your wantlist, but the same album: ${album}.`
    },

    ARTIST_GAP: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      const total = Number(evidence.total ?? 0)
      if (!artist || total === 0) return null
      return `You have ${count(owned)} of ${count(total)} records by ${artist} — this one is missing.`
    },

    CATALOG_RUN: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      const inRun = Number(evidence.inRun ?? 0)
      const prefix = String(evidence.prefix ?? '')
      if (!label || inRun === 0) return null
      return `${label} series ${prefix}: of ${count(inRun)} numbers nearby you have ${count(owned)} — not this one.`
    },

    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!person) return null
      return owned > 1
        ? `${person} worked on this — you have ${count(owned)} records of theirs.`
        : `${person} worked on this.`
    },

    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      if (styles.length === 0) return null
      return `${styles.slice(0, 3).join(', ')} — your home ground.`
    },

    FORMAT_UPGRADE: (evidence) => {
      const album = String(evidence.album ?? '')
      const ownedAs = String(evidence.ownedAs ?? '')
      if (!album) return null
      return ownedAs
        ? `You have ${album} already — but as ${ownedAs}. Here it is on vinyl.`
        : `You have ${album} in another format.`
    },

    // Both numbers named, not the ratio. "0.58×" is arithmetic; "£24 against a
    // market low of £41" is an argument (docs/04 §S10).
    PRICE_SIGNAL: (evidence) => {
      const paid = price(evidence, 'price')
      const lowest = price(evidence, 'marketLowest')
      return paid && lowest ? `${paid} against a market low of ${lowest}.` : null
    },

    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      if (n <= 0) return null
      return n === 1
        ? 'Exactly one copy for sale worldwide.'
        : `Only ${count(n)} copies for sale worldwide.`
    },
  },

  support: {
    WANTLIST_EXACT: () => 'on your wantlist',
    ARTIST_KNOWN: (evidence) =>
      evidence.artist ? `artist known (${String(evidence.artist)})` : null,
    LABEL_AFFINITY: (evidence) => (evidence.label ? `label ${String(evidence.label)}` : null),
    WANTLIST_PRESSING: (evidence) =>
      evidence.album ? `another pressing of ${String(evidence.album)}` : null,
    ARTIST_GAP: (evidence) =>
      evidence.artist ? `discography gap at ${String(evidence.artist)}` : null,
    CATALOG_RUN: (evidence) =>
      evidence.prefix ? `catalogue run ${String(evidence.prefix)}` : null,
    CREDIT_GRAPH: (evidence) => (evidence.person ? `${String(evidence.person)} at work` : null),
    FORMAT_UPGRADE: () => 'format upgrade',
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles.length > 0 ? `style fits (${styles[0]})` : null
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `under market (${lowest})` : 'under market'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `only ${count(n)} for sale` : null
    },
  },

  fallback: 'Fits your collection.',
  also: (rest) => ` Also: ${rest}.`,
}

const de: typeof en = {
  lead: {
    WANTLIST_EXACT: () => 'Steht genau so auf deiner Wantlist.',

    ARTIST_KNOWN: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!artist) return null
      return owned > 1
        ? `Du hast ${count(owned)} Platten von ${artist} – diese nicht.`
        : `${artist} steht schon in deiner Sammlung – diese Platte nicht.`
    },

    LABEL_AFFINITY: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!label) return null
      const lift = typeof evidence.lift === 'number' ? evidence.lift : null
      return lift
        ? `${label} sammelst du gezielt – ${count(owned)} Platten, ${lift.toFixed(0)}× so viel wie zu erwarten wäre.`
        : `${label} sammelst du – ${count(owned)} Platten stehen schon da.`
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
      return `Du hast ${count(owned)} von ${count(total)} Platten von ${artist} – diese fehlt.`
    },

    CATALOG_RUN: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      const inRun = Number(evidence.inRun ?? 0)
      const prefix = String(evidence.prefix ?? '')
      if (!label || inRun === 0) return null
      return `${label}-Serie ${prefix}: von ${count(inRun)} Nummern in der Nähe hast du ${count(owned)} – diese nicht.`
    },

    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!person) return null
      return owned > 1
        ? `${person} hat hier mitgewirkt – du hast ${count(owned)} Platten von ihm.`
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

    PRICE_SIGNAL: (evidence) => {
      const paid = price(evidence, 'price')
      const lowest = price(evidence, 'marketLowest')
      return paid && lowest ? `${paid} bei einem Markt-Tiefstpreis von ${lowest}.` : null
    },

    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      if (n <= 0) return null
      return n === 1
        ? 'Weltweit genau ein Exemplar im Angebot.'
        : `Nur ${count(n)} Exemplare weltweit im Angebot.`
    },
  },

  support: {
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
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `unter Markt (${lowest})` : 'unter Markt'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `nur ${count(n)} im Angebot` : null
    },
  },

  fallback: 'Passt zu deiner Sammlung.',
  also: (rest) => ` Außerdem: ${rest}.`,
}

export const packs = { en, de }

/**
 * The sentence, from the strongest signal, with the runners-up appended.
 *
 * A plain function rather than a composable: it is called from templates, from
 * a `computed` and from the export, and it reads the active language on every
 * call — so a list already on screen follows a switch.
 */
/*
 * `readonly` on the way in: a basket summary is a `DeepReadonly` projection,
 * and this function has no business mutating what it is handed. The copy for
 * sorting was already there.
 */
export function reasonFor(signals: readonly Signal[]): string {
  const words = packs[activeLanguage()]
  const ranked = [...signals].sort(byStrength)
  const [lead, ...rest] = ranked
  if (!lead) return ''

  const sentence = words.lead[lead.type]?.(lead.evidence) ?? words.fallback

  const extras = rest
    .map((signal) => words.support[signal.type]?.(signal.evidence))
    .filter((phrase): phrase is string => typeof phrase === 'string' && phrase.length > 0)

  return extras.length === 0 ? sentence : `${sentence}${words.also(extras.join(', '))}`
}
