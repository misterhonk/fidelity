/**
 * Echte `seller.shipping`-Texte, wortgleich.
 *
 * Copied out of IndexedDB after a real paste from a real Discogs cart on
 * 2026-08-10, because the shape that broke the parser is not one anybody
 * invents while writing tests: three rate tables stacked under country
 * headings, with the domestic one written in a shape the range rule cannot
 * express and an aside about the courier sitting in the middle of it.
 *
 * Discogs sends CRLF. Kept, because the line splitting depends on it.
 */
const crlf = (text: string) => text.replace(/\n/g, '\r\n')

/**
 * fatplastics — the text behind the €7 error.
 *
 * A basket of two records was quoted 13 EUR (the `2-8 Records` rule under
 * `Europe:`) where the real Discogs checkout charged 6 EUR (`Up to 15 records`
 * under `Germany:`).
 */
export const FATPLASTICS = crlf(`more vinyl please check www.fatplastics.com

These are our shipping policies:

Buyer pays shipping costs.

Germany:

Up to 15 records (DHL-Paket,1-2 days): 6 EUR

Europe:
1 circa 8 Records: 11 EUR not EU-Member (Swiss, Norway, Russia, Ukraine, Serbia, United Kingdom usw. 17 Euro) via DHL uninsured uninsured without Trackingcode
1 Record 9 EUR for EU-Member insured with Trackingcode via Pakajo
2-8 Records 13 EUR  EU-Member insured with Trackingcode via Pakajo
1 Record 10 EUR for United Kingdom insured with Trackingcode via Pakajo
2-8 Records 14 EUR for United Kingdom insured with Trackingcode via Pakajo
1-20 Records:18 EUR , not EU-Member (Swiss, Norway, Russia, Ukraine usw. )  30 EUR via DHL
21-42 Records 24 EUR , not EU-Member (Swiss, Norway, Russia, Ukraine usw. )  37 EUR via DHL

Non-Europe:
1 to 8 Records: 23 EUR via DHL uninsured without Trackingcode
1 to 20 Records: 49 EUR via DHL
21 to 42 Records: 80 EUR via DHL

Please ask for individual shipping prices (tracking & insurance)!

Please note: 2LP/2x12" are two LPs, 3LP/3x12" are three LPs.

Shipping costs include postage and packing.
`)

/**
 * 430AM Studio — a wall of terms with BBCode headings and no rate table.
 *
 * Trimmed to the lines that could mislead a parser: bold headings shaped
 * exactly like country headings, and numbers next to currency-ish words.
 */
export const PROSE_WALL = crlf(`[b]Buy with Confidence:[/b]
[b][i]*All shipments include full track & trace.[/i][/b]

[b]Shipping address Terms:[/b]
We will always ship to the protected shipping address details.

[b]Customs Terms:[/b]
Deliveries to non-EU countries may be subject to additional duties.

[b]Additional Terms:[/b]
*Unpaid orders will be canceled after 4x24 hours.
*All overseas territories from European countries are 'Rest of World' shipping rate.
*2x12" releases count as 2 items/records, 3x12" releases count as 3 items/records.

4. Prices and Payment
All prices are inclusive of VAT and exclusive of shipping costs.
`)
