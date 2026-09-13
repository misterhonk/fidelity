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
    atDiscogs: (title) => `${title}, bei Discogs ansehen`,
    openRecord: (title) => `${title} öffnen`,
    toTop: 'Zurück nach oben',
    opensAtDiscogs: '(öffnet bei Discogs)',
    nothingYet: 'Noch nichts geholt',
    off: 'Aus',
    never: 'noch nie',
    ofTotal: (done: string | number, total: string | number) => `${done} von ${total}`,
    loading: 'Wird geladen …',
    asking: 'Frage nach …',
    searching: 'Suche …',
    save: 'Speichern',
    to: 'bis',
    etaLeft: (clock: string) => `· noch ca. ${clock}`,
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

    hubUnreachable: {
      title: 'Unter dieser Adresse antwortet nichts.',
      action: 'Läuft der Hub, und stimmen Adresse und Port?',
    },
    hubMixedContent: {
      title: 'Hier nicht erreichbar.',
      action:
        'Diese Seite läuft über HTTPS und darf deshalb keine unverschlüsselte Adresse aufrufen. In Chrome geht es; dauerhaft hilft nur, den Hub selbst über HTTPS erreichbar zu machen.',
    },
    scanRunning: (dealer: string) => ({
      title: `Ein Scan von ${dealer} läuft schon.`,
      action:
        'Nur einer auf einmal – das ist das Rate-Limit, keine Vorliebe. Er läuft im Hintergrund weiter und dieser Bildschirm zeigt ihn; den nächsten startest du, wenn er durch ist.',
    }),
    hubHttpError: (status) => ({
      title: `Der Hub antwortete mit HTTP ${status}.`,
      action: 'Das sagt der Hub, nicht Discogs — sein eigenes Log weiß mehr.',
    }),

    oauthMismatch: 'Die Antwort des Anbieters gehört nicht zu dieser Anfrage.',
    oauthNoToken: 'Der Anbieter hat keinen Zugriffsschlüssel geschickt.',
    noFilePicker: 'Dieser Browser kann keine Datei auswählen.',
    noFileChosen: 'Noch keine Datei gewählt.',
    fileUnreadable: 'Die Datei enthält keinen lesbaren Tresor.',
    fileDenied: 'Der Browser hat den Zugriff auf die Datei nicht erlaubt.',
    notAVault: 'Diese Datei ist kein Fidelity-Tresor.',
    oauthRejected: (provider) => `${provider} hat den Code abgelehnt.`,
    notConnected: 'Noch nicht verbunden.',
    connectionExpired: 'Die Verbindung ist abgelaufen – bitte neu verbinden.',
    // Previously „liess" — the Swiss spelling in an otherwise German pack.
    refreshFailed: 'Die Verbindung ließ sich nicht erneuern.',
    vaultNotGiven: (provider) => `${provider} hat den Tresor nicht herausgegeben.`,
    vaultNotTaken: (provider) => `${provider} hat den Tresor nicht angenommen.`,
    vaultNotCreated: (provider) => `${provider} hat den Tresor nicht angelegt.`,
    providerUnexpected: (provider) => `${provider} antwortet nicht wie erwartet.`,
    noCloudTarget: 'Kein Cloud-Ziel.',

    failed: {
      'no-token': {
        title: 'Kein Token eingegeben.',
        action: 'Füge deinen Personal Access Token von Discogs in das Feld ein.',
      },
      'not-signed-in': {
        title: 'Nicht angemeldet.',
        action: 'Trag deinen Discogs-Token in den Einstellungen ein – alles hier braucht ihn.',
      },
      'no-listing': {
        title: 'Keine Platte angegeben.',
        action: 'Füge einen Link zu einer Platte in einem Discogs-Laden ein.',
      },
      'dig-gone': {
        title: 'Diesen Dig gibt es nicht mehr.',
        action: 'Digs leben sechs Stunden, dann sind ihre Preise weg. Scanne den Laden neu.',
      },
      'dig-expired': {
        title: 'Der Sechs-Stunden-Rahmen ist abgelaufen.',
        action:
          'So alte Preise dürfen nicht mehr gezeigt werden. Ein neuer Scan dauert eine Minute.',
      },
      'dig-running': {
        title: 'Es läuft schon ein Scan.',
        action:
          'Nur einer auf einmal – das ist das Rate-Limit, keine Vorliebe. Lass ihn zu Ende laufen.',
      },
      'dig-not-running': {
        title: 'Hier ist nichts fortzusetzen.',
        action: 'Dieser Dig läuft nicht. Starte einen neuen Scan des Ladens.',
      },
      'deep-scan-done': {
        title: 'Ein Tiefenscan wird nicht fortgesetzt.',
        action: 'Was er gefunden hat, ist da. Ihn aufzunehmen würde Platten doppelt zählen.',
      },
      'no-anchor': {
        title: 'Es gibt noch nichts zu vergleichen.',
        action: '„Nur das Neue" braucht einen vollständigen Scan dieses Ladens als Anfang.',
      },
      'match-gone': {
        title: 'Diesen Fund gibt es nicht mehr.',
        action: 'Er ist nach sechs Stunden mit seinem Dig gegangen. Scanne den Laden neu.',
      },
      'no-hub': {
        title: 'Kein Hub eingetragen.',
        action: 'Ein Hub ist freiwillig – trag in den Einstellungen einen ein oder lass es.',
      },
      'not-a-hub': {
        title: 'Das ist kein Fidelity-Hub.',
        action: 'Unter der Adresse antwortet etwas, aber kein Hub. Prüfe Adresse und Port.',
      },
      'no-catalogue': {
        title: 'Kein Katalog eingetragen.',
        action:
          'Ein Katalog ist freiwillig – trag in den Einstellungen einen ein oder lass es.',
      },
      'not-a-catalogue': {
        title: 'Das ist kein Fidelity-Katalog.',
        action: 'Unter der Adresse antwortet etwas, aber kein Katalog. Prüfe Adresse und Port.',
      },
      'not-a-backup': {
        title: 'Das ist kein Fidelity-Backup.',
        action:
          'Ein Backup ist die Datei, die „Alles exportieren" hier schreibt – fidelity-backup-<Datum>.json.',
      },
      'backup-too-new': {
        title: 'Dieses Backup stammt aus einer neueren Fidelity.',
        action:
          'Erst die App aktualisieren – eine ältere würde es falsch lesen statt gar nicht.',
      },
      'token-other-account': {
        title: 'Dieser Token gehört zu einem anderen Discogs-Konto.',
        action:
          'Was auf diesem Gerät liegt, gehört dem angemeldeten Konto. Zum Kontowechsel erst abmelden – das löscht die Datenbank – und mit dem neuen Token anmelden.',
      },
      'vault-too-new': {
        title: 'Diese Sicherung stammt aus einem neueren Fidelity.',
        action: 'Aktualisiere zuerst die App – eine ältere läse sie falsch statt gar nicht.',
      },
      'vault-unusable': {
        title: 'Dieses Sicherungsziel lässt sich nicht benutzen.',
        action: 'Sieh in den Einstellungen nach dem Ziel.',
      },
      'passphrase-short': {
        title: 'Die Passphrase ist zu kurz.',
        action:
          'Mindestens acht Zeichen. Sie ist das Einzige zwischen der Sicherung und dem, der sie findet.',
      },
      'asset-missing': {
        title: 'Ein Teil der App wurde nicht geladen.',
        action: 'Lade die Seite neu. Passiert es weiter, ist die Auslieferung unvollständig.',
      },
    },

    tokenRevoked: {
      title: 'Discogs nimmt den Token nicht mehr an.',
      action:
        'Er wurde vermutlich bei Discogs zurückgezogen. Erzeuge in den Entwickler-Einstellungen einen neuen und trag ihn unter Einstellungen → Konto → Token erneuern ein – deine Daten hier bleiben, wo sie sind.',
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

    updating: 'Deine Daten werden aktualisiert',
    job: {
      outbox: 'deine Änderungen gehen raus',
      library: 'Sammlung und Wantlist',
      watch: 'die Läden, die du beobachtest',
      horizon: 'der Horizont',
    },

    whyLabel: 'Was frischt sich von selbst auf?',
    why: 'Sammlung, Wantlist, die beobachteten Läden und der Horizont – beim Öffnen, beim Zurückkehren in den Tab und alle zwanzig Minuten. Meistens ist das eine einzige Anfrage, weil Discogs nur gefragt wird, was sich geändert hat. Zwei Dinge bleiben absichtlich draußen: ein Dig dauert zwei bis vier Minuten und hundert und mehr Abfragen, den startest also du und keine Uhr; und deine Bestellungen lassen sich gar nicht abrufen – dieser Endpunkt listet nur, was du verkauft hast, ein Kauf wird deshalb über seine Bestellnummer gelesen.',
  },

  news: {
    title: 'Was neu ist',
    whatToDo: 'Was zu tun ist:',
    updatedTo: (version) => `Jetzt auf ${version}`,
    whatChanged: 'Was hat sich geändert?',
    dismiss: 'Später',
    inVersion: (version) => `In Version ${version}`,
    none: 'Zu dieser Ausgabe steht nichts geschrieben.',
    german:
      'Die Notizen bis 0.26.0 sind deutsch – sie stammen aus den Commits dieses Projekts.',
    full: 'Alle Versionen, auf GitHub',
    fullHref: 'https://github.com/misterhonk/fidelity/blob/main/CHANGELOG.md',
  },

  token: {
    title: 'Token eintragen',
    lead: 'Fidelity spricht direkt mit Discogs – ohne Server dazwischen. Dafür braucht es einen persönlichen Token, den du dir selbst erzeugst.',
    sampleTitle: 'Was dabei herauskommt',
    sampleNote:
      'Beispiele. Eine Punktzahl, ein Satz, warum – für jede Platte im Sortiment eines Ladens. Mit deiner Sammlung stehen dort deine Künstler und deine Labels.',
    step1: 'öffnen',
    step2: '„Generate token" klicken',
    step3: 'Den Token hier einfügen',
    field: 'Personal Access Token',
    readsOnly: 'Fidelity liest nur.',
    readsOnlyRest:
      'Sammlung, Wantlist und Ladensortimente – mehr nicht. Es ändert nichts an deinem Discogs-Konto, kauft nichts und schreibt nichts zurück. Gekauft wird bei Discogs, von dir.',
    staysHere:
      'Der Token bleibt auf diesem Gerät gespeichert und wird an niemanden weitergegeben – auch nicht an uns. Es gibt keinen Server, der ihn empfangen könnte.',
    checking: 'Prüfe …',
    signIn: 'Anmelden',

    renewTitle: 'Token erneuern',
    renewLead:
      'Wenn Discogs den Token nicht mehr annimmt, trag hier einen neuen ein. Alles auf diesem Gerät bleibt; nur der Schlüssel wechselt.',
    renew: 'Erneuern',
    renewed: 'Der Token funktioniert. Sonst hat sich nichts geändert.',
  },

  signals: {
    WANTLIST_EXACT: 'Wantlist',
    WANTLIST_PRESSING: 'Anderes Pressing',
    ARTIST_KNOWN: 'Künstler',
    ARTIST_FOLLOWED: 'Auf dem Schirm',
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
    owned: (n) => `${n} Platten`,
    wanted: (n) => `${n} Wünsche`,
    yourShops: 'Deine Läden',
    forSale: (n: string) => `${n} im Angebot`,
    whatIsHere: 'Was hier liegt',
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
      title: 'Jetzt: den ersten Laden scannen',
      body: 'Nimm einen, bei dem du ohnehin kaufst. Zwei bis vier Minuten für zwanzigtausend Listings, und am Ende steht eine Liste mit einem Satz pro Treffer.',
    },
  },

  palette: {
    placeholder: 'Künstler, Laden, Dig …',
    nothing: 'Nichts gefunden. Digs und Läden tauchen hier auf, sobald es welche gibt.',
    goTo: 'Gehe zu',
    dealers: 'Läden',
    digs: 'Digs',
    lastDig: 'Im letzten Dig',
    inStore: 'Im Laden',
    affinity: (rate) => `${rate} Treffer je tausend`,
    digHint: (matches, when) => `${matches} Treffer · ${when}`,
    label: 'Befehle und Suche',
    search: 'Suchen',
  },

  watch: {
    whyLabel: 'Wie gezählt wird',
    why: 'Die Gesamtzahl des Ladens, nicht wie viele Platten neu sind – wer fünf verkauft und fünf einstellt, bewegt sich um null. Ein Dig sagt, was davon für dich dabei ist.',
    sinceLastVisit: 'Seit deinem letzten Besuch',
    moreListings: (n: number, one: boolean) =>
      `${one ? 'Listing' : 'Listings'} mehr im Angebot als beim letzten Mal.`,
    read: 'Gelesen',
    moved: (n: string, one: boolean) =>
      `hat ${n} ${one ? 'Listing' : 'Listings'} mehr im Angebot als beim letzten Mal.`,
  },

  catalogRun: 'Ausgefüllt = im Regal. Umrandet = diese Platte.',
  catalogRunEntry: {
    this: (number) => `${number} – diese Platte`,
    owned: (number) => `${number} – hast du`,
    missing: (number) => `${number} – fehlt dir`,
  },

  credits: {
    title: 'Wer hier mitgewirkt hat',
    look: 'Nachsehen',
    about:
      "Discogs' größter ungenutzter Schatz: wer produziert, gemischt oder gemastert hat. Steht schon im Horizont – die Antwort kommt sofort.",
    hereOnly: (here) => `${here} hier, von denen du noch nichts hast.`,
    youHave: (owned, here) => `Du hast ${owned} — dieser Laden hat ${here} mehr.`,
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
    scan: 'Barcode scannen',
    scanning: 'Wird nachgeschlagen …',
    scanStop: 'Abbrechen',
    scanDenied: 'Die Kamera blieb zu. Tippen geht auch.',
    scanNotHere:
      'Dieser Browser kann keinen Barcode lesen – Safari bringt keinen Leser mit. Tipp die Ziffern; es findet dasselbe.',
    scanOwned: (copies) => `Hast du – ${copies} in der Sammlung.`,
    scanWanted: 'Nicht in der Sammlung. Steht auf deiner Wantlist.',
    scanOwnedAlbum: (copies) =>
      `Das Album hast du – ${copies} in der Sammlung, in einer anderen Pressung.`,
    scanWantedAlbum:
      'Nicht in der Sammlung. Eine andere Pressung dieses Albums steht auf deiner Wantlist.',
    scanNew: 'Weder in der Sammlung noch auf der Wantlist.',
    scanPressings: (n) =>
      `${n} Pressungen teilen sich diesen Barcode – ein Barcode benennt eine Veröffentlichung, keine Pressung.`,
    scanNothing: 'Discogs kennt keine Platte mit diesem Barcode.',
    identify: 'Nachschlagen',
    identifyLabel: 'Barcode oder Auslaufrillen-Nummer',
    identifyPlaceholder: 'Barcode – oder was im Auslauf steht',
    pressing: {
      pick: 'Welche hältst du in der Hand? Tipp sie an, dann wird sie gegen alle Pressungen des Albums gelesen.',
      check: 'Welche Pressung ist das?',
      reading: 'Pressung wird gelesen …',
      noAnswer:
        'Discogs hat nicht geantwortet, die Pressung bleibt ungelesen. Die Liste bleibt.',
      onlyItself: 'Discogs kennt keine andere Pressung davon – nichts zum Vergleichen.',
      among: (total, year) =>
        `Eine von ${total} Pressungen, und eine der ersten: das Album ist von ${year}.`,
      later: (total, year) => `Eine von ${total} Pressungen. Die ersten sind von ${year}:`,
      firstOnes: 'Die ersten Pressungen',
      you: 'deine',
      onDiscogs: 'Bei Discogs',
    },
    finds: (n: number) => `${n} Treffer`,
    wrong: 'Danebengegriffen',
    notInLibrary: 'Weder in deiner Sammlung noch auf der Wantlist',
    norLastDig: '– und der letzte Dig kennt sie auch nicht',
    nothingByName: 'Nichts dabei mit diesem Namen.',
    pressings: (n: number) => `${n} Pressungen`,
    youWant: 'Suchst du',
    youOwn: 'Hast du',
    stands: {
      all: (n) => `Alle ${n} Stände`,
      chip: (name, finds) => `${name} · ${finds}`,
      line: (stands, finds) => `${stands} Stände · ${finds}`,
      lead: 'Die Läden, die du im letzten Tag gescannt hast. Eine Liste pro Stand, oder alle auf einmal – jeder Korb bleibt sein eigenes Paket.',
      interrupted: (dealer, scanned, total) =>
        `${dealer}: ${scanned} von ${total} waren durch – was von diesem Stand hier steht, ist nicht alles.`,
    },
  },

  discovery: {
    search: 'Läden bei Discogs suchen',
    searching: 'Suche …',
    about:
      'In deinen Bestellungen – am 2026-09-11 gemessen ist das die Verkaufsseite: Läden, die bei dir gekauft haben, nicht Läden, bei denen du gekauft hast. Wenn du es in den Einstellungen erlaubst, zusätzlich in deiner Discogs-Freundesliste, und das ist für die meisten die Hälfte, die überhaupt etwas findet. Eine Abfrage je Quelle, dann eine pro Kandidat, um zu sehen wer überhaupt verkauft.',
    added: (n) => (n === 1 ? 'Ein Laden dazu.' : `${n} Läden dazu.`),
    take: (n) => `${n} übernehmen`,
    listings: (n: string) => `${n} Listings`,
    alreadyThere: 'schon dabei',
    hide: 'Nie vorschlagen',
    hideWhy: 'Diesen Laden nie wieder vorschlagen',
    nothing: 'Die Suche hat keine neuen Läden gefunden.',
    whereLabel: 'Wo gesucht wird',
    friendsSummary: 'Auch meine Discogs-Freundesliste lesen?',
    sources: {
      order: 'Aus deinen Bestellungen (Verkaufsseite)',
      friend: 'Freunde, die Platten verkaufen',
    },
    sourceAbout: {
      order: 'Aus deinen Discogs-Bestellungen.',
      friend: 'Aus deiner Freundesliste, und nur die, die wirklich Platten anbieten.',
    },
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
  cancel: 'Abbrechen',
  mainReleases: (n) => `${n} Hauptveröffentlichungen`,

  demo: {
    title: 'Erst ansehen',
    lead: 'Eine Platte aussuchen – Fidelity zeigt, was im selben Laden dazu passt. Ohne Anmeldung.',
    listing: 'Ein Angebot von Discogs',
    look: 'Ansehen',
    orOne: 'Oder eine von diesen:',
    moment: 'Einen Moment …',
    fetching: 'Hole die Platte …',
    reading: (page, pages) => `Lese das Sortiment – Seite ${page} von ${pages}`,
    comparing: 'Vergleiche …',
    progress: 'Fortschritt',
    fitsAt: (dealer) => `Bei ${dealer} passt dazu`,
    score: (score) => `Barry Score ${score} von 100`,
    nothing:
      'In diesem Ausschnitt lag nichts, das dazu passt. Das kommt vor: eine Platte allein ist ein dünner Anhaltspunkt, und gelesen wurde nur ein Teil des Ladens. Mit deiner Sammlung sieht das anders aus.',
    coverage: (scanned, total) =>
      `Gelesen wurden ${scanned} der ${total} Angebote, mit einer Platte als Anhaltspunkt. Ein Dig liest den ganzen Laden und kennt deine Sammlung.`,
    shopLogo: (dealer: string) => `${dealer}, Ladenschild`,
    takesAMinute: 'Dauert eine knappe Minute.',
  },

  nav: {
    label: 'Hauptbereiche',
    start: { label: 'Start', hint: 'Was ist neu, was steht an' },
    dig: { label: 'Graben', hint: 'Einen Laden scannen' },
    basket: { label: 'Korb', hint: 'Was du kaufen willst' },
    shelf: { label: 'Sammlung', hint: 'Was du hast und was du suchst' },
    dealers: { label: 'Läden', hint: 'Bei wem du kaufst' },
    settings: { label: 'Einstellungen', hint: 'Token, Abgleich, Darstellung' },
    inBasket: (count) => `${count} im Korb`,
    attribution: 'Daten von Discogs',
    disclaimer:
      'Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs, wird von Discogs weder unterstützt noch empfohlen. „Discogs" ist eine Marke von Zink Media, LLC.',
    privacy: 'Datenschutz',
    legal: 'Impressum',
    compared: 'Im Vergleich',
  },
}

export default de
