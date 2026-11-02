import { activeLanguage } from '~/composables/useMessages'

/**
 * The page that says what this is and what it is not.
 *
 * `docs/15-COMPARED.md` was written because every app in this niche publishes
 * a "best vinyl apps" post and lists the others, and Fidelity appeared in
 * none — there was no page to link to. This is that page, in both languages,
 * in its own chunk: it is reached from the footer and from the welcome screen,
 * and somebody who already has the app never loads it.
 *
 * Facts about the other apps come from their own pages and store texts on the
 * dates named at the bottom; nothing was measured inside them. When one of
 * them changes, the row changes — the sentence about Fidelity does not.
 */

const en = {
  title: 'Sleeveside, compared',
  description:
    'What Sleeveside is and is not, beside Seller Matches, discdogs, WaxTracker, Groovv and the rest.',
  back: '← Start',

  sentence:
    'Sleeveside reads a shop’s stock against your collection and tells you, with a reason, what belongs on your shelf.',
  sentenceAbout:
    'Everything else follows from that: the shop is the unit, the collection comes before the wantlist, and the sentence is the product.',
  notTitle: 'What that is not',
  not: 'A catalogue app, a price tracker, an alert service, a marketplace overlay. Each of those exists, several times, and some of them are good. The list says which is which.',

  sideBySide: 'Side by side',
  theyDo: 'What it does',
  instead: 'Sleeveside instead',
  rows: [
    {
      name: 'Discogs app, Seller Matches',
      since: 'September 2026',
      does: 'Up to five sellers, ranked by how many items from your wantlist they have, and since October a filter on one seller’s stock. Across all sellers — Discogs owns the marketplace — and by the wantlist alone.',
      fidelity:
        'Ranks one shop’s stock against what you own — eleven signals, a score, a sentence — and plans your wants across the shops you scanned, with the postage. Across all sellers it cannot: there is no listings-by-release endpoint, and it says so.',
    },
    {
      name: 'Wantlister, discdogs',
      since: 'Wantlister is Discogs’ own since June 2024',
      does: 'Real-time alerts when a wanted record is listed: price, condition, country, seller filters; mail or Telegram. discdogs is free and adds a browser extension.',
      fidelity:
        'No alerts, on purpose. Discogs owns the listing event; a third party can only poll. What Sleeveside watches is a shop — has its stock moved since you were there — one lookup for everybody through the hub.',
    },
    {
      name: 'WaxTracker and the portfolio apps',
      does: 'Your collection as a portfolio: daily prices, weekly movers, gain against what you paid, from stored marketplace data.',
      fidelity:
        'A value line too — Discogs’ own estimate, once a day, kept on your device, six hours fresh — and nothing per record, nothing stored beyond that. The terms forbid the archive those apps are built on, and the six-hour rule is in the code.',
    },
    {
      name: 'Groovv, Spinstack, On Rotation, Discographic, CLZ, My Vinyl+',
      does: 'Catalogue your records: scan, sync, browse, play log, shelf photos, stats. Beautiful, and solved a dozen times.',
      fidelity:
        'Not a catalogue. Discogs is the catalogue; Sleeveside mirrors it to the device and asks what to buy. The year in review and the CSV export exist because they fall out of the mirror, not because cataloguing is the job.',
    },
    {
      name: 'Discogs Enhancer',
      since: 'browser extension, Premium by subscription',
      does: 'Overlays discogs.com: block sellers, currency conversion, dark mode, “in collection” markers on listings.',
      fidelity:
        'Blocks a shop too, and reads a listing’s price with its postage — but inside its own screens, not on discogs.com. An overlay is a second product with a store review process and no iOS; it is noted, not planned.',
    },
    {
      name: 'Record Scanner, VinylAI, RUNOUT., Deadwax',
      does: 'Photograph the cover, get the release and a value. RUNOUT. and Deadwax read the run-out matrix, free.',
      fidelity:
        'The run-out instead of the cover: the number etched near the label names the pressing, and a full one returns one hit where a barcode returns eight. Then which pressing it is, among all of them. No image leaves the device.',
    },
    {
      name: 'Reccogs',
      since: 'browser extension, August 2026',
      does: 'The same question: one seller’s stock against your collection and wantlist, with a reason chip per match. Not in a store, and untouched since its first day.',
      fidelity:
        'A score that stays comparable over time, producers and catalogue runs from the horizon, postage across the shops you scanned, and a phone in the racks.',
    },
    {
      name: 'Vizcogs',
      does: 'Statistics over your collection, paid.',
      fidelity: 'The map and the year on the shelf, from the open catalogue fields, free.',
    },
  ],

  whyTitle: 'Why it is not “the same API wrapper”',
  whyLead:
    'Most third-party apps do what the Discogs app does with a different skin: sync, browse, scan, alert. They read the same endpoints and show the same rows. Sleeveside reads the same endpoints and computes something the API does not hand out:',
  why: [
    {
      name: 'A horizon.',
      body: 'Your collection, unfolded once into every release it points at — artists’ discographies, labels’ catalogue runs, wanted albums’ pressings, producers’ credits, every name an artist goes by. Cached, shared through a hub if you run one, and the reason a dig costs no lookups.',
    },
    {
      name: 'A score with a reason.',
      body: 'Not “3 of your wants are here” but “Conny Plank at the desk, 1974 — you have 9 of his productions, not this one.” Constants that never move, so scores compare across time and between people.',
    },
    {
      name: 'Honesty as a feature.',
      body: 'Coverage in per cent, request costs before the tap, prices locked after six hours, “only the shops you scanned” written on the plan.',
    },
  ],
  refuses:
    'And what it refuses, because the terms say so and because it is the right shape: no backend that sees a token, no price archive, no scraping, no affiliate links, no fee for the app. The hub and the catalogue are optional and hold nothing personal.',

  whereTitle: 'Where to look',
  where: [
    {
      name: 'The app, self-hostable, and its code',
      href: 'https://github.com/misterhonk/fidelity',
    },
    {
      name: 'Why there is no backend',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/adr/007-client-only-pwa.md',
    },
    {
      name: 'The legal reading',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/09-LEGAL.md',
    },
  ],

  sourcesTitle: 'Sources',
  sourcesLead:
    'The rows above, as of 11 and 12 September 2026: the Discogs App Store and Play texts, and the pages of',
  sources: [
    { name: 'discdogs', href: 'https://discdogs.app/' },
    { name: 'WaxTracker', href: 'https://waxtracker.app/' },
    { name: 'Groovv', href: 'https://www.groovv.app/blog/best-vinyl-collection-apps' },
    { name: 'Spinstack', href: 'https://spinstackios.app/blog/best-vinyl-apps-2026.html' },
    {
      name: 'My Vinyl+',
      href: 'https://myvinyls.app/blog/2026/07/best-vinyl-collection-apps-2026/',
    },
    { name: 'On Rotation', href: 'https://apps.apple.com/us/app/on-rotation/id6756587007' },
  ],
}

const de: typeof en = {
  title: 'Sleeveside im Vergleich',
  description:
    'Was Sleeveside ist und was nicht – neben Seller Matches, discdogs, WaxTracker, Groovv und den anderen.',
  back: '← Start',

  sentence:
    'Sleeveside liest das Sortiment eines Ladens gegen deine Sammlung und sagt dir, mit Begründung, was in dein Regal gehört.',
  sentenceAbout:
    'Alles Weitere folgt daraus: Der Laden ist die Einheit, die Sammlung kommt vor der Wantlist, und der Satz ist das Produkt.',
  notTitle: 'Was das nicht ist',
  not: 'Eine Katalog-App, ein Preis-Tracker, ein Alarmdienst, ein Overlay über den Marktplatz. Jedes davon gibt es, mehrfach, und manche sind gut. Die Liste sagt, was was ist.',

  sideBySide: 'Nebeneinander',
  theyDo: 'Was es tut',
  instead: 'Sleeveside stattdessen',
  rows: [
    {
      name: 'Discogs-App, Seller Matches',
      since: 'September 2026',
      does: 'Bis zu fünf Verkäufer, sortiert danach, wie viel aus deiner Wantlist sie haben, und seit Oktober ein Filter im Bestand eines Verkäufers. Über alle Verkäufer, denn Discogs gehört der Marktplatz. Und nur nach der Wantlist.',
      fidelity:
        'Sortiert das Sortiment eines Ladens gegen das, was du besitzt – elf Signale, ein Score, ein Satz – und plant deine Wünsche über die Läden, die du gescannt hast, mit Porto. Über alle Verkäufer kann es das nicht: Es gibt keinen Endpunkt „Angebote je Release", und das steht dran.',
    },
    {
      name: 'Wantlister, discdogs',
      since: 'Wantlister gehört seit Juni 2024 Discogs',
      does: 'Alarm in Echtzeit, wenn eine gesuchte Platte eingestellt wird: Preis, Zustand, Land, Verkäuferfilter; Mail oder Telegram. discdogs ist gratis und bringt eine Browser-Erweiterung mit.',
      fidelity:
        'Keine Alarme, mit Absicht. Das Einstellen gehört Discogs; ein Dritter kann nur nachfragen. Was Sleeveside beobachtet, ist ein Laden – hat sich sein Bestand bewegt, seit du da warst – eine Abfrage für alle über den Hub.',
    },
    {
      name: 'WaxTracker und die Portfolio-Apps',
      does: 'Deine Sammlung als Portfolio: Tagespreise, Wochengewinner, Gewinn gegen den Kaufpreis, aus gespeicherten Marktplatzdaten.',
      fidelity:
        'Auch eine Wertlinie – Discogs’ eigene Schätzung, einmal am Tag, auf deinem Gerät, sechs Stunden frisch – und nichts je Platte, nichts darüber hinaus gespeichert. Die Bedingungen verbieten das Archiv, auf dem jene Apps stehen, und die Sechs-Stunden-Regel steckt im Code.',
    },
    {
      name: 'Groovv, Spinstack, On Rotation, Discographic, CLZ, My Vinyl+',
      does: 'Deine Platten katalogisieren: scannen, abgleichen, blättern, Hörprotokoll, Regalfotos, Statistik. Schön, und ein Dutzend Mal gelöst.',
      fidelity:
        'Kein Katalog. Discogs ist der Katalog; Sleeveside spiegelt ihn aufs Gerät und fragt, was zu kaufen ist. Der Jahresrückblick und der CSV-Export gibt es, weil sie aus dem Spiegel herausfallen, nicht weil Katalogisieren die Aufgabe wäre.',
    },
    {
      name: 'Discogs Enhancer',
      since: 'Browser-Erweiterung, Premium im Abo',
      does: 'Legt sich über discogs.com: Verkäufer sperren, Währung umrechnen, Dark Mode, „in der Sammlung"-Marken auf Angeboten.',
      fidelity:
        'Sperrt auch einen Laden und liest den Preis eines Angebots mit Porto – aber auf eigenen Bildschirmen, nicht auf discogs.com. Ein Overlay ist ein zweites Produkt mit Store-Prüfung und ohne iOS; notiert, nicht geplant.',
    },
    {
      name: 'Record Scanner, VinylAI, RUNOUT., Deadwax',
      does: 'Cover fotografieren, Release und Wert bekommen. RUNOUT. und Deadwax lesen die Matrix in der Auslaufrille, gratis.',
      fidelity:
        'Die Auslaufrille statt des Covers: Die Nummer, die nahe dem Label eingeritzt ist, benennt die Pressung, und eine vollständige liefert einen Treffer, wo ein Barcode acht liefert. Dann, welche Pressung es ist, unter allen. Kein Bild verlässt das Gerät.',
    },
    {
      name: 'Reccogs',
      since: 'Browser-Erweiterung, August 2026',
      does: 'Dieselbe Frage: der Bestand eines Verkäufers gegen deine Sammlung und Wantlist, mit einem Grund pro Treffer. In keinem Store, und seit dem ersten Tag unverändert.',
      fidelity:
        'Ein Score, der über die Zeit vergleichbar bleibt, Produzenten und Katalogreihen aus dem Horizont, Porto über die Läden, die du gescannt hast, und ein Handy zwischen den Kisten.',
    },
    {
      name: 'Vizcogs',
      does: 'Statistik über deine Sammlung, kostenpflichtig.',
      fidelity: 'Die Landkarte und das Jahr im Regal, aus den offenen Katalogfeldern, gratis.',
    },
  ],

  whyTitle: 'Warum es nicht „derselbe API-Wrapper" ist',
  whyLead:
    'Die meisten Dritt-Apps tun, was die Discogs-App tut, in anderer Hülle: abgleichen, blättern, scannen, alarmieren. Sie lesen dieselben Endpunkte und zeigen dieselben Zeilen. Sleeveside liest dieselben Endpunkte und rechnet etwas aus, das die API nicht herausgibt:',
  why: [
    {
      name: 'Einen Horizont.',
      body: 'Deine Sammlung, einmal entfaltet in jedes Release, auf das sie zeigt – Diskografien der Künstler, Katalogreihen der Labels, Pressungen gesuchter Alben, Credits der Produzenten, jeder Name, den ein Künstler trägt. Gecacht, über einen Hub geteilt, wenn du einen betreibst, und der Grund, warum ein Dig keine Abfragen kostet.',
    },
    {
      name: 'Einen Score mit Begründung.',
      body: 'Nicht „3 deiner Wünsche sind hier", sondern „Conny Plank am Pult, 1974 – du hast 9 seiner Produktionen, diese nicht." Konstanten, die sich nie bewegen, damit Scores über die Zeit und zwischen Menschen vergleichbar bleiben.',
    },
    {
      name: 'Ehrlichkeit als Funktion.',
      body: 'Abdeckung in Prozent, Abfragekosten vor dem Tipp, Preise nach sechs Stunden gesperrt, „nur die Läden, die du gescannt hast" steht auf dem Plan.',
    },
  ],
  refuses:
    'Und was es verweigert, weil die Bedingungen es sagen und weil es die richtige Form ist: kein Backend, das ein Token sieht, kein Preisarchiv, kein Scraping, keine Affiliate-Links, keine Gebühr für die App. Hub und Katalog sind optional und enthalten nichts Persönliches.',

  whereTitle: 'Wo nachsehen',
  where: [
    {
      name: 'Die App, selbst betreibbar, und ihr Code',
      href: 'https://github.com/misterhonk/fidelity',
    },
    {
      name: 'Warum es kein Backend gibt',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/adr/007-client-only-pwa.md',
    },
    {
      name: 'Die rechtliche Lesart',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/09-LEGAL.md',
    },
  ],

  sourcesTitle: 'Quellen',
  sourcesLead:
    'Die Zeilen oben, Stand 11. und 12. September 2026: die Texte der Discogs-App im App Store und bei Play, und die Seiten von',
  sources: [
    { name: 'discdogs', href: 'https://discdogs.app/' },
    { name: 'WaxTracker', href: 'https://waxtracker.app/' },
    { name: 'Groovv', href: 'https://www.groovv.app/blog/best-vinyl-collection-apps' },
    { name: 'Spinstack', href: 'https://spinstackios.app/blog/best-vinyl-apps-2026.html' },
    {
      name: 'My Vinyl+',
      href: 'https://myvinyls.app/blog/2026/07/best-vinyl-collection-apps-2026/',
    },
    { name: 'On Rotation', href: 'https://apps.apple.com/us/app/on-rotation/id6756587007' },
  ],
}

const fr: typeof en = {
  title: 'Sleeveside, en comparaison',
  description:
    'Ce que Sleeveside est et n’est pas, à côté de Seller Matches, discdogs, WaxTracker, Groovv et les autres.',
  back: '← Accueil',

  sentence:
    'Sleeveside lit le stock d’une boutique face à ta collection et te dit, raison à l’appui, ce qui a sa place sur ton étagère.',
  sentenceAbout:
    'Tout le reste en découle : la boutique est l’unité, la collection passe avant la liste d’envies, et la phrase est le produit.',
  notTitle: 'Ce que ce n’est pas',
  not: 'Une appli de catalogue, un suivi de prix, un service d’alertes, une surcouche du marché. Chacun existe, plusieurs fois, et certains sont bons. La liste dit qui fait quoi.',

  sideBySide: 'Côte à côte',
  theyDo: 'Ce que ça fait',
  instead: 'Sleeveside, à la place',
  rows: [
    {
      name: 'Appli Discogs, Seller Matches',
      since: 'septembre 2026',
      does: 'Jusqu’à cinq vendeurs, triés selon la part de ta liste d’envies qu’ils ont, et depuis octobre un filtre dans le stock d’un vendeur. Sur tous les vendeurs, car le marché appartient à Discogs. Et seulement selon la liste d’envies.',
      fidelity:
        'Trie le stock d’une boutique face à ce que tu possèdes, onze signaux, une note, une phrase, et planifie tes envies sur les boutiques que tu as fouillées, port compris. Sur tous les vendeurs, il ne peut pas : il n’existe aucun point d’accès « annonces par sortie », et c’est écrit dessus.',
    },
    {
      name: 'Wantlister, discdogs',
      since: 'Wantlister appartient à Discogs depuis juin 2024',
      does: 'Alerte en temps réel quand un disque recherché est mis en vente : prix, état, pays, filtre vendeur ; mail ou Telegram. discdogs est gratuit et vient avec une extension de navigateur.',
      fidelity:
        'Pas d’alertes, exprès. La mise en vente appartient à Discogs ; un tiers ne peut que demander. Ce que Sleeveside suit, c’est une boutique : son stock a-t-il bougé depuis ta visite. Une requête pour tous, via le hub.',
    },
    {
      name: 'WaxTracker et les applis de portefeuille',
      does: 'Ta collection comme un portefeuille : prix du jour, gagnants de la semaine, gain face au prix d’achat, à partir de données du marché enregistrées.',
      fidelity:
        'Une courbe de valeur aussi, l’estimation de Discogs elle-même, une fois par jour, sur ton appareil, fraîche six heures, et rien par disque, rien gardé au-delà. Les conditions interdisent l’archive sur laquelle reposent ces applis, et la règle des six heures est dans le code.',
    },
    {
      name: 'Groovv, Spinstack, On Rotation, Discographic, CLZ, My Vinyl+',
      does: 'Cataloguer tes disques : lire les codes, rapprocher, feuilleter, journal d’écoute, photos d’étagère, statistiques. Joli, et résolu une douzaine de fois.',
      fidelity:
        'Pas de catalogue. Discogs est le catalogue ; Sleeveside le reflète sur l’appareil et demande quoi acheter. Le bilan de l’année et l’export CSV existent parce qu’ils tombent du reflet, pas parce que cataloguer serait le but.',
    },
    {
      name: 'Discogs Enhancer',
      since: 'Extension de navigateur, Premium sur abonnement',
      does: 'Se pose sur discogs.com : bloquer des vendeurs, convertir les devises, mode sombre, marques « dans la collection » sur les annonces.',
      fidelity:
        'Bloque aussi une boutique et lit le prix d’une annonce port compris, mais sur ses propres écrans, pas sur discogs.com. Une surcouche est un second produit, avec validation en store et sans iOS ; noté, pas prévu.',
    },
    {
      name: 'Record Scanner, VinylAI, RUNOUT., Deadwax',
      does: 'Photographier la pochette, obtenir la sortie et la valeur. RUNOUT. et Deadwax lisent la matrice dans le sillon de sortie, gratuitement.',
      fidelity:
        'Le sillon de sortie plutôt que la pochette : le numéro gravé près du label désigne le pressage, et un numéro complet donne un résultat là où un code-barres en donne huit. Ensuite, quel pressage c’est, parmi tous. Aucune image ne quitte l’appareil.',
    },
    {
      name: 'Reccogs',
      since: 'Extension de navigateur, août 2026',
      does: 'La même question : le stock d’un vendeur face à ta collection et ta liste d’envies, avec une raison par résultat. Dans aucun store, et inchangée depuis le premier jour.',
      fidelity:
        'Une note qui reste comparable dans le temps, producteurs et séries de catalogue tirés de l’horizon, le port sur les boutiques que tu as fouillées, et un téléphone entre les bacs.',
    },
    {
      name: 'Vizcogs',
      does: 'Des statistiques sur ta collection, payantes.',
      fidelity:
        'La carte et l’année sur l’étagère, à partir des champs ouverts du catalogue, gratuitement.',
    },
  ],

  whyTitle: 'Pourquoi ce n’est pas « le même habillage d’API »',
  whyLead:
    'La plupart des applis tierces font ce que fait l’appli Discogs, sous une autre enveloppe : rapprocher, feuilleter, lire les codes, alerter. Elles lisent les mêmes points d’accès et montrent les mêmes lignes. Sleeveside lit les mêmes points d’accès et calcule quelque chose que l’API ne fournit pas :',
  why: [
    {
      name: 'Un horizon.',
      body: 'Ta collection, dépliée une fois en chaque sortie vers laquelle elle pointe : discographies des artistes, séries de catalogue des labels, pressages des albums recherchés, crédits des producteurs, chaque nom que porte un artiste. Mis en cache, partagé via un hub si tu en fais tourner un, et la raison pour laquelle une fouille ne coûte aucune requête.',
    },
    {
      name: 'Une note avec une raison.',
      body: 'Pas « 3 de tes envies sont ici », mais « Conny Plank à la console, 1974 : tu as 9 de ses productions, pas celle-ci. » Des constantes qui ne bougent jamais, pour que les notes restent comparables dans le temps et entre les gens.',
    },
    {
      name: 'L’honnêteté comme fonction.',
      body: 'La couverture en pourcentage, le coût en requêtes avant d’appuyer, les prix bloqués après six heures, « seulement les boutiques que tu as fouillées » écrit sur le plan.',
    },
  ],
  refuses:
    'Et ce qu’il refuse, parce que les conditions le disent et parce que c’est la bonne forme : aucun backend qui voit un token, aucune archive de prix, aucun scraping, aucun lien d’affiliation, aucun prix pour l’appli. Hub et catalogue sont facultatifs et ne contiennent rien de personnel.',

  whereTitle: 'Où regarder',
  where: [
    {
      name: 'L’appli, à héberger soi-même, et son code',
      href: 'https://github.com/misterhonk/fidelity',
    },
    {
      name: 'Pourquoi il n’y a pas de backend',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/adr/007-client-only-pwa.md',
    },
    {
      name: 'La lecture juridique',
      href: 'https://github.com/misterhonk/fidelity/blob/main/docs/09-LEGAL.md',
    },
  ],

  sourcesTitle: 'Sources',
  sourcesLead:
    'Les lignes ci-dessus, état au 11 et 12 septembre 2026 : les textes de l’appli Discogs sur l’App Store et Play, et les pages de',
  sources: [
    { name: 'discdogs', href: 'https://discdogs.app/' },
    { name: 'WaxTracker', href: 'https://waxtracker.app/' },
    { name: 'Groovv', href: 'https://www.groovv.app/blog/best-vinyl-collection-apps' },
    { name: 'Spinstack', href: 'https://spinstackios.app/blog/best-vinyl-apps-2026.html' },
    {
      name: 'My Vinyl+',
      href: 'https://myvinyls.app/blog/2026/07/best-vinyl-collection-apps-2026/',
    },
    { name: 'On Rotation', href: 'https://apps.apple.com/us/app/on-rotation/id6756587007' },
  ],
}

export const packs = { en, de, fr }

export function useComparedMessages() {
  return computed(() => packs[activeLanguage()])
}
