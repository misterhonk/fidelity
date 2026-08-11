import { activeLanguage } from '~/composables/useMessages'

/**
 * The words for arriving: the demo, the five setup steps, and the three things
 * you can do once the collection has landed.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Welcome',
  description: 'Set Fidelity up: token, collection, horizon, credits.',
  lead: 'One dealer in, a scored list of finds out — with a reason for every one.',

  setUp: 'Set it up — with your collection',
  setUpAbout:
    'A key from Discogs, one fetch of your collection and wantlist — and then you can start. Fidelity only reads and changes nothing about your account; everything stays on this device.',

  signedInAs: (username: string) => `Signed in as ${username}`,
  syncAbout:
    'Now Fidelity fetches your collection and your wantlist. That is the ground everything else stands on — without it the app does not know what you like. A few seconds per thousand records, and afterwards all of it is on this device.',
  asking: 'Asking Discogs …',
  syncing: (what: string, stored: string, total: string) => `${what}: ${stored} of ${total}`,
  fetchCollection: 'Fetch the collection',

  /**
   * The horizon was deliberately left out of the setup — now it is in.
   *
   * The argument for leaving it out was that it takes minutes and the app works
   * without it. Both are still true. What that argument missed is that half of
   * what makes Fidelity interesting is invisible without it: another pressing
   * of a record you own, a catalogue series with a hole in it, a producer whose
   * name you never see on a sleeve. So it is a step, it says how long it takes
   * before it starts, and it can be walked past in one click.
   */
  horizon: {
    title: 'What else your artists made',
    about:
      'Fidelity looks up once what your artists and labels have released — not only what of it is on your shelf. With that it later recognises other pressings of the same record, gaps in catalogue runs, and albums you do not know yet.',
    skip: 'Carry on',
    resumable:
      'It runs in small bites and survives a reload. You can move on at any time and finish it later in the settings.',
  },

  credits: {
    title: 'Who is behind your records',
    about:
      'From your favourite records — four or five stars at Discogs — Fidelity reads out who made them: producers, remixers, studio people. When the same person turns up often, the app later finds records their name is not on the front of.',
    skip: 'Carry on',
    later: 'You can skip this too and catch up later in the settings.',
  },

  done: {
    title: 'Done.',
    summary: (records: string, wants: string) =>
      `${records} records and ${wants} wishes are on this device now. Three things you can do with that:`,
    toStart: 'To the start page',
  },

  /**
   * What the app does, in three lines, at the moment it can finally do it.
   * Deliberately at the end rather than the start: a feature tour before there
   * is any data is a promise; the same three sentences after the collection has
   * landed are instructions.
   */
  canDo: {
    dig: {
      title: 'Dig through a shop',
      body: 'Enter a dealer name, Fidelity reads their stock and tells you what in it fits you — with a sentence of reasoning for every find.',
      cta: 'To the dig',
    },
    inStore: {
      title: 'Check in the shop',
      body: 'With the record in your hand: "do I have this already?" Answered from the device, with no signal — record shops are basements.',
      cta: 'In the shop',
    },
    collection: {
      title: 'Look at your collection',
      body: 'Shelf, map and wantlist. The map shows where your collection is dense and where the gaps are.',
      cta: 'To the collection',
    },
  },

  alreadySetUp: 'Already set up?',
  startPage: 'To the start page',

  /** The progress list itself needs a name, not just its items. */
  setupProgress: 'Setup',

  /** The names of the five setup steps, as the progress line shows them. */
  steps: {
    token: 'Token',
    sync: 'Collection',
    horizont: 'Horizon',
    credits: 'Credits',
    fertig: 'Done',
  },
}

const de: typeof en = {
  title: 'Willkommen',
  description: 'Fidelity einrichten: Token, Sammlung, Horizont, Credits.',
  lead: 'Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.',

  setUp: 'Einrichten – mit deiner Sammlung',
  setUpAbout:
    'Ein Schlüssel von Discogs, einmal Sammlung und Wantlist holen – danach kann es losgehen. Fidelity liest nur und ändert nichts an deinem Konto; alles bleibt auf diesem Gerät.',

  signedInAs: (username) => `Angemeldet als ${username}`,
  syncAbout:
    'Jetzt holt Fidelity deine Sammlung und deine Wantlist. Das ist die Grundlage für alles Weitere – ohne sie weiß die App nicht, was du magst. Ein paar Sekunden pro tausend Platten, danach liegt alles auf diesem Gerät.',
  asking: 'Frage Discogs …',
  syncing: (what, stored, total) => `${what}: ${stored} von ${total}`,
  fetchCollection: 'Sammlung holen',

  horizon: {
    title: 'Was deine Künstler sonst noch',
    about:
      'Fidelity sieht einmal nach, was deine Künstler und Labels veröffentlicht haben – nicht nur, was davon bei dir steht. Damit erkennt es später andere Pressungen derselben Platte, Lücken in Katalogserien und Alben, die du noch nicht kennst.',
    skip: 'Weiter',
    resumable:
      'Läuft in Häppchen und übersteht ein Neuladen. Du kannst jederzeit weitergehen und es später in den Einstellungen zu Ende bringen.',
  },

  credits: {
    title: 'Wer hinter deinen Platten steckt',
    about:
      'Aus deinen Lieblingsplatten – vier oder fünf Sterne bei Discogs – liest Fidelity heraus, wer sie gemacht hat: Produzenten, Remixer, Studioleute. Wenn dieselbe Person oft auftaucht, findet die App später auch Platten, auf denen sie nicht vorne draufsteht.',
    skip: 'Weiter',
    later: 'Auch das kannst du überspringen und später in den Einstellungen nachholen.',
  },

  done: {
    title: 'Fertig.',
    summary: (records, wants) =>
      `${records} Platten und ${wants} Wünsche liegen jetzt auf diesem Gerät. Drei Dinge kannst du damit tun:`,
    toStart: 'Zur Startseite',
  },

  canDo: {
    dig: {
      title: 'Einen Laden durchgraben',
      body: 'Händlernamen eingeben, Fidelity liest sein Sortiment und sagt dir, was davon zu dir passt – mit einem Satz Begründung pro Treffer.',
      cta: 'Zum Graben',
    },
    inStore: {
      title: 'Im Laden nachschauen',
      body: 'Mit der Platte in der Hand: „Habe ich die schon?" Beantwortet aus dem Gerät, ohne Empfang – Plattenläden sind Keller.',
      cta: 'Im Laden',
    },
    collection: {
      title: 'Deine Sammlung ansehen',
      body: 'Regal, Landkarte und Wantlist. Die Landkarte zeigt, wo deine Sammlung dicht ist und wo Lücken sind.',
      cta: 'Zur Sammlung',
    },
  },

  alreadySetUp: 'Schon eingerichtet?',
  startPage: 'Zur Startseite',

  setupProgress: 'Einrichtung',

  steps: {
    token: 'Token',
    sync: 'Sammlung',
    horizont: 'Horizont',
    credits: 'Credits',
    fertig: 'Fertig',
  },
}

export const packs = { en, de }

export function useWelcomeMessages() {
  return computed(() => packs[activeLanguage()])
}
