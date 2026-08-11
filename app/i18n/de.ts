/**
 * German — a translation, not the original. See ADR-010.
 *
 * Loaded on demand: whoever reads English never downloads this file. That is
 * the whole reason it is a separate module and not a second branch inside
 * `en.ts`.
 *
 * Typed as `Messages`, so this file cannot be incomplete. If a key appears in
 * `en.ts` and not here, `pnpm typecheck` says so by name.
 *
 * Translate the sense, not the words. Several of these sentences were written
 * in German first and are better in German than a literal rendering of the
 * English would be; where that is true, they stay as they were.
 */

import type { Messages } from './en'

import { counted } from '~/utils/plural'

const de: Messages = {
  meta: {
    name: 'Deutsch',
    locale: 'de-DE',
  },

  when: {
    justNow: 'gerade eben',
    yesterday: 'gestern',
  },

  common: {
    signIn: { lead: 'Erst anmelden –', link: 'zur Startseite' },
    nothingYet: 'Noch nichts geholt',
    off: 'Aus',
    never: 'noch nie',
  },

  notice: {
    offline: {
      title: 'Kein Netz.',
      body: 'Deine Sammlung, die Landkarte und die letzten Digs liegen auf diesem Gerät und funktionieren weiter. Was nicht geht: neue Digs, Synchronisieren, Marktpreise.',
    },
    install: {
      title: 'Aufs Handy legen',
      got_it: 'Verstanden',
      body_before: 'In Safari unten auf',
      share: 'Teilen',
      body_middle: 'tippen, dann',
      addToHome: 'Zum Home-Bildschirm',
      body_after:
        '. Danach startet Fidelity ohne Browserleiste und läuft auch im Keller ohne Empfang.',
    },
    update: {
      title: 'Eine neue Version steht bereit.',
      later: 'Später',
      reload: 'Neu laden',
    },
  },

  error: {
    detail: 'Was Discogs genau gesagt hat',
    unknown: 'Etwas ist schiefgegangen.',

    tokenRevoked: {
      title: 'Discogs nimmt den Token nicht mehr an.',
      action:
        'Er wurde vermutlich bei Discogs zurückgezogen. Ein neuer aus den Entwickler-Einstellungen reicht – deine Daten hier bleiben, wo sie sind.',
    },
    tokenUnknown: {
      title: 'Discogs kennt diesen Token nicht.',
      action:
        'Meistens ist beim Kopieren etwas verrutscht – ein Leerzeichen, ein fehlendes Zeichen am Ende. Hol ihn dir noch einmal aus den Entwickler-Einstellungen und füg ihn vollständig ein.',
    },
    rateLimited: {
      title: 'Discogs bremst gerade.',
      action:
        'Sechzig Abfragen pro Minute, und die teilst du mit nichts und niemandem – ein, zwei Minuten warten reicht. Was schon gescannt war, ist gespeichert.',
    },
    offline: {
      title: 'Discogs ist nicht erreichbar.',
      action:
        'Sammlung, Landkarte und die letzten Digs liegen auf diesem Gerät und funktionieren weiter. Neue Digs brauchen Netz.',
    },
    storageFull: {
      title: 'Kein Platz mehr auf diesem Gerät.',
      action:
        'Der Browser gibt Fidelity nicht mehr Speicher. Alte Digs laufen ohnehin nach sechs Stunden ab; „Alles löschen" auf der Startseite schafft den Rest.',
    },
  },

  why: 'Warum?',

  freshness: {
    looking: 'Sieht nach …',
    nothingNew: 'Nichts Neues.',
    added: (records) => `${counted(records, 'Platte', 'Platten')} dazu`,
    alerts: (shops) => `${counted(shops, 'Laden hat', 'Läden haben')} Neues`,
    asOf: (when) => `Stand von ${when}`,
    refreshAll: 'Alles auffrischen',
  },

  token: {
    title: 'Token eintragen',
    lead: 'Fidelity spricht direkt mit Discogs – ohne Server dazwischen. Dafür braucht es einen persönlichen Token, den du dir selbst erzeugst.',
    sampleTitle: 'Was dabei herauskommt',
    sampleNote:
      'Beispiele. Eine Punktzahl, ein Satz, warum – für jede Platte im Sortiment eines Händlers. Mit deiner Sammlung stehen dort deine Künstler und deine Labels.',
    step1: 'öffnen',
    step2: '„Generate token" klicken',
    step3: 'Den Token hier einfügen',
    field: 'Personal Access Token',
    readsOnly: 'Fidelity liest nur.',
    readsOnlyRest:
      'Sammlung, Wantlist und Händlersortimente – mehr nicht. Es ändert nichts an deinem Discogs-Konto, kauft nichts und schreibt nichts zurück. Gekauft wird bei Discogs, von dir.',
    staysHere:
      'Der Token bleibt auf diesem Gerät gespeichert und wird an niemanden weitergegeben – auch nicht an uns. Es gibt keinen Server, der ihn empfangen könnte.',
    checking: 'Prüfe …',
    signIn: 'Anmelden',
  },

  signals: {
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
  },

  home: {
    title: 'Start',
    description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
    counts: {
      collection: 'Sammlung',
      wantlist: 'Wantlist',
      marked: 'Gemerkt',
      dealers: 'Läden',
      basket: 'Im Korb',
    },
    lastFound: 'Zuletzt gefunden',
    interrupted: (scanned, total) =>
      `Dieser Dig wurde unterbrochen – ${scanned} von ${total} waren durch.`,
    carryOn: 'Dort fortsetzen',
    pricesGone:
      'Preise älter als sechs Stunden, dürfen nicht mehr gezeigt werden. Treffer und Begründungen bleiben.',
    whyThese: 'Warum diese?',
    newOnShelf: 'Neu im Regal',
    lastNoted: 'Zuletzt notiert',
    wanted: (n) => `${n} Wünsche`,
    yourShops: 'Deine Läden',
  },

  nav: {
    label: 'Hauptbereiche',
    start: { label: 'Start', hint: 'Was ist neu, was steht an' },
    dig: { label: 'Graben', hint: 'Einen Händler scannen' },
    basket: { label: 'Korb', hint: 'Was du kaufen willst' },
    shelf: { label: 'Sammlung', hint: 'Was du hast und was du suchst' },
    dealers: { label: 'Läden', hint: 'Bei wem du kaufst' },
    settings: 'Einstellungen',
    inBasket: (count) => `${count} im Korb`,
  },
}

export default de
