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
/**
 * A plate always has something to say, and every signal has one.
 *
 * No nulls and no gaps, unlike `lead` and `support`: a plate stands in a list
 * where the sentence has been taken away, so a signal with nothing here would
 * leave a card saying nothing at all about why it is in front of somebody.
 * Falling back to the evidence-free word is a decision each entry makes for
 * itself — "A gap" without the fraction is still a claim.
 */
type Plates = Record<Signal['type'], (evidence: Record<string, unknown>) => string>

/** A price in the sentence carries its currency: a London dealer quotes pounds. */
const price = (evidence: Record<string, unknown>, key: string): string | null => {
  const value = Number(evidence[key] ?? 0)
  const currency = String(evidence.currency ?? '')
  if (value <= 0 || !currency) return null
  return money(value, currency) ?? `${count(value)} ${currency}`
}

/**
 * A plate, with how many are on the shelf behind it.
 *
 * The arithmetic is the same in both languages, so it is written once — only
 * the words in front of it differ. One is left off rather than written: "On
 * the shelf · 1" counts something nobody was counting, and the sentence it
 * replaces names no figure at that point either.
 */
const shelved = (what: string, owned: unknown): string => {
  const n = Number(owned ?? 0)
  return n > 1 ? `${what} · ${count(n)}` : what
}

const en: {
  lead: Table
  support: Table
  plate: Plates
  fallback: string
  /**
   * The runners-up, joined the way the language joins a list, after the sentence.
   * The pack owns the whole clause (#251): where the commas go, whether an
   * "and" closes it and how the punctuation sits are grammar, not glue.
   */
  also: (extras: readonly string[]) => string
} = {
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

  /**
   * The reason with the sentence taken away (M33 #1).
   *
   * What is left when a reason has become a category: what is the matter with
   * this record, and the figure behind it. "On the shelf · 5" is the whole of
   * "You have 5 records by Four Tet, not this one" once the card above has
   * already said who Four Tet is.
   *
   * **Its own words, not the ones the filter chips use.** The chip table in
   * `app/utils/signals.ts` names a signal so it can be picked — "Artist",
   * "Label" — and that is the right word for a thing you switch on. A plate
   * stands where a sentence stood and has to make the claim the sentence made;
   * "ARTIST · PROBE 3 · 5" over a card headed "Probe 3" says the name twice and
   * the point not at all, which is what the first attempt at this looked like
   * on 2026-09-21 before anybody drew it.
   *
   * **A name only where the card lacks it.** The artist is the card's own
   * first line and the label is in the facts under it, so those plates carry
   * the figure alone. A producer, a style and a format are nowhere else on the
   * card, so those name what they are about.
   *
   * Short enough to stay on one line at `fid-plate`'s letter spacing. A plate
   * that wraps has turned back into a sentence.
   */
  plate: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST ? 'Wanted most' : 'On your wantlist',
    WANTLIST_PRESSING: () => 'Another pressing',
    ARTIST_KNOWN: (evidence) => shelved('On the shelf', evidence.owned),
    ARTIST_FOLLOWED: () => 'On your radar',
    ARTIST_GAP: (evidence) => {
      const total = Number(evidence.total ?? 0)
      if (total === 0) return 'A gap'
      return `A gap · ${count(Number(evidence.owned ?? 0))} of ${count(total)}`
    },
    LABEL_AFFINITY: (evidence) => shelved('Your label', evidence.owned),
    CATALOG_RUN: (evidence) => {
      const inRun = Number(evidence.inRun ?? 0)
      if (inRun === 0) return 'A run'
      return `A run · ${count(Number(evidence.owned ?? 0))} of ${count(inRun)}`
    },
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles[0] ? `Your ground · ${styles[0]}` : 'Your ground'
    },
    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      if (!person) return 'In the credits'
      return shelved(`Credits · ${person}`, evidence.owned)
    },
    FORMAT_UPGRADE: (evidence) => {
      const ownedAs = String(evidence.ownedAs ?? '')
      return ownedAs ? `You have the ${ownedAs}` : 'You have it otherwise'
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `Under ${lowest}` : 'Under the market'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `${count(n)} for sale` : 'Scarce'
    },
  },
  fallback: 'Fits what you collect.',
  also: (extras) => ` Also: ${extras.join(', ')}.`,
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

  plate: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST ? 'Ganz oben' : 'Auf deiner Wantlist',
    WANTLIST_PRESSING: () => 'Anderes Pressing',
    ARTIST_KNOWN: (evidence) => shelved('Im Regal', evidence.owned),
    ARTIST_FOLLOWED: () => 'Auf dem Schirm',
    ARTIST_GAP: (evidence) => {
      const total = Number(evidence.total ?? 0)
      if (total === 0) return 'Eine Lücke'
      return `Eine Lücke · ${count(Number(evidence.owned ?? 0))} von ${count(total)}`
    },
    LABEL_AFFINITY: (evidence) => shelved('Dein Label', evidence.owned),
    CATALOG_RUN: (evidence) => {
      const inRun = Number(evidence.inRun ?? 0)
      if (inRun === 0) return 'Eine Serie'
      return `Eine Serie · ${count(Number(evidence.owned ?? 0))} von ${count(inRun)}`
    },
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles[0] ? `Dein Revier · ${styles[0]}` : 'Dein Revier'
    },
    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      if (!person) return 'In den Credits'
      return shelved(`Credits · ${person}`, evidence.owned)
    },
    FORMAT_UPGRADE: (evidence) => {
      const ownedAs = String(evidence.ownedAs ?? '')
      return ownedAs ? `Hast du als ${ownedAs}` : 'Hast du anders'
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `Unter ${lowest}` : 'Unter dem Markt'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `${count(n)} im Angebot` : 'Selten'
    },
  },
  fallback: 'Passt zu dem, was du sammelst.',
  also: (extras) => ` Außerdem: ${extras.join(', ')}.`,
}

/** "you have 3 records" at the start of a sentence. */
function capital(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/**
 * "de" before a name, elided where French elides it: "d’Aphex Twin", "de Kompakt".
 *
 * Vowels only. A name starting with h is mostly an English or German name, and
 * those keep their h aspirated: "de Herbie Hancock".
 */
const of = (name: string): string =>
  /^[aeiouyàâäéèêëîïôöûü]/i.test(name) ? `d’${name}` : `de ${name}`

/** "1 disque", "0 disque", "4 disques": French counts nought in the singular. */
const records = (n: number): string => `${count(n)} ${n < 2 ? 'disque' : 'disques'}`

/** A list the French way: "Minimal, Tech House et Deep House". */
const listFr = (items: readonly string[]): string =>
  new Intl.ListFormat('fr', { type: 'conjunction' }).format(items)

/*
 * French: the person behind the counter says "tu". A space goes before a
 * colon, as French writes it; tests/unit/voice.spec.ts holds that line.
 */
const fr: typeof en = {
  lead: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? 'Il est sur ta liste d’envies, parmi ceux que tu veux le plus.'
        : 'Il est sur ta liste d’envies.',

    ARTIST_KNOWN: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!artist) return null

      const via = String(evidence.via ?? '')
      const relation = String(evidence.relation ?? '')
      if (via && relation) {
        const shelf =
          owned > 1 ? `tu as ${records(owned)} ${of(artist)}` : `${artist} est sur ton étagère`
        const [person, group] = relation === 'group' ? [artist, via] : [via, artist]
        return relation === 'alias'
          ? `${via}, c’est ${artist}. ${capital(shelf)}, mais pas celui-ci.`
          : `${person} fait partie ${of(group)}. ${capital(shelf)}, mais pas celui-ci.`
      }

      return owned > 1
        ? `Tu as ${records(owned)} ${of(artist)}, mais pas celui-ci.`
        : `${artist} est sur ton étagère. Ce disque, non.`
    },

    ARTIST_FOLLOWED: (evidence) => {
      const artist = String(evidence.artist ?? '')
      if (!artist) return null
      const via = String(evidence.via ?? '')
      return via
        ? `${via}, c’est ${artist}. Dans ton viseur, et encore rien sur l’étagère.`
        : `${artist} est dans ton viseur, et rien sur l’étagère pour l’instant.`
    },

    LABEL_AFFINITY: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!label) return null
      const lift = typeof evidence.lift === 'number' ? evidence.lift : null
      return lift
        ? `Tu collectionnes ${label} exprès : ${records(owned)}, ${lift.toFixed(0)} fois ce qu’on attendrait.`
        : `Tu collectionnes ${label}. Déjà ${records(owned)} sur l’étagère.`
    },

    WANTLIST_PRESSING: (evidence) => {
      const album = String(evidence.album ?? '')
      if (!album) return null
      const wanted = Number(evidence.wantedYear ?? 0)
      const pressing = Number(evidence.pressingYear ?? 0)
      const most =
        Number(evidence.want ?? 0) >= WANT_MOST ? ' Parmi ceux que tu veux le plus.' : ''
      if (wanted > 0 && pressing > 0 && pressing - wanted >= 15) {
        return `L’album de ta liste d’envies, mais un pressage de ${pressing}, pas l’original de ${wanted}.${most}`
      }
      return `Pas le pressage de ta liste d’envies, mais le même album : ${album}.${most}`
    },

    ARTIST_GAP: (evidence) => {
      const artist = String(evidence.artist ?? '')
      const owned = Number(evidence.owned ?? 0)
      const total = Number(evidence.total ?? 0)
      if (!artist || total === 0) return null
      return `Tu as ${count(owned)} des ${records(total)} ${of(artist)}. Celui-ci manque.`
    },

    CATALOG_RUN: (evidence) => {
      const label = String(evidence.label ?? '')
      const owned = Number(evidence.owned ?? 0)
      const inRun = Number(evidence.inRun ?? 0)
      const prefix = String(evidence.prefix ?? '')
      if (!label || inRun === 0) return null
      return `${label}, série ${prefix} : tu as ${count(owned)} des ${count(inRun)} numéros autour de celui-ci, mais pas lui.`
    },

    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      const owned = Number(evidence.owned ?? 0)
      if (!person) return null
      return owned > 1
        ? `${person} a travaillé dessus. Tu as ${records(owned)} avec son nom.`
        : `${person} a travaillé dessus.`
    },

    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      if (styles.length === 0) return null
      return `${listFr(styles.slice(0, 3))} : ton terrain.`
    },

    FORMAT_UPGRADE: (evidence) => {
      const album = String(evidence.album ?? '')
      const ownedAs = String(evidence.ownedAs ?? '')
      if (!album) return null
      return ownedAs
        ? `Tu as ${album}, mais en ${ownedAs}. Le voici en vinyle.`
        : `Tu as ${album} dans un autre format.`
    },

    PRICE_SIGNAL: (evidence) => {
      const paid = price(evidence, 'price')
      const lowest = price(evidence, 'marketLowest')
      return paid && lowest ? `${paid} ici, pour un plancher du marché à ${lowest}.` : null
    },

    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      if (n <= 0) return null
      return n === 1
        ? 'Un seul exemplaire en vente dans le monde.'
        : `Seulement ${count(n)} exemplaires en vente dans le monde.`
    },
  },

  support: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST
        ? 'sur ta liste d’envies, parmi les plus voulus'
        : 'sur ta liste d’envies',
    ARTIST_KNOWN: (evidence) => {
      if (!evidence.artist) return null
      const via = evidence.via ? `, sous le nom ${String(evidence.via)}` : ''
      return `${String(evidence.artist)} est sur ton étagère${via}`
    },
    ARTIST_FOLLOWED: (evidence) =>
      evidence.artist ? `${String(evidence.artist)} est dans ton viseur` : null,
    LABEL_AFFINITY: (evidence) =>
      evidence.label ? `tu collectionnes ${String(evidence.label)}` : null,
    WANTLIST_PRESSING: (evidence) =>
      evidence.album ? `un autre pressage ${of(String(evidence.album))}` : null,
    ARTIST_GAP: (evidence) =>
      evidence.artist ? `un trou dans tes disques ${of(String(evidence.artist))}` : null,
    CATALOG_RUN: (evidence) =>
      evidence.prefix ? `série de catalogue ${String(evidence.prefix)}` : null,
    CREDIT_GRAPH: (evidence) =>
      evidence.person ? `${String(evidence.person)} au travail` : null,
    FORMAT_UPGRADE: () => 'tu l’as dans un autre format',
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles.length > 0 ? `ton genre de ${styles[0]}` : null
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `sous le plancher du marché à ${lowest}` : 'sous le marché'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `seulement ${count(n)} en vente` : null
    },
  },

  plate: {
    WANTLIST_EXACT: (evidence) =>
      Number(evidence.want ?? 0) >= WANT_MOST ? 'Le plus voulu' : 'Sur ta liste d’envies',
    WANTLIST_PRESSING: () => 'Autre pressage',
    ARTIST_KNOWN: (evidence) => shelved('Sur l’étagère', evidence.owned),
    ARTIST_FOLLOWED: () => 'Dans le viseur',
    ARTIST_GAP: (evidence) => {
      const total = Number(evidence.total ?? 0)
      if (total === 0) return 'Un trou'
      return `Un trou · ${count(Number(evidence.owned ?? 0))} sur ${count(total)}`
    },
    LABEL_AFFINITY: (evidence) => shelved('Ton label', evidence.owned),
    CATALOG_RUN: (evidence) => {
      const inRun = Number(evidence.inRun ?? 0)
      if (inRun === 0) return 'Une série'
      return `Une série · ${count(Number(evidence.owned ?? 0))} sur ${count(inRun)}`
    },
    STYLE_ADJACENT: (evidence) => {
      const styles = Array.isArray(evidence.styles) ? (evidence.styles as string[]) : []
      return styles[0] ? `Ton terrain · ${styles[0]}` : 'Ton terrain'
    },
    CREDIT_GRAPH: (evidence) => {
      const person = String(evidence.person ?? '')
      if (!person) return 'Dans les crédits'
      return shelved(`Crédits · ${person}`, evidence.owned)
    },
    FORMAT_UPGRADE: (evidence) => {
      const ownedAs = String(evidence.ownedAs ?? '')
      return ownedAs ? `Tu l’as en ${ownedAs}` : 'Tu l’as autrement'
    },
    PRICE_SIGNAL: (evidence) => {
      const lowest = price(evidence, 'marketLowest')
      return lowest ? `Sous ${lowest}` : 'Sous le marché'
    },
    SCARCITY: (evidence) => {
      const n = Number(evidence.numForSale ?? 0)
      return n > 0 ? `${count(n)} en vente` : 'Rare'
    },
  },
  fallback: 'Va avec ce que tu collectionnes.',
  also: (extras) => ` Aussi : ${listFr(extras)}.`,
}

export const packs = { en, de, fr }

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
export function reasonFor(signals: readonly Signal[], without?: Signal['type']): string {
  const words = packs[activeLanguage()]
  /*
   * `without` is how a card that has turned its lead into a plate asks for the
   * rest (M33 #1): drop that signal and the next strongest one leads, which is
   * the sentence the card still has to make. Everything with nothing left
   * comes back empty, and an empty string draws no paragraph.
   */
  const ranked = [...signals].filter((signal) => signal.type !== without).sort(byStrength)
  const [lead, ...rest] = ranked
  if (!lead) return ''

  const sentence = words.lead[lead.type]?.(lead.evidence) ?? words.fallback

  const extras = rest
    .map((signal) => words.support[signal.type]?.(signal.evidence))
    .filter((phrase): phrase is string => typeof phrase === 'string' && phrase.length > 0)

  return extras.length === 0 ? sentence : `${sentence}${words.also(extras)}`
}

/**
 * The reason as a plate, for the list that has heard it twenty times (M33 #1).
 *
 * Always a string. What a card puts there instead of a sentence has to say
 * something, or the card has stopped answering the only question it exists to
 * answer.
 */
export function plateFor(signal: Signal): string {
  return packs[activeLanguage()].plate[signal.type](signal.evidence)
}
