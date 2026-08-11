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

    oauthMismatch: 'Die Antwort des Anbieters gehört nicht zu dieser Anfrage.',
    oauthNoToken: 'Der Anbieter hat keinen Zugriffsschlüssel geschickt.',
    noFilePicker: 'Dieser Browser kann keine Datei auswählen.',
    noFileChosen: 'Noch keine Datei gewählt.',
    fileUnreadable: 'Die Datei enthält keinen lesbaren Tresor.',

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

  nextStep: {
    library: {
      cta: 'Sammlung holen',
      title: 'Als Erstes: deine Sammlung holen',
      body: 'Ohne sie weiß Fidelity nicht, was du magst. Ein paar Sekunden pro tausend Platten, danach ist sie auf diesem Gerät.',
    },
    horizon: {
      cta: 'Horizont bauen',
      title: 'Dann: den Horizont bauen',
      body: (minutes) =>
        `Einmalig rund ${counted(minutes, 'Minute', 'Minuten')}. Danach erkennt jeder Dig auch Produzenten, Katalogserien und andere Pressungen deiner Platten.`,
    },
    dig: {
      cta: 'Dig starten',
      title: 'Jetzt: den ersten Händler scannen',
      body: 'Nimm einen, bei dem du ohnehin kaufst. Zwei bis vier Minuten für zwanzigtausend Listings, und am Ende steht eine Liste mit einem Satz pro Treffer.',
    },
  },

  palette: {
    placeholder: 'Künstler, Händler, Dig …',
    nothing: 'Nichts gefunden. Digs und Händler tauchen hier auf, sobald es welche gibt.',
    goTo: 'Gehe zu',
    dealers: 'Händler',
    digs: 'Digs',
    lastDig: 'Im letzten Dig',
    inStore: 'Im Laden',
    affinity: (rate) => `${rate} Treffer je tausend`,
    digHint: (matches, when) => `${matches} Treffer · ${when}`,
  },

  watch: {
    whyLabel: 'Wie gezählt wird',
    why: 'Die Gesamtzahl des Ladens, nicht wie viele Platten neu sind – wer fünf verkauft und fünf einstellt, bewegt sich um null. Ein Dig sagt, was davon für dich dabei ist.',
  },

  catalogRun: 'Ausgefüllt = im Regal. Umrandet = diese Platte.',

  credits: {
    title: 'Wer hier mitgewirkt hat',
    look: 'Nachsehen',
    about:
      "Discogs' größter ungenutzter Schatz: wer produziert, gemischt oder gemastert hat. Steht schon im Horizont – die Antwort kommt sofort.",
    hereOnly: (here) => `${here} hier, von denen du noch nichts hast.`,
    youHave: (owned, here) => `Du hast ${owned} — dieser Händler hat ${here} mehr.`,
    records: (n) => counted(n, 'Platte', 'Platten'),
  },

  inStore: {
    title: 'Im Laden',
    description: 'Die Fundliste für die Hand am Plattenfach – offline, große Ziele.',
    back: 'Zurück',
    offline: 'offline, alles aus dem Gerät',
    interrupted: (scanned, total) =>
      `Dieser Dig wurde unterbrochen – ${scanned} von ${total} waren durch. Was hier steht, ist also nicht alles.`,
    noDig:
      'Noch kein Dig – die Fundliste bleibt also leer. Deine Sammlung und deine Wantlist kannst du trotzdem durchsuchen, auch ohne Empfang.',
    expired:
      'Älter als sechs Stunden – Preise und Zustände dürfen nicht mehr angezeigt werden. Die Treffer und ihre Begründungen stehen weiter.',
    search: 'Künstler oder Titel',
    searchLabel: 'Sammlung, Wantlist und die Fundliste durchsuchen',
  },

  discovery: {
    search: 'Läden bei Discogs suchen',
    searching: 'Suche …',
    about:
      'In deinen Bestellungen – das sind die Läden, bei denen du wirklich gekauft hast. Wenn du es in den Einstellungen erlaubst, zusätzlich in deiner Discogs-Freundesliste. Eine Abfrage je Quelle, dann eine pro Kandidat, um zu sehen wer überhaupt verkauft.',
    added: (n) => (n === 1 ? 'Ein Laden dazu.' : `${n} Läden dazu.`),
    take: (n) => `${n} übernehmen`,
  },

  evidence: {
    artist: 'Künstler',
    album: 'Album',
    label: 'Label',
    person: 'Person',
    owned: 'im Regal',
    total: 'Diskografie',
    ownedAs: 'du hast',
    styles: 'Stile',
    similarity: 'Nähe',
    lift: 'Lift',
    share: 'Anteil',
    prefix: 'Serie',
    number: 'Nummer',
    inRun: 'in der Serie',
    wantedYear: 'gewünscht',
    pressingYear: 'diese Pressung',
    price: 'Preis',
    marketLowest: 'Markt-Tiefstpreis',
    ratio: 'Verhältnis',
    numForSale: 'im Angebot',
  },
  close: 'Schließen',
  mainReleases: (n) => `${n} Hauptveröffentlichungen`,

  demo: {
    title: 'Erst ansehen',
    lead: 'Eine Platte aussuchen – Fidelity zeigt, was im selben Laden dazu passt. Ohne Anmeldung.',
    listing: 'Ein Angebot von Discogs',
    look: 'Ansehen',
    orOne: 'Oder eine von diesen:',
    moment: 'Einen Moment …',
    fetching: 'Hole die Platte …',
    comparing: 'Vergleiche …',
    progress: 'Fortschritt',
    fitsAt: (dealer) => `Bei ${dealer} passt dazu`,
    score: (score) => `Barry Score ${score} von 100`,
    nothing:
      'In diesem Ausschnitt lag nichts, das dazu passt. Das kommt vor: eine Platte allein ist ein dünner Anhaltspunkt, und gelesen wurde nur ein Teil des Ladens. Mit deiner Sammlung sieht das anders aus.',
    coverage: (scanned, total) =>
      `Gelesen wurden ${scanned} der ${total} Angebote, mit einer Platte als Anhaltspunkt. Ein Dig liest den ganzen Laden und kennt deine Sammlung.`,
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
