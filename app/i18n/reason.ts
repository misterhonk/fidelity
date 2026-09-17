import { WANT_MOST, type Signal } from '#shared/types'

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
    // "One you want most" only from Discogs' four stars up (M20 #1): the
    // priority changes the sentence, never the score.
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? "That's on your wantlist, and one you want most."
        : "That's on your wantlist.",

    ARTIST_KNOWN: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!artist) return null

      // Found under another name (docs/04 §S3, stage 0): say so, or the
      // sentence claims the listing said Dinky when it said Miss Dinky.
      const via = String(evidence.via ?? '')
      const relation = String(evidence.relation ?? '')
      if (via && relation) {
        const shelf =
          owned > 1
            ? `you have ${count(owned)} records by ${artist}`
            : `${artist} is on your shelf`
        const [person, group] = relation === 'group' ? [artist, via] : [via, artist]
        return relation === 'alias'
          ? `${via} is ${artist}. ${capital(shelf)}, not this one.`
          : `${person} is part of ${group}. ${capital(shelf)}, not this one.`
      }

      return owned > 1
        ? `You have ${count(owned)} records by ${artist}, not this one.`
        : `${artist} is on your shelf. This record is not.`
    },

    ARTIST_FOLLOWED: (evidence) => {
      const artist = String(evidence.artist ?? '')
      if (!artist) return null
      const via = String(evidence.via ?? '')
      return via
        ? `${via} is ${artist}. On your radar, and nothing of theirs on the shelf yet.`
        : `${artist} is on your radar, and nothing of theirs is on the shelf yet.`
    },

    LABEL_AFFINITY: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!label) return null
      const lift = typeof evidence.lift === 'number' ? evidence.lift : null
      return lift
        ? `You collect ${label} on purpose: ${count(owned)} records, ${lift.toFixed(0)}× what you'd expect.`
        : `You collect ${label}. ${count(owned)} records are on the shelf already.`
    },

    WANTLIST_PRESSING: (evidence) => {
      const album = String(evidence.album ?? '')
      if (!album) return null
      const wanted = Number(evidence.wantedYear ?? 0)
      const pressing = Number(evidence.pressingYear ?? 0)
      const most = Number(evidence.want ?? 0) >= WANT_MOST ? ' One you want most.' : ''
      if (wanted > 0 && pressing > 0 && pressing - wanted >= 15) {
        return `The album from your wantlist, but a ${pressing} pressing, not the ${wanted} original.${most}`
      }
      return `Not the pressing from your wantlist, but the same album: ${album}.${most}`
    },

    ARTIST_GAP: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      const total = Number(evidence.total ?? 0)
      if (!artist || total === 0) return null
      return `You have ${count(owned)} of ${count(total)} records by ${artist}. This one is missing.`
    },

    CATALOG_RUN: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      const inRun = Number(evidence.inRun ?? 0)
      const prefix = String(evidence.prefix ?? '')
      if (!label || inRun === 0) return null
      return `${label} series ${prefix}: you have ${count(owned)} of the ${count(inRun)} numbers around this one, not this one.`
    },

    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!person) return null
      return owned > 1
        ? `${person} worked on this. You have ${count(owned)} records of theirs.`
        : `${person} worked on this.`
    },

    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      if (styles.length === 0) return null
      return `${styles.slice(0, 3).join(', ')}: your home ground.`
    },

    FORMAT_UPGRADE: (evidence) => {
      const album = String(evidence.album ?? '')
      const ownedAs = String(evidence.ownedAs ?? '')
      if (!album) return null
      return ownedAs
        ? `You have ${album}, but as ${ownedAs}. Here it is on vinyl.`
        : `You have ${album} in another format.`
    },

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

  /* The supporting reasons, as a list after "Also:". Short, because they are a list. */
  support: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? 'on your wantlist, wanted most'
        : 'on your wantlist',
    ARTIST_KNOWN: (evidence) => {
      if (!evidence.artist) return null
      const via = evidence.via ? `, as ${String(evidence.via)}` : ''
      return `${String(evidence.artist)} is on your shelf${via}`
    },
    ARTIST_FOLLOWED: (evidence) =>
      evidence.artist ? `${String(evidence.artist)} is on your radar` : null,
    LABEL_AFFINITY: (evidence) =>
      evidence.label ? `you collect ${String(evidence.label)}` : null,
    WANTLIST_PRESSING: (evidence) =>
      evidence.album ? `another pressing of ${String(evidence.album)}` : null,
    ARTIST_GAP: (evidence) =>
      evidence.artist ? `a gap in your ${String(evidence.artist)}` : null,
    CATALOG_RUN: (evidence) =>
      evidence.prefix ? `catalogue run ${String(evidence.prefix)}` : null,
    CREDIT_GRAPH: (evidence) => (evidence.person ? `${String(evidence.person)} at work` : null),
    FORMAT_UPGRADE: () => 'you have it in another format',
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles.length > 0 ? `your kind of ${styles[0]}` : null
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `under the market low of ${lowest}` : 'under the market'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `only ${count(n)} for sale` : null
    },
  },
  fallback: 'Fits what you collect.',
  also: (rest) => ` Also: ${rest}.`,
}

const de: typeof en = {
  lead: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? 'Steht auf deiner Wantlist, und zwar ganz oben.'
        : 'Steht auf deiner Wantlist.',

    ARTIST_KNOWN: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!artist) return null

      const via = String(evidence.via ?? '')
      const relation = String(evidence.relation ?? '')
      if (via && relation) {
        const shelf =
          owned > 1
            ? `du hast ${count(owned)} Platten von ${artist}`
            : `${artist} steht bei dir im Regal`
        const [person, group] = relation === 'group' ? [artist, via] : [via, artist]
        return relation === 'alias'
          ? `${via} ist ${artist}. ${capital(shelf)}, diese nicht.`
          : `${person} gehört zu ${group}. ${capital(shelf)}, diese nicht.`
      }

      return owned > 1
        ? `Du hast ${count(owned)} Platten von ${artist}, diese nicht.`
        : `${artist} steht bei dir im Regal. Diese Platte nicht.`
    },

    ARTIST_FOLLOWED: (evidence) => {
      const artist = String(evidence.artist ?? '')
      if (!artist) return null
      const via = String(evidence.via ?? '')
      return via
        ? `${via} ist ${artist}. Hast du auf dem Schirm, und noch nichts davon im Regal.`
        : `${artist} hast du auf dem Schirm, und noch nichts davon im Regal.`
    },

    LABEL_AFFINITY: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!label) return null
      const lift = typeof evidence.lift === 'number' ? evidence.lift : null
      return lift
        ? `${label} sammelst du mit Absicht: ${count(owned)} Platten, ${lift.toFixed(0)}-mal so viel wie erwartet.`
        : `${label} sammelst du. ${count(owned)} Platten stehen schon da.`
    },

    WANTLIST_PRESSING: (evidence) => {
      const album = String(evidence.album ?? '')
      if (!album) return null
      const wanted = Number(evidence.wantedYear ?? 0)
      const pressing = Number(evidence.pressingYear ?? 0)
      const most = Number(evidence.want ?? 0) >= WANT_MOST ? ' Ganz oben auf deiner Liste.' : ''
      if (wanted > 0 && pressing > 0 && pressing - wanted >= 15) {
        return `Das Album von deiner Wantlist, aber eine Pressung von ${pressing}, nicht das Original von ${wanted}.${most}`
      }
      return `Nicht die Pressung von deiner Wantlist, aber dasselbe Album: ${album}.${most}`
    },

    ARTIST_GAP: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      const total = Number(evidence.total ?? 0)
      if (!artist || total === 0) return null
      return `Du hast ${count(owned)} von ${count(total)} Platten von ${artist}. Diese fehlt.`
    },

    CATALOG_RUN: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      const inRun = Number(evidence.inRun ?? 0)
      const prefix = String(evidence.prefix ?? '')
      if (!label || inRun === 0) return null
      return `${label}-Serie ${prefix}: Von den ${count(inRun)} Nummern um diese herum hast du ${count(owned)}, diese nicht.`
    },

    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!person) return null
      return owned > 1
        ? `${person} hat hier mitgearbeitet, wie auf ${count(owned)} Platten bei dir.`
        : `${person} hat hier mitgearbeitet.`
    },

    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      if (styles.length === 0) return null
      return `${styles.slice(0, 3).join(', ')}: dein Revier.`
    },

    FORMAT_UPGRADE: (evidence) => {
      const album = String(evidence.album ?? '')
      const ownedAs = String(evidence.ownedAs ?? '')
      if (!album) return null
      return ownedAs
        ? `${album} hast du schon, aber als ${ownedAs}. Hier auf Vinyl.`
        : `${album} hast du in einem anderen Format.`
    },

    PRICE_SIGNAL: (evidence) => {
      const paid = price(evidence, 'price')
      const lowest = price(evidence, 'marketLowest')
      return paid && lowest ? `${paid} hier, sonst am Markt ab ${lowest}.` : null
    },

    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      if (n <= 0) return null
      return n === 1
        ? 'Weltweit genau eine im Angebot.'
        : `Weltweit nur ${count(n)} im Angebot.`
    },
  },

  support: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? 'steht auf deiner Wantlist, ganz oben'
        : 'steht auf deiner Wantlist',
    ARTIST_KNOWN: (evidence) => {
      if (!evidence.artist) return null
      const via = evidence.via ? `, als ${String(evidence.via)}` : ''
      return `${String(evidence.artist)} steht bei dir im Regal${via}`
    },
    ARTIST_FOLLOWED: (evidence) =>
      evidence.artist ? `${String(evidence.artist)} hast du auf dem Schirm` : null,
    LABEL_AFFINITY: (evidence) =>
      evidence.label ? `${String(evidence.label)} sammelst du` : null,
    WANTLIST_PRESSING: (evidence) =>
      evidence.album ? `andere Pressung von ${String(evidence.album)}` : null,
    ARTIST_GAP: (evidence) =>
      evidence.artist ? `eine Lücke bei ${String(evidence.artist)}` : null,
    CATALOG_RUN: (evidence) =>
      evidence.prefix ? `Katalogreihe ${String(evidence.prefix)}` : null,
    CREDIT_GRAPH: (evidence) =>
      evidence.person ? `${String(evidence.person)} hat mitgearbeitet` : null,
    FORMAT_UPGRADE: () => 'hast du in einem anderen Format',
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles.length > 0 ? `dein Revier (${styles[0]})` : null
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `unter dem Marktpreis von ${lowest}` : 'unter dem Marktpreis'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `nur ${count(n)} im Angebot` : null
    },
  },
  fallback: 'Passt zu dem, was du sammelst.',
  also: (rest) => ` Außerdem: ${rest}.`,
}

/** "you have 3 records" at the start of a sentence. */
function capital(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
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
