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
    description: 'What Sleeveside stores — and where. Short, because it is short.',
    lead: 'Sleeveside has no server of its own. Everything it knows sits in your browser’s database; what leaves this device leaves it to Discogs — and to a few other places, each of them only if you switch it on.',

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
      'In ordinary running, only to api.discogs.com and to i.discogs.com for the covers. Your token goes to Discogs and to nobody else. No analytics, no fonts from foreign servers, no error reports. The sections below are the exceptions, and every one of them stays shut until you open it.',

    /*
     * The first exception, and it gets a heading of its own.
     *
     * Tucking it into the paragraph above would mean hiding it — and ADR-012
     * allows it only on the condition that the promise is **changed** rather
     * than silently stretched.
     */
    audio: 'The first exception: the audio preview',
    audioBody:
      'Discogs has one source of sound: YouTube. If you switch the audio preview on in the settings and then tap Listen, a player is loaded from Google. From that moment Google sees this device’s address and which record is playing, and once the clip plays YouTube may store and read information on this device, such as cookies. The player is YouTube’s, used through the YouTube API Services: the YouTube Terms of Service (youtube.com/t/terms) apply, and Google’s Privacy Policy (policies.google.com/privacy) says what Google does with the data. Your collection, wantlist and token stay here — none of that is sent. The switch is off to begin with, and with it off nothing is loaded from Google at all. Google LLC is in the United States; the transfer relies on the EU–US Data Privacy Framework. The legal basis is your consent (Art. 6(1)(a) GDPR, and § 25(1) TDDDG for what is stored on the device), given by switching the preview on and tapping play; switching it off in the settings withdraws it for everything after.',

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
      'Sleeveside can make use of a small helper server — the hub. There is none until you enter its address in the settings yourself; with that field empty nothing is ever asked of it. If you do run one: your backup and any find list you share go there sealed, so the hub holds them and cannot read them. What it does see in plain sight is the shops you are watching, the push address your browser hands out for notifications, and the shop and country a set of postage tiers belongs to. Your Discogs token is never among it.',

    /*
     * The third exception. The catalogue is read-only and holds nothing of
     * anybody's — but a lookup still tells its operator what was looked up,
     * and that is a disclosure whether or not the answer is public data.
     */
    catalogue: 'The third exception: a catalogue',
    catalogueBody:
      'A catalogue is a second helper server, built from the public Discogs data, that answers what the horizon would otherwise ask Discogs for. There is none until you enter its address in the settings. If you do: it sees the release, artist, label and master ids it is asked about, and the barcode or run-out you type in the shop. It holds nothing of yours — no collection, no wantlist, no token — and it never learns who is asking.',

    /*
     * The fourth, and the only one that names a person: an access key stands
     * for a payer. Nothing on this device changes, but every hub and catalogue
     * call carries the key, and the notice has to say so.
     */
    access: 'The fourth exception: an access key',
    accessBody:
      'If you enter an access key in the settings, it travels with every call to the hub and the catalogue — that is what lets a hosted hub tell its members’ rows apart. The key stands for a plan, not for a Discogs account: the hub learns which key is asking and when it expires, and nothing about who you are on Discogs. Where the key came from — the receipt, the payment — stays with the service that issued it, which has a privacy notice of its own.',

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
      'Sleeveside is a private tool with no intent to profit. It sells nothing, brokers nothing and handles no payments. Contact and bug reports go through the project on GitHub.',
  },
}

const de: typeof en = {
  back: '← Start',

  privacy: {
    title: 'Datenschutz',
    description: 'Was Sleeveside speichert – und wo. Kurz, weil es kurz ist.',
    lead: 'Sleeveside hat keinen eigenen Server. Alles, was die App weiß, liegt in der Datenbank deines Browsers; was dieses Gerät verlässt, geht an Discogs – und an ein paar weitere Stellen, jede nur dann, wenn du sie einschaltest.',

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
      'Im normalen Betrieb ausschließlich zu api.discogs.com und zu i.discogs.com für die Cover. Dein Token geht dabei an Discogs, an sonst niemanden. Kein Analytics, keine Fonts von fremden Servern, keine Fehler-Berichte. Die Abschnitte darunter sind die Ausnahmen, und jede bleibt zu, bis du sie aufmachst.',

    audio: 'Die erste Ausnahme: die Hörprobe',
    audioBody:
      'Discogs hat genau eine Tonquelle: YouTube. Wer die Hörprobe in den Einstellungen einschaltet und dann auf „Anhören" tippt, lädt einen Spieler von Google. Ab diesem Moment sieht Google die Adresse dieses Geräts und welche Platte läuft, und sobald der Clip läuft, kann YouTube Daten auf diesem Gerät speichern und lesen, etwa Cookies. Der Spieler ist der von YouTube, eingebunden über die YouTube API Services: Es gelten die YouTube-Nutzungsbedingungen (youtube.com/t/terms), und was Google mit den Daten macht, steht in der Datenschutzerklärung von Google (policies.google.com/privacy). Sammlung, Wantlist und Token bleiben hier – davon wird nichts gesendet. Der Schalter ist zu Anfang aus, und solange er aus ist, wird gar nichts von Google geladen. Google LLC sitzt in den USA; die Übermittlung stützt sich auf das EU-US Data Privacy Framework. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, für das Speichern auf dem Gerät § 25 Abs. 1 TDDDG): Du gibst sie, indem du die Hörprobe einschaltest und auf Abspielen tippst. Schaltest du sie in den Einstellungen wieder aus, widerrufst du sie für alles Weitere.',

    hub: 'Die zweite Ausnahme: ein eigener Hub',
    hubBody:
      'Sleeveside kann einen kleinen Hilfsserver nutzen – den Hub. Es gibt keinen, solange du seine Adresse nicht selbst in den Einstellungen einträgst; bleibt das Feld leer, wird nie etwas bei ihm angefragt. Wer einen betreibt: Sicherung und geteilte Fundliste gehen versiegelt dorthin, der Hub hält sie und kann sie nicht lesen. Im Klartext sieht er die Läden, die du beobachtest, die Push-Adresse, die dein Browser für Benachrichtigungen herausgibt, und Laden und Land, zu dem eine Versandstaffel gehört. Dein Discogs-Token ist nie dabei.',

    catalogue: 'Die dritte Ausnahme: ein Katalog',
    catalogueBody:
      'Ein Katalog ist ein zweiter Hilfsserver, gebaut aus den öffentlichen Discogs-Daten, der beantwortet, was der Horizont sonst bei Discogs erfragen würde. Es gibt keinen, solange du seine Adresse nicht in den Einstellungen einträgst. Wenn doch: Er sieht die Release-, Künstler-, Label- und Master-IDs, nach denen er gefragt wird, und den Barcode oder die Auslaufrille, die du im Laden eintippst. Er hält nichts von dir – keine Sammlung, keine Wantlist, kein Token – und erfährt nie, wer fragt.',

    access: 'Die vierte Ausnahme: ein Zugangsschlüssel',
    accessBody:
      'Trägst du in den Einstellungen einen Zugangsschlüssel ein, reist er mit jedem Aufruf an Hub und Katalog – so kann ein gehosteter Hub die Zeilen seiner Mitglieder auseinanderhalten. Der Schlüssel steht für einen Plan, nicht für ein Discogs-Konto: Der Hub erfährt, welcher Schlüssel fragt und wann er abläuft, und nichts darüber, wer du auf Discogs bist. Woher der Schlüssel kam – Beleg, Zahlung – bleibt bei dem Dienst, der ihn ausgestellt hat, und der hat eine eigene Datenschutzerklärung.',

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
      'Sleeveside ist ein privates Werkzeug ohne Gewinnerzielungsabsicht. Es verkauft nichts, vermittelt nichts und wickelt keine Zahlungen ab. Kontakt und Fehlermeldungen laufen über das Projekt auf GitHub.',
  },
}

/*
 * French, like English, is a translation for readers. The German text is the
 * one § 5 DDG asks for.
 */
const fr: typeof en = {
  back: '← Accueil',

  privacy: {
    title: 'Confidentialité',
    description: 'Ce que Sleeveside enregistre, et où. Court, parce que c’est court.',
    lead: 'Sleeveside n’a pas de serveur à lui. Tout ce que l’appli sait est dans la base de données de ton navigateur ; ce qui quitte cet appareil va chez Discogs, et à quelques autres endroits, chacun seulement si tu l’actives.',

    onDevice: 'Ce qui est sur ton appareil',
    items: [
      'Ton Personal Access Token Discogs',
      'Ta collection et ta liste d’envies, telles que Discogs les fournit',
      'L’horizon : des identifiants de sorties et des liens, ni titres ni images',
      'Les cinq dernières fouilles avec leurs trouvailles',
      'Le panier, les notes et les tarifs de port que tu as saisis',
    ],

    connections: 'Où vont les connexions',
    connectionsBody:
      'En temps normal, uniquement vers api.discogs.com et vers i.discogs.com pour les pochettes. Ton token va alors chez Discogs, et chez personne d’autre. Pas d’analytics, pas de polices venues d’autres serveurs, pas de rapports d’erreur. Les sections ci-dessous sont les exceptions, et chacune reste fermée tant que tu ne l’ouvres pas.',

    audio: 'Première exception : l’écoute',
    audioBody:
      'Discogs n’a qu’une seule source sonore : YouTube. Qui active l’écoute dans les réglages puis appuie sur « Écouter » charge un lecteur de Google. À partir de là, Google voit l’adresse de cet appareil et le disque qui joue, et dès que l’extrait démarre, YouTube peut stocker et lire des informations sur cet appareil, comme des cookies. Le lecteur est celui de YouTube, intégré via les YouTube API Services : les conditions d’utilisation de YouTube s’appliquent (youtube.com/t/terms), et ce que Google fait des données figure dans les règles de confidentialité de Google (policies.google.com/privacy). Collection, liste d’envies et token restent ici, rien de tout ça n’est envoyé. L’interrupteur est désactivé au départ, et tant qu’il l’est, rien n’est chargé depuis Google. Google LLC est établie aux États-Unis ; le transfert repose sur l’EU-US Data Privacy Framework. La base légale est ton consentement (Art. 6, par. 1, point a du RGPD, et pour le stockage sur l’appareil le § 25, al. 1 TDDDG) : tu le donnes en activant l’écoute et en appuyant sur lecture. Le désactiver dans les réglages le retire pour la suite.',

    hub: 'Deuxième exception : ton propre hub',
    hubBody:
      'Sleeveside peut utiliser un petit serveur d’appoint : le hub. Il n’y en a aucun tant que tu ne saisis pas toi-même son adresse dans les réglages ; si le champ reste vide, on ne lui demande jamais rien. Pour qui en fait tourner un : la copie de sauvegarde et la liste partagée y vont scellées, le hub les garde sans pouvoir les lire. En clair, il voit les boutiques que tu suis, l’adresse push que ton navigateur fournit pour les notifications, et la boutique et le pays d’un tarif de port. Ton token Discogs n’en fait jamais partie.',

    catalogue: 'Troisième exception : un catalogue',
    catalogueBody:
      'Un catalogue est un second serveur d’appoint, construit à partir des données publiques de Discogs, qui répond à ce que l’horizon demanderait sinon à Discogs. Il n’y en a aucun tant que tu ne saisis pas son adresse dans les réglages. Sinon : il voit les identifiants de sorties, d’artistes, de labels et de masters qu’on lui demande, et le code-barres ou la matrice que tu tapes en boutique. Il ne garde rien de toi, ni collection, ni liste d’envies, ni token, et ne sait jamais qui demande.',

    access: 'Quatrième exception : une clé d’accès',
    accessBody:
      'Si tu saisis une clé d’accès dans les réglages, elle voyage avec chaque appel au hub et au catalogue : c’est ainsi qu’un hub hébergé distingue les lignes de ses membres. La clé correspond à une formule, pas à un compte Discogs : le hub apprend quelle clé demande et quand elle expire, et rien sur qui tu es sur Discogs. D’où vient la clé, justificatif ou paiement, reste chez le service qui l’a délivrée, et celui-ci a ses propres règles de confidentialité.',

    hosting: 'D’où vient cette page',
    hostingBody:
      'L’appli est une poignée de fichiers statiques chez un hébergeur web. Comme tout serveur web, il journalise les requêtes auxquelles il répond : adresse, heure, quel fichier. Ça se passe avant que quoi que ce soit de l’appli ne tourne, et ces journaux ne contiennent rien de ta collection, de ta liste d’envies ou de ton token.',

    marketplace: 'Données du marché',
    marketplaceBody:
      'Les prix et les états sont effacés six heures après une fouille, comme l’exigent les conditions d’utilisation de Discogs. Ce qui reste, ce sont les notes et les raisons calculées sur cet appareil.',

    deleting: 'Effacer',
    deletingBody:
      '« Tout effacer » sur la page d’accueil supprime entièrement la base de données, token compris. Il n’existe aucune copie ailleurs qui resterait après.',

    responsible: 'Responsable',
    seeLegal: 'Voir les',
    legalNotice: 'Mentions légales',
  },

  legal: {
    title: 'Mentions légales',
    description: 'Identification de l’éditeur.',
    perStatute: 'Informations selon le § 5 DDG.',
    about:
      'Sleeveside est un outil privé, sans but lucratif. Il ne vend rien, ne sert d’intermédiaire pour rien et ne traite aucun paiement. Contact et signalements de bugs passent par le projet sur GitHub.',
  },
}

export const packs = { en, de, fr }

export function useLegalMessages() {
  return computed(() => packs[activeLanguage()])
}
