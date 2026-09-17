/**
 * Two Discogs cart pages, as they copy out of the browser (M34.3).
 *
 * Reconstructed line for line from two screenshots Martin sent on 2026-09-17,
 * one per account, both with the German interface. Discogs mixes its
 * languages there: the headings are German, the notes about free postage,
 * the room in the parcel and the minimum order are English. The address
 * lines are made up. The parser reads by label, not by position, so a copy
 * that wraps a row differently reads the same.
 *
 * What the pages say, and what the parser has to find:
 *
 * | shop           | records | postage      | note                                        |
 * |----------------|---------|--------------|---------------------------------------------|
 * | fatplastics    | 8       | €6.00        | 42 more at no extra cost; free from €250     |
 * | MonsieurEdd    | 4       | €7.00        | free from €250                              |
 * | spirax.records | 1       | €6.00        | 2 more at no extra cost; free from €150; €12.12 below the minimum |
 * | MunichSchall   | 3       | free (€0,00) | no shipping row at all, only the method     |
 * | recordsale-de  | 1       | €3.90        |                                             |
 * | www.hhv.de     | 3       | €4.99        |                                             |
 * | green_hell     | 2       | €8.00        | summary rows copied on one line, no tab      |
 */

export const CART_THREE_SHOPS = `Marktplatz
Alle Artikel Artikel, die ich suche Einkäufe Warenkorb Käufer-Einstellungen
Sie haben 13 Artikel in Ihrem Warenkorb von 3 Verkäufern.
Bestellung bei fatplastics 99.9% positiv (7,681)
Blakkat - Feel Epic (Remixes) (12", EP)
Tonträger: Near Mint (NM or M-) / Cover: No Cover
€7,00 EUR
Machiste - Reale La Vita CU - Remake EP (12", EP)
Tonträger: Mint (M) / Cover: Near Mint (NM or M-)
€8,50 EUR
Extrawelt - Wellental EP (12", EP)
Tonträger: Mint (M) / Cover: Mint (M)
€14,50 EUR
Hemmann + Kaden* - Guten Tag EP (12", EP)
Tonträger: Mint (M) / Cover: Mint (M)
€5,00 EUR
Robag Wruhme - Donnerkuppel (12")
Tonträger: Mint (M) / Cover: Generic
€15,00 EUR
Robag Wruhme - Kopfnikker (12")
Tonträger: Mint (M) / Cover: Generic
€8,00 EUR
Wighnomy Brothers & Robag Wruhme - Polytikk EP (12", EP)
Tonträger: Mint (M) / Cover: Generic
€8,00 EUR
Various - Fatplastics 15 (12")
Tonträger: Mint (M) / Cover: Generic
€6,00 EUR
Ihre Versandadresse
Erika Muster
Musterstraße 1
12345 Musterstadt
Germany
Ihre Adresse ändern
Versand
Standard - Deutsche Post / DHL - €6,00
Delivery in 3 - 5 business days
Add up to 42 more discs/tapes from fatplastics at no additional shipping cost!
Zahlung
Zwischensumme
€72.00 EUR
Versand
€6.00 EUR
Gesamt
€78.00 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
Hemmann & Kaden - Vaganza EP (12", EP)
€5,00 EUR / Tonträger: Mint (M) / Cover: Generic
Hinzufügen
Marek Hemmann - Gemini EP (12", EP)
€9,00 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Hinzufügen
Robag Wruhme - Speicher 115 (12")
€15,00 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Hinzufügen
Jan Jelinek - Loop-Finding-Jazz-Records (2xLP, Album, RE)
€38,00 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Hinzufügen
Metaboman - Im Gelegenheitscamp (12")
€5,00 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Mehr Artikel von diesem Verkäufer ansehen
Bestellung bei MonsieurEdd 99.9% positiv (9,753)
Dominik Eulberg - Der Hecht Im Karpfenteich (12")
Tonträger: Very Good Plus (VG+) / Cover: Very Good (VG)
€6,90 EUR
Fairmont - I Need Medicine (12")
Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
€6,90 EUR
Alan Braxe & Fred Falke - Running (12")
Tonträger: Very Good (VG) / Cover: Very Good (VG)
€39,00 EUR
Monkey Maffia - Secular Earth Disk (12")
Tonträger: Very Good Plus (VG+) / Cover: Near Mint (NM or M-)
€6,90 EUR
Ihre Versandadresse
Erika Muster
Musterstraße 1
12345 Musterstadt
Germany
Ihre Adresse ändern
Versand
Standard - Hermes - €7,00
Delivery in 3 - 5 business days
Free Shipping on orders of €250.00 EUR or more. Finden Sie mehr im Shop des Verkäufers
Zahlung
Zwischensumme
€59.70 EUR
Versand
€7.00 EUR
Gesamt
€66.70 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
DJ Falcon - Hello My Name Is DJ Falcon (12")
€98,00 EUR / Tonträger: Near Mint (NM or M-) / Cover: Very Good Plus (VG+)
Mehr Artikel von diesem Verkäufer ansehen
Bestellung bei spirax.records 100.0% positiv (100)
[a]pendics.shuffle - Saw Saw Soup / Creamer (12")
Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
€2,88 EUR
Ihre Versandadresse
Erika Muster
Musterstraße 1
12345 Musterstadt
Germany
Ihre Adresse ändern
Versand
Standard - Hermes Tracking a - €6,00
Delivery in 3 - 5 business days
Add up to 2 more discs/tapes from spirax.records at no additional shipping cost!
Free Shipping on orders of €150.00 EUR or more. Finden Sie mehr im Shop des Verkäufers
Zwischensumme
€2.88 EUR
Versand
€6.00 EUR
Gesamt
€8.88 EUR
Your order subtotal is €12,12 EUR below the seller's minimum order requirement. Add more items from their shop to place your order.
Zur Kasse
Von diesem Verkäufer empfohlen
Hinzufügen
Villalobos* - Alcachofa (3x12", Album)
€92,00 EUR / Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
Mehr Artikel von diesem Verkäufer ansehen
`

/**
 * The second account's page: a shop with free postage and no shipping row in
 * its sum at all, and the summary rows copied with a tab between label and
 * figure, the way a table row copies.
 */
export const CART_WITH_FREE_POSTAGE = `Artikel wurde Ihrem Warenkorb hinzugefügt.
Sie haben 7 Artikel in Ihrem Warenkorb von 3 Verkäufern.
Bestellung bei MunichSchall 99.9% positiv (39,659)
Rammstein - Untitled (2x12", Album, 180)
Tonträger: Mint (M) / Cover: Mint (M)
€34,90 EUR
Beatsteaks - Living Targets (LP, Album, Ltd, Ash)
Tonträger: Mint (M) / Cover: Mint (M)
€27,90 EUR
Beatsteaks - Smack Smash (LP, Album, Ltd, RE, Ox )
Tonträger: Mint (M) / Cover: Mint (M)
€30,90 EUR
Ihre Versandadresse
Max Muster
Musterweg 2
99999 Musterhausen
Germany
Ihre Adresse ändern
Versand
Free Shipping - €0,00
Zahlung
Zwischensumme	€93.70 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
Rammstein - Zeit (2x12", Album, 180)
€34,90 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Mehr Artikel von diesem Verkäufer ansehen
Bestellung bei recordsale-de 99.8% positiv (388,751)
Radiohead - In Rainbows (2x12", Album + CD, Album + CD, Enh + Box, Ltd)
Tonträger: Near Mint (NM or M-) / Cover: Near Mint (NM or M-)
€391,99 EUR
Ihre Versandadresse
Max Muster
Musterweg 2
99999 Musterhausen
Germany
Ihre Adresse ändern
Versand
Standard - €3,90
Delivery in 1 - 4 business days
Zahlung
Zwischensumme	€391.99 EUR
Versand	€3.90 EUR
Gesamt	€395.89 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
Radiohead - The King Of Limbs (2x10", Album, Cle + CD, Album + Ltd)
€115,44 EUR / Tonträger: Near Mint (NM or M-) / Cover: Near Mint (NM or M-)
Mehr Artikel von diesem Verkäufer ansehen
Bestellung bei www.hhv.de 99.5% positiv (292,617)
Feine Sahne Fischfilet - Sturm & Dreck (LP, Album)
Tonträger: Mint (M) / Cover: Mint (M)
€25,99 EUR
KraftKlub - Mit K (LP, Album, Whi)
Tonträger: Mint (M) / Cover: Mint (M)
€33,99 EUR
Beatsteaks - Beatsteaks (LP, Album)
Tonträger: Mint (M) / Cover: Mint (M)
€33,99 EUR
Ihre Versandadresse
Max Muster
Musterweg 2
99999 Musterhausen
Germany
Ihre Adresse ändern
Versand
Standard - €4,99
Delivery in 1 - 2 business days
Zwischensumme	€93.97 EUR
Versand	€4.99 EUR
Gesamt	€98.96 EUR
Zur Kasse
Von diesem Verkäufer empfohlen
Hinzufügen
KraftKlub - In Schwarz (2xLP, Album)
€36,49 EUR / Tonträger: Mint (M) / Cover: Mint (M)
Mehr Artikel von diesem Verkäufer ansehen
`

/**
 * A third page (Safari, 2026-09-17): the summary rows copy as one line with
 * spaces between label and figure. Green Hell's own shipping text, by format,
 * is in `shipping-notes.ts`.
 */
export const CART_GREEN_HELL = `Sie haben 12 Artikel in Ihrem Warenkorb von 5 Verkäufern.
Bestellung bei green_hell 100.0% positiv (67,016)
Motörhead - 1916 (LP, Album)
Tonträger: Very Good Plus (VG+) / Cover: Very Good (VG)
€59,90 EUR
Motörhead - Iron Fist (LP, Album)
Tonträger: Very Good Plus (VG+) / Cover: Very Good (VG)
€44,90 EUR
Ihre Versandadresse
Ihre Adresse ändern
Versand
Standard - DHL - €8,00
Delivery in 1 - 3 business days
Zahlung
Zwischensumme €104.80 EUR
Versand €8.00 EUR
Gesamt €112.80 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
Metallica - ...And Justice For All (2xLP, Album, PRS)
€99,90 EUR / Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
Mehr Artikel von diesem Verkäufer ansehen
`

/** wheniamfortyfive, same page: four singles, €2.50 (Safari, 2026-09-17). */
export const CART_FORTYFIVE = `Bestellung bei wheniamfortyfive 100.0% positiv (571)
Bernd Kreibich Und Der Maschinen Kinderchor - Aus Der Fernsehserie Sesamstrasse Die Titelmelodie Der Die Das Und Das Quietsche-Entchen (7")
Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
€14,90 EUR
Ike & Tina Turner - Nutbush City Limits / Help Him (7", Single)
Tonträger: Near Mint (NM or M-) / Cover: Very Good Plus (VG+)
€3,90 EUR
Pink Floyd - Another Brick In The Wall Part II (7", Single)
Tonträger: Near Mint (NM or M-) / Cover: Very Good Plus (VG+)
€4,90 EUR
Deep Purple - Woman From Tokyo / Black Night (Live Version) (7", Single)
Tonträger: Very Good (VG) / Cover: Very Good (VG)
€1,90 EUR
Ihre Versandadresse
Versand
Standard - €2,50
Delivery in 3 - 10 business days
Zahlung
Zwischensumme €25.60 EUR
Versand €2.50 EUR
Gesamt €28.10 EUR
Ich stimme der Käuferrichtlinie und den Verkäuferbedingungen zu
Jetzt bestellen und bezahlen
Von diesem Verkäufer empfohlen
Hinzufügen
F-R David* - Words (7", Single)
€1,90 EUR / Tonträger: Near Mint (NM or M-) / Cover: Very Good Plus (VG+)
Mehr Artikel von diesem Verkäufer ansehen
`
