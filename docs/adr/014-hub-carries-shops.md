# ADR-014 · The hub carries shops, never their prices

**Status:** accepted · **Date:** 2026-09-13 · **Supersedes:** nothing · **Related:** ADR-008 (the hub is optional), ADR-009 (the friends list), docs/13

## Context

The shops screen is one list and it is only ever "shops you dug". A tester put the gap
plainly: *"How do we maximise the shops I already know?"* — because every feature that
reasons about shops is bounded by that list. The basket comparison (M29 #5) compares within
it. The round (M29 #2) walks it. A shop nobody on this device has dug does not exist.

The obvious fix is not available. Discogs has **no** endpoint for "which shops sell this
sort of record", no curated list of good sellers, and `/marketplace/search` is undocumented
(rule 5). Seller rating exists per listing and measures the conduct of a transaction, not
what is on the shelves: a 99.8 % seller can stock nothing anybody here wants.

What *does* exist is that several devices already dig several shops, and the hub already
carries what one device learned for the benefit of the next — horizon chunks since M9,
shipping ladders, covers, pressing families. It has never carried anything about a **shop**.

The same tester named the risk in the same breath: a curated list would be the big shops,
and the small independents — the ones worth finding — would fall off it.

## Decision

**The hub may carry the existence of a shop and what it stocks. It may never carry a price,
and it may never carry what a shop is worth to a particular person.**

Three fields decide it, and the line between them is the whole decision:

| Field | Carried | Why |
|---|---|---|
| `username`, `displayName`, `shipsFrom`, `avatarUrl` | yes | Public on the shop's own Discogs page. Nothing here is derived from anybody's collection. |
| `fingerprint` — the label, style and decade distribution of a sampled inventory | yes | Derived, not marketplace content. `Dealer.fingerprint` already carries this note in the data model and already outlives the six-hour window for that reason: it says "this shop stocks Blue Note and seventies jazz", never "this record costs €24". |
| `numForSale`, `lastSeenAt` | yes | A count and a date. Neither is an offer. |
| **`affinity`** | **no** | It is the hit rate *against one collection*, so it is a statement about a person, not about a shop. Two users' affinities for the same shop would describe the two users. |
| **any price** — listings, medians, ladders' currencies as such | **no** | Rule 4. The fingerprint's `medianPrice` is dropped on the way up for the same reason. |

The ranking happens **on the device**. The hub answers "here are shops, and what they
stock"; which of them suit you is computed locally against your own taste profile, which
never leaves the device. That is what keeps the platzhirsch problem out: the list is what
people actually dug, ordered by what *this* collection contains.

**Rule 8 holds unchanged.** No feature requires it. Without a hub the shops screen is
exactly what it was; with one it gains a section that is empty until somebody else has dug
something. Two seconds, no retry, silent fallback, as everywhere else.

## Consequences

**What it buys.** The first device to dig a shop saves every later device the two hundred
requests of finding it — and more to the point, saves them the problem of not knowing it
exists. With a handful of users the shops screen stops being a log of what you happened to
try and starts being a list worth reading.

**What it costs.** A shop row says that *somebody* dug that shop. Not who, not what they
own, not what they paid. On a hub run by one person for their friends (docs/13) that is the
same exposure the shipping ladders already carry. On a hosted hub it is a shop's public name
and a distribution of labels — which is why the contribution is a contribution and not a
report: a device sends what it learned, and the hub never asks who is asking.

**What it does not become.** The moment this list claimed to be "the shops that sell X" it
would be the multi-dealer search that `docs/06` rules out, and it would be wrong as well as
forbidden — the hub knows a sample of an inventory from whenever somebody last dug it, not a
catalogue of offers. Every screen that shows these rows says where they came from and when.

## Alternatives considered

- **Bundle a curated list of good shops.** This is the platzhirsch problem, chosen on
  purpose rather than stumbled into: whoever writes the list decides what a good shop is.
- **Derive shops from the Discogs dump.** The catalogue has no marketplace side at all —
  artists, labels, masters, releases. It knows no shop and no price, and cannot be made to.
- **Read the friends list more widely.** ADR-009 admits exactly one undocumented endpoint,
  off by default, and says a second exception needs a second ADR. This is not that exception:
  it needs no Discogs endpoint at all.
