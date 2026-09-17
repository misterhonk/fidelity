# ADR-017 – The postage of your own order is your own fact

**Status:** Accepted
**Date:** 2026-09-17

## Context

Since M14 the order import (`worker/orders.ts`) reads one purchase by its number,
`GET /marketplace/orders/{id}`, and keeps three things: the records, the shop and the
date. It drops the rest on purpose, and a test holds the schema to it: the promised
grade, the price per item and the seller's email address never exist past the parse.
The reasoning stands in the file and in docs/06 (M20 row 5, checked 2026-09-12): an
item's price at the moment of sale is the listing's price, and a diary of those would be
the price archive `docs/09` §1.3 rules out, only smaller.

The same answer carries `shipping: { value, currency }` at the top level — what the
shop charged for postage on *that* parcel, for *that* many records, to *this* address.
That is the one figure the whole of M34.3 is about, and the one no endpoint names for
more than one record: `shipping_price` on a listing is for one record (docs/02 §5), the
seller's free text is a heuristic, the cart page has to be copied by hand.

The question this settles is whether reading that figure is the same thing as reading
the price, and the answer is no.

## Decision

The order import reads `shipping.value` and `shipping.currency` together with the number
of items, and keeps the pair as a postage tier for that shop: this many records, this
much, source `order`. Nothing else about the order changes; the schema still names no
price, no grade and no address, and the test that holds it to that stays.

**Why this is the buyer's fact and not the marketplace's.** The listing price is what
the seller asked of everybody, live, and it ages: the six-hour rule (CLAUDE.md rule 4)
exists so that nobody is shown a marketplace that no longer exists. Postage on a closed
order is what one buyer paid one seller for one parcel. It is on the buyer's own
purchases page for as long as the account exists, on the invoice, on the PayPal receipt.
It does not describe a listing and it does not age out of anything.

**Why it is the same thing the app already keeps.** The read-off field (`v0.100.0`) and
the pasted cart page (`v0.102.0`) store exactly this figure — a count and what Discogs
charged for it — as a user tier, indefinitely, after somebody has read it off a Discogs
page and typed or pasted it. Reading it off the order the app already fetched is the
same fact by a shorter road. Refusing it here while accepting it there would be a
distinction without a difference.

**Why a source of its own.** A tier from an order is not "entered by you", and the
label says where a number came from. `order` sits beside `user` in every place that
treats a hand-entered table as the buyer's own knowledge: it wins over the hub, the
bundled file and the parser; it is cut around by a later read-off the same way; it goes
to the hub as a contribution the same way. The screen says "from your order".

## Alternatives

- **Keep dropping it, as with the price.** Rejected: the price argument does not carry.
  The price is the listing's, the postage is the parcel's, and the app already keeps the
  parcel's figure from two other sources.
- **Store it as a `user` tier.** Rejected: it is not what the label says, and the label
  is the whole trust model of the postage table (docs/00 §7).
- **Keep the postage on the order row, not on the shop.** Rejected: the basket asks the
  shop, not the order. A figure nobody adds up with is a diary entry.

## Consequences

- One more source in `ShippingTier.source`, and one more label in both languages.
- `worker/orders.ts` names `shipping`; the guard test keeps naming `price`,
  `media_condition`, `sleeve_condition`, `condition_comments` and `email` as forbidden.
- An imported order teaches the shop's postage for that count without a second request.
- The way out: drop the `order` branch in the import; the tiers already written are
  the buyer's own facts and stay.
