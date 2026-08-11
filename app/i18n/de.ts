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

  settings: {
    title: 'Einstellungen',
    lead: 'Alles, was man einmal einrichtet und danach in Ruhe lässt.',
    back: 'Einstellungen',

    account: {
      lead: 'Es gibt kein Konto bei uns – nur deinen Token auf diesem Gerät.',
      title: 'Konto',
      hint: 'Dein Discogs-Token und was auf diesem Gerät liegt',
      discogsAccount: 'Discogs-Konto',
      dataLives: 'Daten liegen',
      inThisBrowser: 'in diesem Browser, auf diesem Gerät',
      used: 'Belegt',
      protected: 'vor Aufräumen geschützt',
      signOut: 'Abmelden',
      signOutWarning:
        'Abmelden löscht die Datenbank mit — Token, Sammlung, Horizont und Digs. Es gibt keine Kopie woanders. Vorher exportieren, wenn du sie behalten willst.',
    },
    library: {
      lead: 'Was Fidelity von Discogs weiß. Grundlage für alles Weitere.',
      title: 'Sammlung',
      hint: 'Sammlung, Wantlist, Horizont und Credits',
      summary: (records, wants) => `${records} Platten · ${wants} Wünsche`,

      fetch: {
        title: 'Sammlung und Wantlist',
        collection: 'Sammlung',
        wantlist: 'Wantlist',
        lastSynced: 'Zuletzt synchronisiert',
        fetching: 'Wird geholt …',
        progress: (what, stored, total) => `${what}: ${stored} von ${total}`,
        start: 'Sammlung synchronisieren',
        again: 'Neu synchronisieren',
      },

      horizon: {
        title: 'Horizont',
        about:
          'Deine Sammlung einmal ausgeklappt. Danach kostet jeder Dig keine zusätzlichen Abfragen.',
        entities: 'Künstler und Labels',
        ofTotal: (done, total) => `${done} von ${total}`,
        knownRecords: 'Bekannte Platten',
        remaining: (minutes) =>
          `Dauert noch rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in Häppchen und übersteht ein Neuladen – was schon fertig ist, wird nicht noch einmal geholt.`,
        stale: (entries) =>
          `${counted(entries, 'Eintrag ist', 'Einträge sind')} älter als 30 Tage. Die werden nach und nach aufgefrischt, ein kleines Kontingent pro Tag.`,
        records: 'Platten',
        eta: (clock) => `noch ca. ${clock}`,
        build: 'Horizont bauen',
        refresh: 'Horizont auffrischen',
      },

      credits: {
        title: 'Credits',
        about: 'Wer deine Lieblingsplatten gemacht hat – Produzenten, Engineers, Remixer.',
        lead: 'Wer produziert, gemischt und gemastert hat – gelesen aus deinen Lieblingsplatten, vier und fünf Sterne.',
        whyLabel: 'Warum nur die Lieblingsplatten',
        why: 'Credits stehen nur in der Einzelabfrage pro Platte. Die ganze Sammlung durchzugehen wäre stundenlang – die bewerteten sind ein Bruchteil davon und sagen am meisten über dich.',
        noFavourites:
          'Noch keine Platte mit vier oder fünf Sternen bewertet. Vergib die bei Discogs, dann weiß ich, wo ich nachsehen soll.',
        read: (read, total) => `${read} von ${total} Lieblingsplatten gelesen`,
        worthExpanding: (people) =>
          `${people === 1 ? 'Person taucht' : 'Personen tauchen'} oft genug auf, um in den Horizont zu wandern`,
        remaining: (records, minutes) =>
          `Noch ${counted(records, 'Platte', 'Platten')} – rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in Häppchen und übersteht ein Neuladen.`,
        people: 'Personen',
        harvest: 'Credits lesen',
        continue: 'Weiterlesen',
      },
    },
    search: {
      lead: 'Gilt für jeden Dig.',
      title: 'Suche',
      hint: 'Wonach gesucht wird und woher die Läden kommen',
      unrestricted: 'Ohne Einschränkung',
      upTo: (price) => `bis ${price}`,
      originalsOnly: 'nur Originale',
      countriesBlocked: (blocked) =>
        blocked === 1 ? '1 Land gesperrt' : `${blocked} Länder gesperrt`,

      filter: {
        title: 'Wonach gesucht wird',
        about: 'Was gar nicht erst auftaucht, und was nur weiter unten landet.',

        hard: 'Hart — was gar nicht erst auftaucht',
        soft: 'Weich — was noch auftaucht, aber weiter unten',

        formats: 'Formate',
        formatsHint:
          'Nichts ausgewählt heißt: alles zählt. Discogs schreibt Vinyl als 12", 2xLP oder 7" – das wird mitgelesen.',

        maxPrice: 'Höchstpreis',
        noLimit: 'kein Limit',
        maxPriceHint: 'Darüber wird verworfen.',

        minRating: 'Händlerbewertung mindestens',
        minRatingHint: 'Darunter wird der Dig gar nicht erst gestartet.',

        shipsTo: 'Wohin geliefert wird',
        shipsToHint:
          'Entscheidet den Versand: Händler schreiben ihre Preise nach Zielland gestaffelt („Germany:", „Europe:", „Non-Europe:"), und gelesen wird nur der Block, der zu dir gehört. Auf Englisch, wie Discogs es schreibt — „Deutschland" versteht Fidelity auch.',

        blocked: 'Versand aus diesen Ländern nicht',
        blockedPlaceholder: 'z. B. USA, Japan',
        blockedHint: 'Mit Komma trennen. Nützlich gegen Zoll und drei Wochen Wartezeit.',

        condition: 'Zustand ab',
        conditionHint: 'Schlechter zählt nur noch 40 %, verschwindet aber nicht.',

        targetPrice: 'Wohlfühlpreis',
        targetPriceAny: 'egal',
        targetPriceHint:
          'Darüber zählt ein Treffer 55 % – und das ist auch die Grenze, bis zu der der Korb Vorschläge macht.',

        preferOriginals: 'Originalpressungen bevorzugen',
        preferOriginalsHint: 'Neuauflagen zählen dann weniger.',
        preferOriginalsWhyLabel: 'Gedämpft statt verworfen',
        preferOriginalsWhy:
          'Ob eine Platte eine Neuauflage ist, weiß Discogs erst in der Einzelabfrage – und die läuft erst nach dem Scan über die besten 50. Verwerfen könnte sie also nichts.',

        saved: 'Gespeichert. Gilt ab dem nächsten Dig.',
      },

      dealers: {
        title: 'Woher die Läden kommen',
        about: 'Welche Quellen der Import lesen darf.',
        ordersAlways:
          'Bestellungen werden immer gelesen – das sind die Läden, bei denen du gekauft hast.',
        friends: 'Auch die Discogs-Freundesliste lesen',
        friendsOff: 'Aus, solange du es nicht einschaltest.',
        whyLabel: 'Warum das eine Ausnahme ist',
        why: 'Diese App benutzt sonst ausschließlich offiziell dokumentierte Discogs-Schnittstellen.',
        whyAfter:
          'ist keiner – er funktioniert, steht aber in keiner Dokumentation und kann ohne Ankündigung verschwinden. Passiert das, verliert der Import eine Quelle und sonst nichts. Deshalb: aus, bis du zustimmst.',
      },
    },
    appearance: { hint: 'Hell oder dunkel, und in welcher Schrift' },
    sync: {
      lead: 'Verschlüsselt, damit der Speicherort keine Rolle spielt.',
      title: 'Geräte abgleichen',
      hint: 'Verschlüsselter Tresor für Handy und Rechner',
      targets: {
        none: 'Aus',
        hub: 'Dein Hub',
        file: 'Datei im Sync-Ordner',
        dropbox: 'Dropbox',
        drive: 'Google Drive',
      },
    },
    hub: {
      lead: 'Ein kleiner Dienst auf einem Rechner, den du selbst betreibst. Er merkt sich, was Fidelity schon herausgefunden hat – dann geht es beim nächsten Mal sofort.',
      title: 'Hub',
      hint: 'Optionaler Helfer im eigenen Netz',
      notSetUp: 'Nicht eingerichtet',
      unreadable: 'Adresse unlesbar',
    },
    data: {
      lead: 'Mitnehmen oder loswerden. Beides vollständig, beides ohne Umweg über einen Server.',
      title: 'Deine Daten',
      hint: 'Exportieren oder alles löschen',
    },
    help: {
      lead: 'Wie Fidelity arbeitet, was die Punktzahlen bedeuten und wo deine Daten liegen.',
      title: 'Hilfe',
      hint: 'Wie das hier arbeitet und was die Punktzahlen bedeuten',
    },
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

  appearance: {
    title: 'Darstellung',

    theme: {
      title: 'Thema',
      system: {
        label: 'System',
        about: 'Folgt dem Gerät, samt automatischem Wechsel am Abend.',
      },
      light: { label: 'Hell', about: 'Für Tageslicht und für Papierlisten daneben.' },
      dark: { label: 'Dunkel', about: 'Die Voreinstellung. Cover leuchten auf dunklem Grund.' },
      following: (resolved) =>
        `Auf diesem Gerät gerade ${resolved === 'dark' ? 'dunkel' : 'hell'}.`,
    },

    type: {
      title: 'Schrift',
      about: 'Drei Sätze. Umschalten und einmal durch die Listen gehen.',
      presswerk: 'Schmal und technisch, wie die Schrift auf einem Plattenrücken.',
      kontor: 'Runder und wärmer. Überschriften bekommen mehr Gewicht.',
      schweiz: 'Ohne eigene Schrift für Überschriften – Hierarchie nur über Größe und Gewicht.',
      specimen:
        'Du hast 5 Platten von Robag Wruhme – diese nicht. Außerdem: Stil passt (Minimal), nur 3 im Angebot.',
    },

    language: {
      title: 'Sprache',
      about: 'Beim ersten Mal vom Gerät übernommen. Hier geändert, bleibt sie geändert.',
      legend: 'Sprache der Oberfläche',
    },
  },
}

export default de
