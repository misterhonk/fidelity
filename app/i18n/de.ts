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
    signIn: { lead: 'Erst anmelden,', link: 'zur Startseite' },
    atDiscogs: (title) => `${title}, bei Discogs ansehen`,
    openRecord: (title) => `${title} öffnen`,
    toTop: 'Zurück nach oben',
    opensAtDiscogs: '(öffnet bei Discogs)',
    nothingYet: 'Noch nichts geholt',
    off: 'Aus',
    never: 'noch nie',
    ofTotal: (done: string | number, total: string | number) => `${done} von ${total}`,
    loading: 'Wird geladen …',
    asking: 'Fragen nach …',
    searching: 'Suchen …',
    save: 'Speichern',
    to: 'bis',
    etaLeft: (clock: string) => `· noch ca. ${clock}`,
  },

  listen: {
    title: 'Reinhören',
    search: (service) => `Bei ${service} suchen`,
    source: 'Läuft über YouTube',
    consent: {
      lead: 'Die Clips gleich hier abspielen?',
      what: 'Den Player holen wir von YouTube. Google sieht dann die Adresse dieses Geräts und welche Platte läuft. Sammlung und Token bleiben hier. Vor dem Tippen laden wir nichts.',
      yes: 'Hier abspielen',
      settings: 'Ausschalten kannst du es wieder unter Einstellungen → Suche.',
    },
    stop: 'Stopp',
    onIt: 'Auf der Platte',
    via: 'YouTube',
    play: (track) => `${track} abspielen`,
    more: 'Weitere Aufnahmen',
  },

  grades: {
    M: 'Versiegelt oder nie abgespielt.',
    NM: 'Sieht neu aus, kaum gespielt. Kein Rauschen, das auffällt.',
    VGP: 'Leichte Gebrauchsspuren. Spielt sauber, vielleicht ein Knacken zwischen den Stücken.',
    VG: 'Sichtbare Spuren. Rauschen, das man in leisen Passagen hört.',
    GP: 'Viel gespielt. Durchgehend Rauschen, läuft aber.',
    G: 'Stark gespielt. Ein Exemplar zum Haben, nicht zum Hören.',
    F: 'Beschädigt. Läuft bestenfalls durch.',
    P: 'Kaputt oder unabspielbar.',
  },

  limit: {
    title: 'Anfragen an Discogs',
    session: 'Diese Sitzung',
    purposes: {
      dig: 'Digs',
      horizon: 'Horizont',
      record: 'Platten',
      watch: 'Beobachter',
      sync: 'Sammlung',
      other: 'Sonstiges',
    },
    spoken: (n, ceiling) =>
      `${n} Anfragen in der letzten Minute, von ${ceiling}, die sich dieses Gerät erlaubt`,
    saved: (n, minutes) =>
      `Katalog und Hub haben uns ${n} Abfragen erspart, rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`} Wartezeit.`,
    ceiling: (n) => `Discogs erlaubt 60 pro Minute je Adresse. Wir fragen ${n}, mit Absicht.`,
    ours: 'Wir zählen, was wir gefragt haben. Discogs’ eigenen Zähler kann ein Browser nicht lesen.',

    noToken: 'Ohne Token: 25 pro Minute statt 50. Ein Dig dauert doppelt so lang.',
    tryCatalogue: (n) => `Ein Katalog hätte ${n} davon beantwortet, ohne Discogs zu fragen.`,
    tryHub: (_n) =>
      'Ein Hub teilt sie zwischen deinen Geräten, und mit allen, die ihn mitbenutzen.',
    costs: 'Was wie lange dauert',
    costRows: [
      ['Ein Dig, 3.000 Angebote', '~ 130', '~ 2½ Min'],
      ['Ein Dig, 20.000 Angebote', '~ 300', '~ 6 Min'],
      ['Deine Künstler und Labels, 30 Stück', '~ 600', '~ 12 Min'],
      ['Sammlung holen, 2.000 Platten', '~ 40', '~ 1 Min'],
      ['Die Runde, je beobachtetem Laden', '~ 20', '~ 25 Sek'],
      ['Eine Platte öffnen', '1', '1,2 Sek'],
    ] as [string, string, string][],
  },

  notice: {
    offline: {
      title: 'Du bist offline.',
      body: 'Dein Regal, die Landkarte und die letzten Digs sind da. Neue Digs, Abgleich und Marktpreise brauchen Netz.',
    },
    install: {
      title: 'Aufs Handy legen',
      got_it: 'Verstanden',
      body_before: 'In Safari unten auf',
      share: 'Teilen',
      body_middle: 'tippen, dann',
      addToHome: 'Zum Home-Bildschirm',
      body_after:
        '. Danach geht es ohne Browserleiste auf und läuft auch im Keller ohne Empfang.',
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
      title: `Wir graben schon bei ${dealer}.`,
      action:
        'Ein Dig auf einmal, mehr lässt Discogs uns nicht. Er läuft im Hintergrund weiter, und dieser Bildschirm zeigt ihn. Den nächsten startest du, wenn er durch ist.',
    }),
    hubHttpError: (status) => ({
      title: `Der Hub antwortete mit HTTP ${status}.`,
      action: 'Das sagt der Hub, nicht Discogs. Sein eigenes Log weiß mehr.',
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
    connectionExpired: 'Die Verbindung ist abgelaufen. Verbind dich neu.',
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
        action: 'Trag deinen Discogs-Token in den Einstellungen ein. Alles hier braucht ihn.',
      },
      'no-listing': {
        title: 'Keine Platte angegeben.',
        action: 'Füge einen Link zu einer Platte in einem Discogs-Laden ein.',
      },
      'dig-gone': {
        title: 'Diesen Dig gibt es nicht mehr.',
        action:
          'Einen Dig behalten wir sechs Stunden, dann sind seine Preise weg. Grab den Laden nochmal.',
      },
      'dig-expired': {
        title: 'Die Preise sind älter als sechs Stunden.',
        action: 'So alte Preise können wir nicht zeigen. Ein neuer Dig dauert eine Minute.',
      },
      'dig-running': {
        title: 'Es läuft schon ein Dig.',
        action: 'Einer auf einmal, mehr lässt Discogs uns nicht. Lass ihn zu Ende laufen.',
      },
      'dig-not-running': {
        title: 'Hier ist nichts fortzusetzen.',
        action: 'Dieser Dig läuft nicht. Starte einen neuen Dig bei dem Laden.',
      },
      'deep-scan-done': {
        title: 'Einen tiefen Dig können wir nicht wieder aufnehmen.',
        action: 'Was er gefunden hat, ist da. Ihn aufzunehmen würde Platten doppelt zählen.',
      },
      'no-anchor': {
        title: 'Es gibt noch nichts zu vergleichen.',
        action: '„Nur das Neue" braucht einen vollständigen Dig dieses Ladens als Anfang.',
      },
      'match-gone': {
        title: 'Diesen Fund gibt es nicht mehr.',
        action: 'Er ist nach sechs Stunden mit seinem Dig gegangen. Grab den Laden nochmal.',
      },
      'no-hub': {
        title: 'Kein Hub eingetragen.',
        action: 'Ein Hub ist freiwillig. Trag in den Einstellungen einen ein, oder lass es.',
      },
      'not-a-hub': {
        title: 'Das ist kein Fidelity-Hub.',
        action: 'Unter der Adresse antwortet etwas, aber kein Hub. Prüfe Adresse und Port.',
      },
      'no-catalogue': {
        title: 'Kein Katalog eingetragen.',
        action:
          'Ein Katalog ist freiwillig. Trag in den Einstellungen einen ein, oder lass es.',
      },
      'not-a-catalogue': {
        title: 'Das ist kein Fidelity-Katalog.',
        action: 'Unter der Adresse antwortet etwas, aber kein Katalog. Prüfe Adresse und Port.',
      },
      'not-a-backup': {
        title: 'Das ist kein Fidelity-Backup.',
        action:
          'Ein Backup ist die Datei, die „Alles exportieren" hier schreibt: fidelity-backup-<Datum>.json.',
      },
      'backup-too-new': {
        title: 'Dieses Backup stammt aus einer neueren Fidelity.',
        action:
          'Erst die App aktualisieren. Eine ältere würde es falsch lesen statt gar nicht.',
      },
      'token-other-account': {
        title: 'Dieser Token gehört zu einem anderen Discogs-Konto.',
        action:
          'Was auf diesem Gerät liegt, gehört dem angemeldeten Konto. Zum Kontowechsel erst abmelden, das löscht die Datenbank, und mit dem neuen Token anmelden.',
      },
      'vault-too-new': {
        title: 'Diese Sicherung stammt aus einem neueren Fidelity.',
        action: 'Aktualisiere zuerst die App. Eine ältere läse sie falsch statt gar nicht.',
      },
      'vault-unusable': {
        title: 'Dieses Sicherungsziel lässt sich nicht benutzen.',
        action: 'Schau in den Einstellungen nach dem Ziel.',
      },
      'passphrase-short': {
        title: 'Die Passphrase ist zu kurz.',
        action:
          'Mindestens acht Zeichen. Sie ist das Einzige zwischen der Sicherung und dem, der sie findet.',
      },
      'asset-missing': {
        title: 'Ein Teil der App ist nicht geladen.',
        action: 'Lade die Seite neu. Passiert es weiter, ist die Auslieferung unvollständig.',
      },
    },

    tokenRevoked: {
      title: 'Discogs nimmt den Token nicht mehr an.',
      action:
        'Vermutlich ist er bei Discogs zurückgezogen. Erzeug in den Entwickler-Einstellungen einen neuen und trag ihn unter Einstellungen → Konto → Token erneuern ein. Deine Daten hier bleiben, wo sie sind.',
    },
    tokenUnknown: {
      title: 'Discogs kennt diesen Token nicht.',
      action:
        'Meistens ist beim Kopieren etwas verrutscht, ein Leerzeichen oder ein fehlendes Zeichen am Ende. Hol ihn dir nochmal aus den Entwickler-Einstellungen und füg ihn ganz ein.',
    },
    rateLimited: {
      title: 'Discogs bittet um eine Pause.',
      action: 'Alles bis hier ist gespeichert. Ein, zwei Minuten, dann graben wir weiter.',
    },
    offline: {
      title: 'Wir kommen nicht an Discogs ran.',
      action:
        'Dein Regal, die Landkarte und die letzten Digs sind da. Neue Digs brauchen Netz.',
    },
    storageFull: {
      title: 'Kein Platz mehr auf diesem Gerät.',
      action:
        'Der Browser gibt uns nicht mehr Speicher. Alte Digs gehen ohnehin nach sechs Stunden; „Alles löschen" auf der Startseite schafft den Rest.',
    },
  },

  why: 'Warum?',

  freshness: {
    looking: 'Schauen nach …',
    nothingNew: 'Nichts Neues.',
    added: (records) => `${counted(records, 'Platte', 'Platten')} dazu`,
    alerts: (shops) => `${counted(shops, 'Laden hat', 'Läden haben')} Neues`,
    asOf: (when) => `Stand von ${when}`,
    refreshAll: 'Alles auffrischen',

    updating: 'Wir frischen deine Daten auf',
    job: {
      outbox: 'deine Änderungen gehen raus',
      library: 'Sammlung und Wantlist',
      watch: 'die Läden, die du beobachtest',
      horizon: 'deine Künstler und Labels',
    },

    whyLabel: 'Was frischt sich von selbst auf?',
    why: 'Deine Sammlung, deine Wantlist, die beobachteten Läden und deine Künstler und Labels: beim Öffnen, beim Zurückkommen in den Tab und alle zwanzig Minuten. Meistens ist das eine einzige Abfrage, weil wir Discogs nur fragen, was sich geändert hat. Zwei Dinge bleiben absichtlich draußen. Ein Dig dauert zwei bis vier Minuten und hundert Abfragen und mehr, den startest also du und keine Uhr. Und deine Bestellungen können wir gar nicht holen; Discogs listet nur, was du verkauft hast, einen Kauf lesen wir deshalb über seine Bestellnummer.',
  },

  news: {
    title: 'Was neu ist',
    whatToDo: 'Was zu tun ist:',
    updatedTo: (version) => `Jetzt auf ${version}`,
    whatChanged: 'Was hat sich geändert?',
    dismiss: 'Später',
    inVersion: (version) => `In Version ${version}`,
    none: 'Zu dieser Ausgabe steht nichts geschrieben.',
    german: 'Die Notizen bis 0.26.0 sind deutsch; sie stammen aus den Commits dieses Projekts.',
    full: 'Alle Versionen, auf GitHub',
    fullHref: 'https://github.com/misterhonk/fidelity/blob/main/CHANGELOG.md',
  },

  token: {
    title: 'Token eintragen',
    lead: 'Wir reden direkt mit Discogs, ohne Server dazwischen. Dafür brauchen wir einen persönlichen Token, den du dir selbst erzeugst.',
    sampleTitle: 'Was dabei herauskommt',
    sampleNote:
      'Beispiele. Eine Punktzahl und ein Satz, warum, für jede Platte in einem Laden. Sobald deine Sammlung drin ist, stehen da deine Künstler und deine Labels.',
    step1: 'öffnen',
    step2: '„Generate token" klicken',
    step3: 'Den Token hier einfügen',
    field: 'Personal Access Token',
    readsOnly: 'Wir lesen nur.',
    readsOnlyRest:
      'Deine Sammlung, deine Wantlist und was die Läden haben, mehr nicht. Wir ändern nichts an deinem Discogs-Konto, kaufen nichts und schreiben nichts zurück. Gekauft wird bei Discogs, von dir.',
    staysHere:
      'Der Token bleibt auf diesem Gerät und geht an niemanden, auch nicht an uns. Es gibt keinen Server, der ihn empfangen könnte.',
    checking: 'Prüfen …',
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
    description: 'Fidelity, der Mensch hinterm Tresen für dein Graben bei Discogs.',
    counts: {
      collection: 'Sammlung',
      wantlist: 'Wantlist',
      marked: 'Gemerkt',
      dealers: 'Läden',
      basket: 'Im Korb',
    },
    lastFound: 'Zuletzt gefunden',
    interrupted: (scanned, total) =>
      `Dieser Dig ist bei ${scanned} von ${total} stehen geblieben.`,
    carryOn: 'Da weitermachen',
    pricesGone:
      'Die Preise sind älter als sechs Stunden, die haben wir rausgenommen. Die Funde und ihre Begründungen bleiben.',
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
      body: 'Ohne sie wissen wir nicht, was du magst. Ein paar Sekunden pro tausend Platten, dann ist sie auf diesem Gerät.',
    },
    horizon: {
      cta: 'Deine Künstler nachschlagen',
      title: 'Dann: deine Künstler und Labels nachschlagen',
      body: (minutes) =>
        `Einmal rund ${counted(minutes, 'Minute', 'Minuten')}. Danach erkennt jeder Dig auch Produzenten, Katalogreihen und andere Pressungen deiner Platten.`,
    },
    dig: {
      cta: 'Dig starten',
      title: 'Jetzt: den ersten Laden durchgraben',
      body: 'Nimm einen, bei dem du sowieso kaufst. Zwei bis vier Minuten für zwanzigtausend Platten, und am Ende hast du eine Liste mit einem Satz zu jedem Fund.',
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
    affinity: (rate) => `${rate} Funde auf tausend`,
    digHint: (matches, when) => `${matches} Funde · ${when}`,
    label: 'Befehle und Suche',
    search: 'Suchen',
  },

  watch: {
    whyLabel: 'Wie gezählt wird',
    why: 'Die Gesamtzahl des Ladens, nicht wie viele Platten neu sind. Wer fünf verkauft und fünf einstellt, bewegt sich um null. Ein Dig sagt, was davon für dich dabei ist.',
    sinceLastVisit: 'Seit deinem letzten Besuch',
    moreListings: (n: number, one: boolean) =>
      `${one ? 'Angebot' : 'Angebote'} mehr als beim letzten Mal.`,
    read: 'Gelesen',
    moved: (n: string, one: boolean) =>
      `hat ${n} ${one ? 'Angebot' : 'Angebote'} mehr als beim letzten Mal.`,
  },

  catalogRun: 'Ausgefüllt = im Regal. Umrandet = diese Platte.',
  catalogRunEntry: {
    this: (number) => `${number}, diese Platte`,
    owned: (number) => `${number}, hast du`,
    missing: (number) => `${number}, fehlt dir`,
  },

  credits: {
    title: 'Wer hier mitgewirkt hat',
    look: 'Nachsehen',
    about:
      "Discogs' größter ungenutzter Schatz: wer produziert, gemischt oder gemastert hat. Das wissen wir schon, die Antwort kommt sofort.",
    hereOnly: (here) => `${here} hier, von denen du noch nichts hast.`,
    youHave: (owned, here) => `Du hast ${owned}. Dieser Laden hat ${here} mehr.`,
    records: (n) => counted(n, 'Platte', 'Platten'),
  },

  inStore: {
    title: 'Im Laden',
    description: 'Deine Funde für die Hand am Plattenfach. Offline, große Ziele.',
    back: 'Zurück',
    offline: 'offline, alles aus dem Gerät',
    interrupted: (scanned, total) =>
      `Dieser Dig ist bei ${scanned} von ${total} stehen geblieben, was hier steht, ist also nicht alles.`,
    noDig:
      'Noch kein Dig, die Fundliste bleibt also leer. Deine Sammlung und deine Wantlist kannst du trotzdem durchsuchen, auch ohne Empfang.',
    expired:
      'Älter als sechs Stunden, Preise und Zustände sind darum weg. Die Funde und ihre Begründungen bleiben.',
    search: 'Künstler oder Titel',
    searchLabel: 'Sammlung, Wantlist und die Fundliste durchsuchen',
    scan: 'Barcode lesen',
    scanning: 'Wird nachgeschlagen …',
    scanStop: 'Abbrechen',
    scanDenied: 'Die Kamera blieb zu. Tippen geht auch.',
    scanNotHere:
      'Dieser Browser kann keinen Barcode lesen; Safari bringt keinen Leser mit. Tipp die Ziffern ein, das findet dasselbe.',
    scanOwned: (copies) => `Hast du, ${copies} in der Sammlung.`,
    scanWanted: 'Nicht in der Sammlung. Steht auf deiner Wantlist.',
    scanOwnedAlbum: (copies) =>
      `Das Album hast du, ${copies} in der Sammlung, in einer anderen Pressung.`,
    scanWantedAlbum:
      'Nicht in der Sammlung. Eine andere Pressung dieses Albums steht auf deiner Wantlist.',
    scanNew: 'Weder in der Sammlung noch auf der Wantlist.',
    scanPressings: (n) =>
      `${n} Pressungen teilen sich diesen Barcode. Ein Barcode benennt eine Veröffentlichung, keine Pressung.`,
    scanNothing: 'Discogs kennt keine Platte mit diesem Barcode.',
    identify: 'Nachschlagen',
    identifyLabel: 'Barcode oder Auslaufrillen-Nummer',
    identifyPlaceholder: 'Barcode, oder was im Auslauf steht',
    pressing: {
      pick: 'Welche hältst du in der Hand? Tipp sie an, dann wird sie gegen alle Pressungen des Albums gelesen.',
      check: 'Welche Pressung ist das?',
      reading: 'Pressung wird gelesen …',
      noAnswer:
        'Discogs hat nicht geantwortet, die Pressung bleibt ungelesen. Die Liste steht.',
      onlyItself: 'Discogs kennt keine andere Pressung davon, also nichts zum Vergleichen.',
      among: (total, year) =>
        `Eine von ${total} Pressungen, und eine der ersten: das Album ist von ${year}.`,
      later: (total, year) => `Eine von ${total} Pressungen. Die ersten sind von ${year}:`,
      firstOnes: 'Die ersten Pressungen',
      you: 'deine',
      onDiscogs: 'Bei Discogs',
    },
    finds: (n: number) => `${n} ${n === 1 ? 'Fund' : 'Funde'}`,
    wrong: 'Danebengegriffen',
    notInLibrary: 'Weder in deiner Sammlung noch auf der Wantlist',
    norLastDig: ', und der letzte Dig kennt sie auch nicht',
    nothingByName: 'Nichts dabei mit diesem Namen.',
    pressings: (n: number) => `${n} Pressungen`,
    youWant: 'Suchst du',
    youOwn: 'Hast du',
    stands: {
      all: (n) => `Alle ${n} Stände`,
      chip: (name, finds) => `${name} · ${finds}`,
      line: (stands, finds) => `${stands} Stände · ${finds}`,
      lead: 'Die Läden, die du im letzten Tag gegraben hast. Eine Liste pro Stand, oder alle auf einmal. Jeder Korb bleibt sein eigenes Paket.',
      interrupted: (dealer, scanned, total) =>
        `${dealer}: bei ${scanned} von ${total} stehen geblieben, was von diesem Stand hier steht, ist also nicht alles.`,
    },
  },

  discovery: {
    search: 'Läden bei Discogs suchen',
    searching: 'Suchen …',
    about:
      'In deinen Bestellungen, wo Discogs uns nur die Verkaufsseite zeigt: Läden, die bei dir gekauft haben, nicht Läden, bei denen du gekauft hast. Wenn du es in den Einstellungen erlaubst, auch in deiner Discogs-Freundesliste, und das ist für die meisten die Hälfte, die überhaupt was findet. Eine Abfrage je Quelle, dann eine pro Kandidat, um zu sehen, wer überhaupt verkauft.',
    added: (n) => (n === 1 ? 'Ein Laden dazu.' : `${n} Läden dazu.`),
    take: (n) => `${n} übernehmen`,
    listings: (n: string) => `${n} Angebote`,
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
    lead: 'Such dir eine Platte aus. Wir zeigen dir, was im selben Laden dazu passt. Ohne Anmeldung.',
    listing: 'Eine Platte aus einem Discogs-Laden',
    look: 'Ansehen',
    orOne: 'Oder eine von diesen:',
    moment: 'Einen Moment …',
    fetching: 'Holen die Platte …',
    reading: (page, pages) => `Lesen das Sortiment, Seite ${page} von ${pages}`,
    comparing: 'Vergleichen …',
    progress: 'Fortschritt',
    fitsAt: (dealer) => `Bei ${dealer} passt dazu`,
    score: (score) => `Barry Score ${score} von 100`,
    nothing:
      'In diesem Ausschnitt lag nichts, das dazu passt. Das kommt vor: Eine Platte allein ist ein dünner Anhaltspunkt, und wir haben nur einen Teil des Ladens gelesen. Mit deiner Sammlung sieht das anders aus.',
    coverage: (scanned, total) =>
      `Wir haben ${scanned} von ${total} Platten gelesen, mit einer Platte als Anhaltspunkt. Ein Dig liest den ganzen Laden und kennt deine Sammlung.`,
    shopLogo: (dealer: string) => `${dealer}, Ladenschild`,
    takesAMinute: 'Dauert eine knappe Minute.',
  },

  nav: {
    label: 'Hauptbereiche',
    start: { label: 'Start', hint: 'Was ist neu, was steht an' },
    dig: { label: 'Graben', hint: 'Einen Laden durchgraben' },
    basket: { label: 'Korb', hint: 'Was du kaufen willst' },
    shelf: { label: 'Sammlung', hint: 'Was du hast und was du suchst' },
    dealers: { label: 'Läden', hint: 'Bei wem du kaufst' },
    settings: { label: 'Einstellungen', hint: 'Token, Abgleich, Aussehen' },
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
