# Legal texts for the supporter tier

**Drafts. Not legal advice. Review by a lawyer before going live.**

The supporter tier ("Dankeschön", #253) is not built. These files are drafts for the owner
and a lawyer, written for #254. None of them is linked from the app, and none goes live
before the access service does. The pages that are live today are `app/pages/legal.vue` and
`app/pages/privacy.vue`.

Each file carries German first and English second. **The German text is the legally relevant
one** for consumers in Germany; the English is a convenience translation. Both address the
reader as "du"/"you", as the live pages do (`docs/20-VOICE.md`).

## The files

| File | What it is |
|---|---|
| [terms.md](terms.md) | Terms for the supporter tier: who sells (Lemon Squeezy) and who promises the service (the operator), what a supporter gets, best effort with no SLA, the free app stays free, term and cancellation through the merchant of record, deletion at the end, liability within § 309 Nr. 7 BGB, changes, governing law with Art. 6 Rome I |
| [privacy-access.md](privacy-access.md) | Privacy addendum for the access service: controller, Lemon Squeezy as independent controller, the six stored fields from `docs/09-LEGAL.md` §3.1, legal bases, Hetzner and Cloudflare as processors, retention, Art. 30, rights, supervisory authority |
| [consumer-links.md](consumer-links.md) | The withdrawal button and the cancellation button: where they go, where they lead, what the operator still has to show itself |
| [imprint.md](imprint.md) | The legal notice under § 5 DDG with placeholders, plus the § 18(2) MStV line |

## Placeholders

Real values never go into this repository. They are filled in where the page is built for
the live service.

| Placeholder | What goes there | Used in |
|---|---|---|
| `{{NAME}}` | The operator's full name (or business name) | all |
| `{{STREET}}` | Street and number of the address for service (c/o with mail handling, #252) | imprint, privacy-access |
| `{{POSTCODE_CITY}}` | Postcode and town | imprint, privacy-access |
| `{{EMAIL}}` | Contact email | imprint, privacy-access |
| `{{PHONE_OR_CONTACT}}` | Phone number, or a contact form answered promptly | imprint |
| `{{VAT_ID_IF_ANY}}` | VAT id under § 27a UStG; drop the line if none | imprint |
| `{{MOR_LEGAL_NAME}}` | The merchant of record's legal entity, e.g. "Lemon Squeezy, LLC" [verify] | terms, privacy-access, imprint |
| `{{MOR_TERMS_URL}}` | Lemon Squeezy's buyer terms | terms |
| `{{MOR_PRIVACY_URL}}` | Lemon Squeezy's privacy notice | privacy-access |
| `{{MOR_PORTAL_URL}}` | Lemon Squeezy's customer portal, target of both consumer buttons | terms, consumer-links |
| `{{SUPERVISORY_AUTHORITY}}` | The data protection authority of the operator's federal state | privacy-access |
| `{{LOG_RETENTION_DAYS}}` | How long server logs are kept (the private draft proposes 14) | privacy-access |
| `{{SYNC_GRACE_DAYS}}` | Days after a key expires before sealed sync data on the hub is deleted | terms, privacy-access |
| `{{EFFECTIVE_DATE}}` | The date the texts take effect | terms, privacy-access |

## Open questions for the owner and the lawyer

1. **Trader status.** Is the operator a trader under § 14 BGB once money flows, even with
   Lemon Squeezy as seller? The drafts assume yes for the imprint and the service promise.
2. **Kleinunternehmer.** Does § 19 UStG apply, and what is the operator's supply — a service
   to Lemon Squeezy (US), place of supply outside Germany? Decides `{{VAT_ID_IF_ANY}}` and
   whether Art. 6(1)(c) GDPR covers any per-order record (#252, tax adviser).
3. **Cloudflare.** Is Cloudflare in front of the hosted service? If not, drop its paragraph
   from privacy-access.md. If yes, sign its DPA.
4. **Discogs' answer to the letter (#252).** The terms promise that no paid feature calls the
   Discogs API. If Discogs answers with conditions, they may belong in terms.md §2.
5. **The cancellation and withdrawal buttons behind a sign-in.** Lemon Squeezy's portal wants
   a magic link. Does a link to it satisfy § 312k BGB and the new withdrawal button, or do we
   need our own confirmation page? (consumer-links.md)
6. **Whose duty are the buttons** when Lemon Squeezy is the seller — Lemon Squeezy's alone,
   or ours as well because the offer starts on our pages?
7. **Statutory rights for digital products** (§§ 327 ff. BGB): against Lemon Squeezy, against
   the operator, or both? terms.md §4.
8. **The test pressing.** A one-off payment for a service that may end. Is "for as long as we
   run the hosted service" with three months' notice enough under § 307 BGB, or is a pro-rata
   refund owed if it ends early? Does § 312k apply to it at all?
9. **Sync data after expiry.** How many days (`{{SYNC_GRACE_DAYS}}`)? The hub has no such
   rule yet (`docs/13-HUB-ADDON.md`); #253 has to build it.
10. **Is the key mailed by Lemon Squeezy?** `docs/17-ROADMAP-1.0.md` §6.2 says the key goes out
    with the receipt. If Lemon Squeezy sends that mail, it receives the key, and the privacy
    addendum must say so.
11. **§ 18(2) MStV.** Does anything on the site count as journalistic-editorial content?
12. **Data protection officer.** Confirm none is required (§ 38 BDSG).
13. **The dates flagged `[verify]`** in consumer-links.md: the section number and labels of
    the withdrawal button, the 19 June 2026 date, the ODR platform shutdown, current case law
    on sign-in before cancellation.

## How these drafts differ from the private access-service draft

The private repository `fidelity-cloud` has an earlier notice for the access service
(2026-09-12). These drafts follow it on every field, the 30-day deletion, the hash instead
of the address, and the key that stands for a plan, not a Discogs account. They differ here:

- **No tips.** The private draft still describes one-off tips that create no row; #253 says
  "no tip button", so tips are gone here.
- **Processors named.** The private draft names none; this one names Hetzner and, if used,
  Cloudflare.
- **Art. 6(1)(c)** is added as a narrow basis, flagged for the tax adviser.
- **Art. 30 record and the full list of rights** (Arts. 15–18, 20, 21) are spelled out.
- **Sync data on the hub** gets a retention line; the private draft covers only the
  access-service row.
- **"To the provider: nothing"** is kept but flagged, because `docs/17-ROADMAP-1.0.md` §6.2
  has the key mailed with the receipt.
- **The name** is Sleeveside, not Fidelity, and "plan" is "tier".

The private draft should follow these once the lawyer has read them, not the other way round.
