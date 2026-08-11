import type { VaultTarget } from '#shared/types'

import { activeLanguage } from '~/composables/useMessages'
import { counted } from '~/utils/plural'

/**
 * The words for the settings, in every language, in the settings chunk.
 *
 * **Why this is not in `en.ts`.** That file is imported by the shell, so
 * everything in it lands in the first paint — and the first paint has a 120 kB
 * budget it was already at 116.9 of. Nobody needs the wording of the vault
 * picker to see the start screen. Splitting by area puts each screen's words in
 * the chunk that screen already loads, which is where they were always going to
 * belong.
 *
 * **Why both languages live here together, unlike `en.ts` and `de.ts`.** For the
 * shell it is worth a separate chunk per language: it is on every screen, so
 * carrying the one nobody reads is pure waste on every visit. For an area it is
 * not. This file is fetched once, when somebody first opens the settings, and
 * doubling two kilobytes there is cheaper than the machinery a second dynamic
 * import per area would need — an await in every page, a second loading path,
 * and a flash to get wrong. The translation also reads better next to its
 * original.
 */

const en = {
  appearance: {
    title: 'Appearance',
    hint: 'Light or dark, and in which type',

    theme: {
      title: 'Theme',
      system: { label: 'System', about: 'Follows the device, including the switch at dusk.' },
      light: { label: 'Light', about: 'For daylight, and for paper lists next to the screen.' },
      dark: { label: 'Dark', about: 'The default. Covers glow on a dark ground.' },
      /** Appended to the "System" description so the word says what it means today. */
      following: (resolved: 'light' | 'dark') =>
        `On this device that is ${resolved === 'dark' ? 'dark' : 'light'} right now.`,
    },

    type: {
      title: 'Type',
      about: 'Three sets. Switch, then walk through one list.',
      // The set names are names. They do not translate.
      presswerk: 'Narrow and technical, like the lettering on a record spine.',
      kontor: 'Rounder and warmer. Headings carry more weight.',
      schweiz: 'No display face — hierarchy from size and weight alone.',
      /**
       * The specimen under the three options: a heading, a line of prose and
       * the numerals, which are what this app mostly sets.
       */
      specimen:
        'You own 5 records by Robag Wruhme — not this one. Style fits (Minimal), and only 3 are for sale.',
    },

    language: {
      title: 'Language',
      about: 'Picked from your device the first time. Change it here and it stays changed.',
      /** The switch is a set of radios, so it needs a name for a screen reader. */
      legend: 'Interface language',
    },
  },

  title: 'Settings',
  lead: 'Everything you set up once and then leave alone.',
  /** The way back, on every subpage. */
  back: 'Settings',

  account: {
    lead: 'There is no account with us — only your token, on this device.',
    title: 'Account',
    hint: 'Your Discogs token, and what is kept on this device',
    discogsAccount: 'Discogs account',
    dataLives: 'Data lives',
    inThisBrowser: 'in this browser, on this device',
    used: 'Used',
    protected: 'protected from being cleared',
    signOut: 'Sign out',
    signOutWarning:
      'Signing out deletes the database with it — token, collection, horizon and digs. There is no copy anywhere else. Export first if you want to keep it.',
  },
  library: {
    lead: 'What Fidelity knows from Discogs. The ground everything else stands on.',
    title: 'Collection',
    hint: 'Collection, wantlist, horizon and credits',
    /**
     * Given already-formatted numbers, not raw ones.
     *
     * The packs deliberately do not reach for `count()`: `money.ts` reads the
     * active locale from the language module, so a pack that formatted its
     * own numbers would close a circle between the two. Formatting is the
     * caller's job; wording is this file's.
     */
    summary: (records: string, wants: string) => `${records} records · ${wants} wanted`,

    /** Collection and wantlist: the first thing that has to be there. */
    fetch: {
      title: 'Collection and wantlist',
      collection: 'Collection',
      wantlist: 'Wantlist',
      lastSynced: 'Last synced',
      fetching: 'Fetching …',
      progress: (what: string, stored: number, total: number) =>
        `${what}: ${stored} of ${total}`,
      start: 'Sync collection',
      again: 'Sync again',
    },

    horizon: {
      title: 'Horizon',
      about: 'Your collection, unfolded once. After that no dig costs any extra lookups.',
      /*
       * "Entities" and "release ids" are words from the inside. A collector
       * has artists and labels, and records. The numbers are the same
       * numbers; only the words changed.
       */
      entities: 'Artists and labels',
      ofTotal: (done: number, total: number) => `${done} of ${total}`,
      knownRecords: 'Records known',
      /*
       * Time, not requests. This said "another 240 requests, so about 5
       * minutes" — the number somebody plans around is the second one, and
       * the first is a unit from inside the machine.
       */
      remaining: (minutes: number) =>
        `About ${counted(minutes, 'minute', 'minutes')} to go. It runs in small bites and survives a reload — nothing already done is fetched twice.`,
      stale: (entries: number) =>
        `${counted(entries, 'entry is', 'entries are')} older than 30 days. Those get refreshed bit by bit, a small helping each day.`,
      records: 'records',
      eta: (clock: string) => `about ${clock} left`,
      build: 'Build the horizon',
      refresh: 'Refresh the horizon',
    },

    credits: {
      title: 'Credits',
      about: 'Who made your favourite records — producers, engineers, remixers.',
      lead: 'Who produced, mixed and mastered — read from your favourite records, the four- and five-star ones.',
      whyLabel: 'Why only the favourites',
      why: 'Credits only appear in the per-record lookup. Going through the whole collection would take hours — the rated ones are a fraction of that and say the most about you.',
      noFavourites:
        'No record rated four or five stars yet. Give some ratings on Discogs and I will know where to look.',
      read: (read: string, total: string) => `${read} of ${total} favourites read`,
      worthExpanding: (people: number) =>
        `${people === 1 ? 'person turns' : 'people turn'} up often enough to join the horizon`,
      remaining: (records: number, minutes: number) =>
        `${counted(records, 'record', 'records')} to go — about ${counted(minutes, 'minute', 'minutes')}. It runs in small bites and survives a reload.`,
      people: 'people',
      harvest: 'Read the credits',
      continue: 'Keep reading',
    },
  },
  search: {
    lead: 'Applies to every dig.',
    title: 'Search',
    hint: 'What is looked for, and where the shops come from',
    unrestricted: 'No restrictions',
    upTo: (price: string) => `up to ${price}`,
    originalsOnly: 'originals only',
    countriesBlocked: (blocked: number) =>
      blocked === 1 ? '1 country blocked' : `${blocked} countries blocked`,

    filter: {
      title: 'What is looked for',
      about: 'What never shows up at all, and what only lands further down.',

      /**
       * docs/04 §2 is emphatic that a criterion is either a filter or a
       * dampener, never both — otherwise the dampener is dead code. These two
       * legends are the interface saying which is which, because "is discarded"
       * and "counts for less" are very different promises and somebody setting
       * a maximum price deserves to know which one they just made.
       */
      hard: 'Hard — what never shows up at all',
      soft: 'Soft — what still shows up, but further down',

      formats: 'Formats',
      formatsHint:
        'Nothing selected means everything counts. Discogs writes vinyl as 12", 2xLP or 7" — all of those are read.',

      maxPrice: 'Maximum price',
      noLimit: 'no limit',
      maxPriceHint: 'Anything above is discarded.',

      minRating: 'Seller rating at least',
      minRatingHint: 'Below that, the dig does not start at all.',

      shipsTo: 'Where it ships to',
      shipsToHint:
        'Decides the postage: dealers write their prices by destination ("Germany:", "Europe:", "Non-Europe:"), and only the block that belongs to you is read. In English, the way Discogs writes it.',

      blocked: 'No shipping from these countries',
      blockedPlaceholder: 'e.g. USA, Japan',
      blockedHint: 'Separate with commas. Useful against customs and three weeks of waiting.',

      condition: 'Condition from',
      conditionHint: 'Anything worse counts for 40 %, but does not disappear.',

      targetPrice: 'Comfortable price',
      targetPriceAny: 'no preference',
      targetPriceHint:
        'Above that a find counts for 55 % — and that is also the ceiling up to which the basket makes suggestions.',

      preferOriginals: 'Prefer original pressings',
      preferOriginalsHint: 'Reissues then count for less.',
      preferOriginalsWhyLabel: 'Dampened rather than discarded',
      preferOriginalsWhy:
        'Whether a record is a reissue is something Discogs only says in the per-record lookup — and that runs after the scan, over the best fifty. So discarding could not discard anything.',

      saved: 'Saved. Applies from the next dig.',
    },

    dealers: {
      title: 'Where the shops come from',
      about: 'Which sources the import may read.',
      ordersAlways: 'Orders are always read — those are the shops you have bought from.',
      friends: 'Read the Discogs friends list as well',
      friendsOff: 'Off until you switch it on.',
      whyLabel: 'Why this one is an exception',
      why: 'Otherwise this app uses only officially documented Discogs interfaces.',
      whyAfter:
        'is not one — it works, but appears in no documentation and can disappear without notice. If it does, the import loses one source and nothing else. Hence: off until you agree.',
    },
  },
  sync: {
    lead: 'Encrypted, so where it is kept does not matter.',
    title: 'Sync devices',
    hint: 'An encrypted vault for phone and desktop',
    /**
     * `satisfies`, so a new vault target cannot be added without a name for
     * it. The settings index used to hold this table and a local
     * `Record<VaultTarget, string>` annotation; moving the words here would
     * otherwise have quietly dropped that check.
     */
    targets: {
      none: 'Off',
      hub: 'Your hub',
      file: 'A file in a sync folder',
      dropbox: 'Dropbox',
      drive: 'Google Drive',
    } satisfies Record<VaultTarget, string>,
  },
  hub: {
    lead: 'A small service on a machine you run yourself. It remembers what Fidelity has already worked out, so the next time is immediate.',
    title: 'Hub',
    hint: 'An optional helper on your own network',
    notSetUp: 'Not set up',
    // A hub address that will not parse is worth showing as such rather than
    // hiding behind "not set up" — the setting is set, it is wrong.
    unreadable: 'Address unreadable',
  },
  data: {
    lead: 'Take it with you, or be rid of it. Both complete, both without a detour through a server.',
    title: 'Your data',
    hint: 'Export it, or delete all of it',
  },
  help: {
    lead: 'How Fidelity works, what the scores mean, and where your data lives.',
    title: 'Help',
    hint: 'How this works, and what the scores mean',
  },
}

/** Same shape, enforced. A missing key here is a build error, as everywhere. */
const de: typeof en = {
  appearance: {
    title: 'Darstellung',
    hint: 'Hell oder dunkel, und in welcher Schrift',

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
}

export const packs = { en, de }

/**
 * The settings wording, as a computed.
 *
 * Never `packs[activeLanguage()]` read into a plain constant — that captures
 * whichever language was active at mount. `tests/unit/messages-usage.spec.ts`
 * has the long version of why.
 */
export function useSettingsMessages() {
  return computed(() => packs[activeLanguage()])
}
