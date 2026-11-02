import { activeLanguage } from '~/composables/useMessages'

/**
 * The first screen, in the voice of the person behind the counter (docs/20).
 *
 * Setting up is the moment somebody hands us the keys to their shelf. So the
 * words say what we do with them and what stays where: we read, we change
 * only what somebody taps (ADR-011), and all of it lives on this device.
 */
const en = {
  title: 'Welcome',
  description: 'Set Sleeveside up: your key, your shelf, your first dig.',
  lead: 'Give us a shop. We hand you the records that fit, and say why for each one.',
  setUp: 'Set it up with your collection',
  setUpAbout:
    'A key from Discogs, one fetch of your collection and wantlist, and you can start. We change something on your account only when you tap it, and everything stays on this device.',
  signedInAs: (username: string) => `Signed in as ${username}`,
  syncAbout:
    'Now we fetch your collection and your wantlist. That is how we get to know what you like. A few seconds per thousand records, then all of it is on this device.',
  asking: 'Asking Discogs …',
  syncing: (what: string, stored: string, total: string) => `${what}: ${stored} of ${total}`,
  fetchCollection: 'Fetch the collection',
  dig: {
    title: 'Your first dig',
    summary: (records: string, wants: string) =>
      `${records} ${records === '1' ? 'record' : 'records'} and ${wants} ${wants === '1' ? 'wish' : 'wishes'} are on this device now. Pick a shop and we go through it for you.`,
    after:
      'Once the dig is through, we look up what else your artists made and who is behind your favourite records. That runs in the background and shares the one line to Discogs, so a dig you start meanwhile runs slower.',
    starters: 'Shops to start with',
    anyShop: 'Pick any shop',
    goBack: 'Back to where you were',
  },
  alreadySetUp: 'Already set up?',
  startPage: 'To the start page',
  setupProgress: 'Setup',
  steps: {
    token: 'Key',
    sync: 'Collection',
    dig: 'First dig',
  },
}

const de: typeof en = {
  title: 'Willkommen',
  description: 'Sleeveside einrichten: dein Schlüssel, dein Regal, dein erster Dig.',
  lead: 'Gib uns einen Laden. Wir legen dir die Platten hin, die passen, und sagen zu jeder, warum.',
  setUp: 'Mit deiner Sammlung einrichten',
  setUpAbout:
    'Ein Schlüssel von Discogs, einmal Sammlung und Wantlist holen, dann kann es losgehen. An deinem Konto ändern wir nur, was du selbst antippst. Und alles bleibt auf diesem Gerät.',
  signedInAs: (username) => `Angemeldet als ${username}`,
  syncAbout:
    'Jetzt holen wir deine Sammlung und deine Wantlist. So lernen wir, was du magst. Ein paar Sekunden pro tausend Platten, dann liegt alles auf diesem Gerät.',
  asking: 'Fragen bei Discogs nach …',
  syncing: (what, stored, total) => `${what}: ${stored} von ${total}`,
  fetchCollection: 'Sammlung holen',
  dig: {
    title: 'Dein erster Dig',
    summary: (records, wants) =>
      `${records} ${records === '1' ? 'Platte' : 'Platten'} und ${wants} ${wants === '1' ? 'Wunsch' : 'Wünsche'} liegen jetzt auf diesem Gerät. Such dir einen Laden aus, wir gehen ihn für dich durch.`,
    after:
      'Ist der Dig durch, schauen wir nach, was deine Künstler sonst noch gemacht haben und wer hinter deinen Lieblingsplatten steckt. Das läuft im Hintergrund über dieselbe Leitung zu Discogs. Ein Dig, den du solange startest, läuft deshalb langsamer.',
    starters: 'Läden für den Anfang',
    anyShop: 'Einen Laden aussuchen',
    goBack: 'Zurück, wo du warst',
  },
  alreadySetUp: 'Schon eingerichtet?',
  startPage: 'Zur Startseite',
  setupProgress: 'Einrichtung',
  steps: {
    token: 'Schlüssel',
    sync: 'Sammlung',
    dig: 'Erster Dig',
  },
}

const fr: typeof en = {
  title: 'Bienvenue',
  description: 'Installer Sleeveside : ta clé, ton étagère, ta première fouille.',
  lead: 'Donne-nous une boutique. On te sort les disques qui collent, et on te dit pourquoi pour chacun.',
  setUp: 'Installer avec ta collection',
  setUpAbout:
    'Une clé de Discogs, on récupère une fois collection et liste d’envies, et c’est parti. Sur ton compte, on ne change que ce que tu touches toi-même. Et tout reste sur cet appareil.',
  signedInAs: (username) => `Connecté en tant que ${username}`,
  syncAbout:
    'Maintenant on récupère ta collection et ta liste d’envies. C’est comme ça qu’on apprend ce que tu aimes. Quelques secondes par millier de disques, et tout est sur cet appareil.',
  asking: 'On demande à Discogs …',
  syncing: (what, stored, total) => `${what} : ${stored} sur ${total}`,
  fetchCollection: 'Récupérer la collection',
  dig: {
    title: 'Ta première fouille',
    summary: (records, wants) =>
      `${records} ${records === '1' || records === '0' ? 'disque' : 'disques'} et ${wants} ${wants === '1' || wants === '0' ? 'envie' : 'envies'} sont maintenant sur cet appareil. Choisis une boutique, on la passe en revue pour toi.`,
    after:
      'Une fois la fouille finie, on regarde ce que tes artistes ont fait d’autre et qui se cache derrière tes disques préférés. Ça tourne en arrière-plan, par la même ligne vers Discogs. Une fouille lancée pendant ce temps va donc plus lentement.',
    starters: 'Des boutiques pour commencer',
    anyShop: 'Choisir une boutique',
    goBack: 'Revenir où tu étais',
  },
  alreadySetUp: 'Déjà installé ?',
  startPage: 'Vers la page d’accueil',
  setupProgress: 'Installation',
  steps: {
    token: 'Clé',
    sync: 'Collection',
    dig: 'Première fouille',
  },
}

export const packs = { en, de, fr }

export function useWelcomeMessages() {
  return computed(() => packs[activeLanguage()])
}
