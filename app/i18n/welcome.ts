import { activeLanguage } from '~/composables/useMessages'

/**
 * The first screen, in the voice of the person behind the counter (docs/20).
 *
 * Setting up is the moment somebody hands us the keys to their shelf. So the
 * words say what we do with them and what stays where: we read, we change
 * nothing, and all of it lives on this device.
 */
const en = {
  title: 'Welcome',
  description: 'Set Fidelity up: your key, your shelf, your artists, your credits.',
  lead: 'Give us a shop. We hand you the records that fit, and say why for each one.',
  setUp: 'Set it up with your collection',
  setUpAbout:
    'A key from Discogs, one fetch of your collection and wantlist, and you can start. We only read. Nothing on your account changes, and everything stays on this device.',
  signedInAs: (username: string) => `Signed in as ${username}`,
  syncAbout:
    'Now we fetch your collection and your wantlist. That is how we get to know what you like. A few seconds per thousand records, then all of it is on this device.',
  asking: 'Asking Discogs …',
  syncing: (what: string, stored: string, total: string) => `${what}: ${stored} of ${total}`,
  fetchCollection: 'Fetch the collection',
  horizon: {
    title: 'What else your artists made',
    about:
      'We look up once what your artists and labels have put out, not only what of it is on your shelf. That is how we later spot another pressing of a record you own, a gap in a catalogue run, or an album you did not know about.',
    skip: 'Carry on',
    resumable:
      'It runs in small bites and survives a reload. Move on whenever you like and finish it later in the settings.',
  },
  credits: {
    title: 'Who is behind your records',
    about:
      'From your favourite records, four or five stars at Discogs, we read who made them: producers, remixers, studio people. When the same name keeps turning up, we can later find records that name is not on the front of.',
    skip: 'Carry on',
    later: 'You can skip this too and catch up later in the settings.',
  },
  done: {
    title: 'Done.',
    summary: (records: string, wants: string) =>
      `${records} records and ${wants} wishes are on this device now. Three things you can do with that:`,
    toStart: 'To the start page',
  },
  canDo: {
    dig: {
      title: 'Dig through a shop',
      body: 'Give us a shop name. We go through everything they have and pull out what fits you, with a sentence for every find.',
      cta: 'To the dig',
    },
    inStore: {
      title: 'Check in the shop',
      body: 'Record in hand, "do I have this one already?" Answered from your pocket, no signal needed. Record shops are basements.',
      cta: 'In the shop',
    },
    collection: {
      title: 'Look at your collection',
      body: 'Shelf, map and wantlist. The map shows where your collection runs deep and where the gaps are.',
      cta: 'To the collection',
    },
  },
  alreadySetUp: 'Already set up?',
  startPage: 'To the start page',
  setupProgress: 'Setup',
  steps: {
    token: 'Key',
    sync: 'Collection',
    horizont: 'Artists',
    credits: 'Credits',
    fertig: 'Done',
  },
}

const de: typeof en = {
  title: 'Willkommen',
  description:
    'Fidelity einrichten: dein Schlüssel, dein Regal, deine Künstler, deine Credits.',
  lead: 'Gib uns einen Laden. Wir legen dir die Platten hin, die passen, und sagen zu jeder, warum.',
  setUp: 'Mit deiner Sammlung einrichten',
  setUpAbout:
    'Ein Schlüssel von Discogs, einmal Sammlung und Wantlist holen, dann kann es losgehen. Wir lesen nur. An deinem Konto ändert sich nichts, und alles bleibt auf diesem Gerät.',
  signedInAs: (username) => `Angemeldet als ${username}`,
  syncAbout:
    'Jetzt holen wir deine Sammlung und deine Wantlist. So lernen wir, was du magst. Ein paar Sekunden pro tausend Platten, dann liegt alles auf diesem Gerät.',
  asking: 'Fragen bei Discogs nach …',
  syncing: (what, stored, total) => `${what}: ${stored} von ${total}`,
  fetchCollection: 'Sammlung holen',
  horizon: {
    title: 'Was deine Künstler sonst noch gemacht haben',
    about:
      'Wir schauen einmal nach, was deine Künstler und Labels alles rausgebracht haben, nicht nur, was davon bei dir steht. So erkennen wir später eine andere Pressung von einer Platte, die du hast, eine Lücke in einer Katalogreihe oder ein Album, das du noch gar nicht kanntest.',
    skip: 'Weiter',
    resumable:
      'Läuft in kleinen Happen und übersteht ein Neuladen. Geh weiter, wann du willst, und mach es später in den Einstellungen fertig.',
  },
  credits: {
    title: 'Wer hinter deinen Platten steckt',
    about:
      'Aus deinen Lieblingsplatten, vier oder fünf Sterne bei Discogs, lesen wir raus, wer sie gemacht hat: Produzenten, Remixer, Studioleute. Taucht ein Name öfter auf, finden wir später auch Platten, auf denen er nicht vorne draufsteht.',
    skip: 'Weiter',
    later: 'Auch das kannst du überspringen und später in den Einstellungen nachholen.',
  },
  done: {
    title: 'Fertig.',
    summary: (records, wants) =>
      `${records} Platten und ${wants} Wünsche liegen jetzt auf diesem Gerät. Drei Dinge kannst du damit machen:`,
    toStart: 'Zur Startseite',
  },
  canDo: {
    dig: {
      title: 'Einen Laden durchgraben',
      body: 'Gib uns einen Ladennamen. Wir gehen alles durch, was er hat, und holen raus, was zu dir passt, mit einem Satz zu jedem Fund.',
      cta: 'Zum Graben',
    },
    inStore: {
      title: 'Im Laden nachschauen',
      body: 'Platte in der Hand, „hab ich die schon?" Die Antwort kommt aus deiner Tasche, ganz ohne Empfang. Plattenläden sind Keller.',
      cta: 'Im Laden',
    },
    collection: {
      title: 'Deine Sammlung ansehen',
      body: 'Regal, Landkarte und Wantlist. Die Landkarte zeigt, wo deine Sammlung tief geht und wo die Lücken sind.',
      cta: 'Zur Sammlung',
    },
  },
  alreadySetUp: 'Schon eingerichtet?',
  startPage: 'Zur Startseite',
  setupProgress: 'Einrichtung',
  steps: {
    token: 'Schlüssel',
    sync: 'Sammlung',
    horizont: 'Künstler',
    credits: 'Credits',
    fertig: 'Fertig',
  },
}

export const packs = { en, de }

export function useWelcomeMessages() {
  return computed(() => packs[activeLanguage()])
}
