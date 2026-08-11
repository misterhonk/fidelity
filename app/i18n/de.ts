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
    },
    library: {
      lead: 'Was Fidelity von Discogs weiß. Grundlage für alles Weitere.',
      title: 'Sammlung',
      hint: 'Sammlung, Wantlist, Horizont und Credits',
      summary: (records, wants) => `${records} Platten · ${wants} Wünsche`,
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
