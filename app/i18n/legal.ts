import { activeLanguage } from '~/composables/useMessages'

/**
 * The two pages nobody reads until they need them.
 *
 * Its own file — they are reached from the footer, not from any flow, and
 * carrying their text in the first paint would be paying for a page most people
 * never open.
 *
 * The German is the original here for a reason worth stating: `§ 5 DDG` is a
 * German statute, and the German text is the one that has to satisfy it. The
 * English is a translation for readers, not a second legal notice.
 */

const en = {
  back: '← Start',

  privacy: {
    title: 'Privacy',
    description: 'What Fidelity stores — and where. Short, because it is short.',
    lead: 'Fidelity has no server of its own. Everything it knows sits in your browser’s database; what leaves this device leaves it to Discogs — and to two other places, each of them only if you switch it on.',

    onDevice: 'What is on your device',
    items: [
      'Your Discogs personal access token',
      'Your collection and wantlist, as Discogs hands them over',
      'The horizon: release ids and edges, no titles and no images',
      'The last five digs with their finds',
      'Basket, ratings and postage tiers you have entered',
    ],

    connections: 'Where connections go',
    connectionsBody:
      'In ordinary running, only to api.discogs.com and to i.discogs.com for the covers. Your token goes to Discogs and to nobody else. No analytics, no fonts from foreign servers, no error reports. The two sections below are the exceptions, and both stay shut until you open them.',

    /*
     * Die eine Ausnahme, und sie bekommt eine eigene Überschrift.
     *
     * Sie im Absatz darüber unterzubringen hiesse, sie zu verstecken — und
     * ADR-012 erlaubt sie nur unter der Bedingung, dass das Versprechen
     * **geändert** wird und nicht still gedehnt.
     */
    audio: 'The first exception: the audio preview',
    audioBody:
      'Discogs has one source of sound: YouTube. If you switch the audio preview on in the settings and then tap Listen, a player is loaded from Google. From that moment Google sees this device’s address and which record is playing. Your collection, wantlist and token stay here — none of that is sent. The switch is off to begin with, and with it off nothing is loaded from Google at all.',

    /*
     * The second exception, and it gets a heading for the same reason the
     * first one does.
     *
     * The hub is optional and nobody has one by default — which is exactly the
     * argument for burying it in the paragraph above, and exactly why that
     * would be wrong. Somebody who runs one is sending data somewhere, and a
     * privacy notice that names YouTube but not the address the user typed in
     * themselves is picking the easy disclosure over the honest one.
     */
    hub: 'The second exception: a hub of your own',
    hubBody:
      'Fidelity can make use of a small helper server — the hub. There is none until you enter its address in the settings yourself; with that field empty nothing is ever asked of it. If you do run one: your backup and any find list you share go there sealed, so the hub holds them and cannot read them. What it does see in plain sight is the dealers you are watching, the push address your browser hands out for notifications, the release ids it is asked for covers of, and the dealer and country a postage table belongs to. Your Discogs token is never among it.',

    hosting: 'Where this page comes from',
    hostingBody:
      'The app is a handful of static files on a web host. Like every web server it logs the requests it answers — address, time, which file. That happens before anything of this app runs, and nothing from your collection, your wantlist or your token is in those logs.',

    marketplace: 'Marketplace data',
    marketplaceBody:
      'Prices and conditions are deleted six hours after a dig — that is what the Discogs terms of use require. What stays are the scores and the reasons, which were worked out on this device.',

    deleting: 'Deleting',
    deletingBody:
      '"Delete everything" on the start page removes the database completely, token included. There is no copy anywhere else that would be left over afterwards.',

    responsible: 'Responsible',
    seeLegal: 'See the legal notice',
    legalNotice: 'Legal notice',
  },

  legal: {
    title: 'Legal notice',
    description: 'Provider identification.',
    perStatute: 'Information under § 5 DDG.',
    /*
     * Why no postal address is here.
     *
     * Fidelity is a private project with no intent to profit: it sells nothing,
     * brokers nothing and handles no payments. The author is reachable through
     * GitHub — which is where every question about this project ends up anyway.
     */
    about:
      'Fidelity is a private tool with no intent to profit. It sells nothing, brokers nothing and handles no payments. Contact and bug reports go through the project on GitHub.',
  },
}

const de: typeof en = {
  back: '← Start',

  privacy: {
    title: 'Datenschutz',
    description: 'Was Fidelity speichert – und wo. Kurz, weil es kurz ist.',
    lead: 'Fidelity hat keinen eigenen Server. Alles, was die App weiß, liegt in der Datenbank deines Browsers; was dieses Gerät verlässt, geht an Discogs – und an zwei weitere Stellen, jede nur dann, wenn du sie einschaltest.',

    onDevice: 'Was auf deinem Gerät liegt',
    items: [
      'Dein Discogs Personal Access Token',
      'Deine Sammlung und Wantlist, so wie Discogs sie herausgibt',
      'Der Horizont: Release-IDs und Kanten, keine Titel und keine Bilder',
      'Die letzten fünf Digs mit ihren Treffern',
      'Korb, Bewertungen und Versandstaffeln, die du eingetragen hast',
    ],

    connections: 'Wohin Verbindungen gehen',
    connectionsBody:
      'Im normalen Betrieb ausschließlich zu api.discogs.com und zu i.discogs.com für die Cover. Dein Token geht dabei an Discogs, an sonst niemanden. Kein Analytics, keine Fonts von fremden Servern, keine Fehler-Berichte. Die beiden Abschnitte darunter sind die Ausnahmen, und beide bleiben zu, bis du sie aufmachst.',

    audio: 'Die erste Ausnahme: die Hörprobe',
    audioBody:
      'Discogs hat genau eine Tonquelle: YouTube. Wer die Hörprobe in den Einstellungen einschaltet und dann auf „Anhören" tippt, lädt einen Spieler von Google. Ab diesem Moment sieht Google die Adresse dieses Geräts und welche Platte läuft. Sammlung, Wantlist und Token bleiben hier – davon wird nichts gesendet. Der Schalter ist zu Anfang aus, und solange er aus ist, wird gar nichts von Google geladen.',

    hub: 'Die zweite Ausnahme: ein eigener Hub',
    hubBody:
      'Fidelity kann einen kleinen Hilfsserver nutzen – den Hub. Es gibt keinen, solange du seine Adresse nicht selbst in den Einstellungen einträgst; bleibt das Feld leer, wird nie etwas bei ihm angefragt. Wer einen betreibt: Sicherung und geteilte Fundliste gehen versiegelt dorthin, der Hub hält sie und kann sie nicht lesen. Im Klartext sieht er die Händler, die du beobachtest, die Push-Adresse, die dein Browser für Benachrichtigungen herausgibt, die Release-IDs, zu denen er Cover liefern soll, und Händler und Land, zu dem eine Versandstaffel gehört. Dein Discogs-Token ist nie dabei.',

    hosting: 'Woher diese Seite kommt',
    hostingBody:
      'Die App ist eine Handvoll statischer Dateien auf einem Webhost. Wie jeder Webserver protokolliert er die Anfragen, die er beantwortet – Adresse, Zeitpunkt, welche Datei. Das geschieht, bevor irgendetwas von dieser App läuft, und in diesen Protokollen steht nichts aus deiner Sammlung, deiner Wantlist oder deinem Token.',

    marketplace: 'Marktplatzdaten',
    marketplaceBody:
      'Preise und Zustände werden sechs Stunden nach einem Dig gelöscht – so schreiben es die Nutzungsbedingungen von Discogs vor. Was bleibt, sind Scores und Begründungen, die auf diesem Gerät entstanden sind.',

    deleting: 'Löschen',
    deletingBody:
      '„Alles löschen" auf der Startseite entfernt die Datenbank vollständig, Token eingeschlossen. Es gibt keine Kopie irgendwo anders, die danach noch übrig wäre.',

    responsible: 'Verantwortlich',
    seeLegal: 'Siehe',
    legalNotice: 'Impressum',
  },

  legal: {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung.',
    perStatute: 'Angaben gemäß § 5 DDG.',
    about:
      'Fidelity ist ein privates Werkzeug ohne Gewinnerzielungsabsicht. Es verkauft nichts, vermittelt nichts und wickelt keine Zahlungen ab. Kontakt und Fehlermeldungen laufen über das Projekt auf GitHub.',
  },
}

export const packs = { en, de }

export function useLegalMessages() {
  return computed(() => packs[activeLanguage()])
}
