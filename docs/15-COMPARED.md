# 15 – Fidelity, compared

> **What it is, and what it is not.** Written on 2026-09-12 because every app in this niche
> publishes a "best vinyl apps" post and lists the others, and this one appeared in none —
> not because it is worse, but because there was no page to link to (`docs/14` §2.1 #20:
> "all the third-party apps are the same API wrapper"). Facts about the others come from
> their own pages and store texts on the dates given; nothing here was measured inside them.

---

## The sentence

**Fidelity reads a shop's stock against your collection and tells you, with a reason, what
belongs on your shelf.** Everything else follows from that: the shop is the unit, the
collection comes before the wantlist, and the sentence is the product.

What that is *not*: a catalogue app, a price tracker, an alert service, a marketplace
overlay. Each of those exists, several times, and some of them are good. The table says
which is which.

## Side by side

| | What it does | Fidelity instead |
|---|---|---|
| **Discogs app, *Seller Matches*** (Jun 2026) | Ranks sellers by how many items from your wantlist they have. Across all sellers — Discogs owns the marketplace. | Ranks one shop's stock against what you *own* — eleven signals, a score, a sentence — and plans your wants across the shops you scanned, with the postage. Across all sellers it cannot: there is no listings-by-release endpoint, and it says so |
| **Wantlister / discdogs** | Real-time alerts when a wanted record is listed: price, condition, country, seller filters; mail or Telegram. discdogs is free and adds a Chrome extension. | No alerts, on purpose. Discogs owns the listing event; a third party can only poll. What Fidelity watches is a *shop* — has its stock moved since you were there — one lookup for everybody through the hub |
| **WaxTracker / Collectr-style portfolios** | Your collection as a portfolio: daily prices, weekly movers, gain against what you paid, from stored marketplace data. | A value line too — Discogs' own estimate, once a day, kept on your device, six hours fresh — and nothing per record, nothing stored beyond that. The terms forbid the archive those apps are built on, and the six-hour rule is in the code |
| **Groovv, Spinstack, On Rotation, Discographic, CLZ, My Vinyl+** | Catalogue your records: scan, sync, browse, play log, shelf photos, stats. Beautiful, and solved a dozen times. | Not a catalogue. Discogs is the catalogue; Fidelity mirrors it to the device and asks what to *buy*. The year in review and the CSV export exist because they fall out of the mirror, not because cataloguing is the job |
| **Discogs Enhancer** (browser extension) | Overlays discogs.com: block sellers, currency conversion, dark mode, "in collection" markers on listings. | Blocks a shop too, and reads a listing's price with its postage — but inside its own screens, not on discogs.com. An overlay is a second product with a store review process and no iOS; it is noted, not planned |
| **Record Scanner, VinylAI** | Photograph the cover, get the release and a value. | The run-out instead of the cover: the number etched near the label names the pressing, and a full one returns one hit where a barcode returns eight. Then which pressing it is, among all of them. No image leaves the device — images are Restricted Data |
| **Vizcogs** | Statistics over your collection, paid. | The map and the year on the shelf, from the CC0 fields, free |

## Why it is not "the same API wrapper"

Most third-party apps do what the Discogs app does with a different skin: sync, browse,
scan, alert. They read the same endpoints and show the same rows. Fidelity reads the same
endpoints and **computes** something the API does not hand out:

- **A horizon.** Your collection, unfolded once into every release it points at — artists'
  discographies, labels' catalogue runs, wanted albums' pressings, producers' credits, every
  name an artist goes by. Cached, shared through a hub if you run one, and the reason a dig
  costs no lookups.
- **A score with a reason.** Not "3 of your wants are here" but "Conny Plank at the desk,
  1974 — you have 9 of his productions, not this one. In the Brain 1000 series you are only
  missing 1051 and 1060." Constants that never move, so scores compare across time and
  between people, behind a golden-file test.
- **Honesty as a feature.** Coverage in per cent, request costs before the tap, prices
  locked after six hours, "only the shops you scanned" written on the plan.

And what it refuses, because the terms say so and because it is the right shape: no
backend that sees a token, no price archive, no scraping, no affiliate links, no fee for
the app. The hub is optional and holds nothing personal.

## Where to look

- The app, self-hostable: [README](../README.md) · the concept: [`00-CONCEPT.md`](00-CONCEPT.md)
- Why there is no backend: [ADR-007](adr/007-client-only-pwa.md) · the legal reading: [`09-LEGAL.md`](09-LEGAL.md)
- What the research found and what was built from it: [`14-RELAUNCH-CONCEPT.md`](14-RELAUNCH-CONCEPT.md) §2, [`06-ROADMAP.md`](06-ROADMAP.md) M19 and M20

Sources for the table, as of 2026-09-11/12: the Discogs App Store and Play texts (*Seller
Matches*), [discdogs.app](https://discdogs.app/), [waxtracker.app](https://waxtracker.app/),
the comparison posts of [Groovv](https://www.groovv.app/blog/best-vinyl-collection-apps),
[Spinstack](https://spinstackios.app/blog/best-vinyl-apps-2026.html) and
[My Vinyl+](https://myvinyls.app/blog/2026/07/best-vinyl-collection-apps-2026/), and the
[On Rotation](https://apps.apple.com/us/app/on-rotation/id6756587007) store page.
