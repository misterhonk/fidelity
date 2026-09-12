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
  title: 'Fidelity, compared',
  description:
    'What Fidelity is and is not, beside Seller Matches, discdogs, WaxTracker, Groovv and the rest.',
  back: '← Start',

  sentence:
    'Fidelity reads a shop’s stock against your collection and tells you, with a reason, what belongs on your shelf.',
  sentenceAbout:
    'Everything else follows from that: the shop is the unit, the collection comes before the wantlist, and the sentence is the product.',
  notTitle: 'What that is not',
  not: 'A catalogue app, a price tracker, an alert service, a marketplace overlay. Each of those exists, several times, and some of them are good. The list says which is which.',

  sideBySide: 'Side by side',
  theyDo: 'What it does',
  instead: 'Fidelity instead',
  rows: [
    {
      name: 'Discogs app, Seller Matches',
      since: 'June 2026',
      does: 'Ranks sellers by how many items from your wantlist they have. Across all sellers — Discogs owns the marketplace.',
      fidelity:
        'Ranks one shop’s stock against what you own — eleven signals, a score, a sentence — and plans your wants across the shops you scanned, with the postage. Across all sellers it cannot: there is no listings-by-release endpoint, and it says so.',
    },
    {
      name: 'Wantlister, discdogs',
      does: 'Real-time alerts when a wanted record is listed: price, condition, country, seller filters; mail or Telegram. discdogs is free and adds a browser extension.',
      fidelity:
        'No alerts, on purpose. Discogs owns the listing event; a third party can only poll. What Fidelity watches is a shop — has its stock moved since you were there — one lookup for everybody through the hub.',
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
        'Not a catalogue. Discogs is the catalogue; Fidelity mirrors it to the device and asks what to buy. The year in review and the CSV export exist because they fall out of the mirror, not because cataloguing is the job.',
    },
    {
      name: 'Discogs Enhancer',
      since: 'browser extension',
      does: 'Overlays discogs.com: block sellers, currency conversion, dark mode, “in collection” markers on listings.',
      fidelity:
        'Blocks a shop too, and reads a listing’s price with its postage — but inside its own screens, not on discogs.com. An overlay is a second product with a store review process and no iOS; it is noted, not planned.',
    },
    {
      name: 'Record Scanner, VinylAI',
      does: 'Photograph the cover, get the release and a value.',
      fidelity:
        'The run-out instead of the cover: the number etched near the label names the pressing, and a full one returns one hit where a barcode returns eight. Then which pressing it is, among all of them. No image leaves the device.',
    },
    {
      name: 'Vizcogs',
      does: 'Statistics over your collection, paid.',
      fidelity: 'The map and the year on the shelf, from the open catalogue fields, free.',
    },
  ],

  whyTitle: 'Why it is not “the same API wrapper”',
  whyLead:
    'Most third-party apps do what the Discogs app does with a different skin: sync, browse, scan, alert. They read the same endpoints and show the same rows. Fidelity reads the same endpoints and computes something the API does not hand out:',
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
  title: 'Fidelity im Vergleich',
  description:
    'Was Fidelity ist und was nicht – neben Seller Matches, discdogs, WaxTracker, Groovv und den anderen.',
  back: '← Start',

  sentence:
    'Fidelity liest das Sortiment eines Ladens gegen deine Sammlung und sagt dir, mit Begründung, was in dein Regal gehört.',
  sentenceAbout:
    'Alles Weitere folgt daraus: Der Laden ist die Einheit, die Sammlung kommt vor der Wantlist, und der Satz ist das Produkt.',
  notTitle: 'Was das nicht ist',
  not: 'Eine Katalog-App, ein Preis-Tracker, ein Alarmdienst, ein Overlay über den Marktplatz. Jedes davon gibt es, mehrfach, und manche sind gut. Die Liste sagt, was was ist.',

  sideBySide: 'Nebeneinander',
  theyDo: 'Was es tut',
  instead: 'Fidelity stattdessen',
  rows: [
    {
      name: 'Discogs-App, Seller Matches',
      since: 'Juni 2026',
      does: 'Sortiert Verkäufer danach, wie viele Stücke aus deiner Wantlist sie haben. Über alle Verkäufer – Discogs gehört der Marktplatz.',
      fidelity:
        'Sortiert das Sortiment eines Ladens gegen das, was du besitzt – elf Signale, ein Score, ein Satz – und plant deine Wünsche über die Läden, die du gescannt hast, mit Porto. Über alle Verkäufer kann es das nicht: Es gibt keinen Endpunkt „Angebote je Release", und das steht dran.',
    },
    {
      name: 'Wantlister, discdogs',
      does: 'Alarm in Echtzeit, wenn eine gesuchte Platte eingestellt wird: Preis, Zustand, Land, Verkäuferfilter; Mail oder Telegram. discdogs ist gratis und bringt eine Browser-Erweiterung mit.',
      fidelity:
        'Keine Alarme, mit Absicht. Das Einstellen gehört Discogs; ein Dritter kann nur nachfragen. Was Fidelity beobachtet, ist ein Laden – hat sich sein Bestand bewegt, seit du da warst – eine Abfrage für alle über den Hub.',
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
        'Kein Katalog. Discogs ist der Katalog; Fidelity spiegelt ihn aufs Gerät und fragt, was zu kaufen ist. Der Jahresrückblick und der CSV-Export gibt es, weil sie aus dem Spiegel herausfallen, nicht weil Katalogisieren die Aufgabe wäre.',
    },
    {
      name: 'Discogs Enhancer',
      since: 'Browser-Erweiterung',
      does: 'Legt sich über discogs.com: Verkäufer sperren, Währung umrechnen, Dark Mode, „in der Sammlung"-Marken auf Angeboten.',
      fidelity:
        'Sperrt auch einen Laden und liest den Preis eines Angebots mit Porto – aber auf eigenen Bildschirmen, nicht auf discogs.com. Ein Overlay ist ein zweites Produkt mit Store-Prüfung und ohne iOS; notiert, nicht geplant.',
    },
    {
      name: 'Record Scanner, VinylAI',
      does: 'Cover fotografieren, Release und Wert bekommen.',
      fidelity:
        'Die Auslaufrille statt des Covers: Die Nummer, die nahe dem Label eingeritzt ist, benennt die Pressung, und eine vollständige liefert einen Treffer, wo ein Barcode acht liefert. Dann, welche Pressung es ist, unter allen. Kein Bild verlässt das Gerät.',
    },
    {
      name: 'Vizcogs',
      does: 'Statistik über deine Sammlung, kostenpflichtig.',
      fidelity: 'Die Landkarte und das Jahr im Regal, aus den offenen Katalogfeldern, gratis.',
    },
  ],

  whyTitle: 'Warum es nicht „derselbe API-Wrapper" ist',
  whyLead:
    'Die meisten Dritt-Apps tun, was die Discogs-App tut, in anderer Hülle: abgleichen, blättern, scannen, alarmieren. Sie lesen dieselben Endpunkte und zeigen dieselben Zeilen. Fidelity liest dieselben Endpunkte und rechnet etwas aus, das die API nicht herausgibt:',
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

export const packs = { en, de }

export function useComparedMessages() {
  return computed(() => packs[activeLanguage()])
}
