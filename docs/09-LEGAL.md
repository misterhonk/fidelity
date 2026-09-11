# 09 – Law, ToS & compliance

> Not legal advice. A researched summary with sources — have it checked by a lawyer before
> any commercial use.

---

## 1. The Discogs API Terms of Use – the hard points

Source: [support.discogs.com – API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)

### 1.1 The six-hour rule

> "You may not display in any format or to any audience the Content if it is more than
> six (6) hours older than the information on Our online properties."

Plus: *"You may not cache or store the Content longer than is necessary to provide a
service to Your application's users."*

**This is a rule about currency, not about cache duration.** We may not display yesterday's
inventory snapshot.

**Implementation:** `dig.expiresAt = startedAt + 6h`, hard in the data model. After that the
UI locks the price and condition data and offers a new scan. Our **derived** data (scores,
signals, the dealer fingerprint) are not copies of Discogs content and may stay.

### 1.2 Attribution – prescribed verbatim

Two notices are mandatory:

```
This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
```

and

```
Data provided by Discogs          ← as a hyperlink to the corresponding discogs.com page,
                                     WITHOUT rel="nofollow"
```

**Implementation:** a global footer component; plus a deep link to the Discogs listing on
every `MatchCard` (which is the buying target anyway).

### 1.3 Restricted Data

Marketplace data (inventory, prices, sales history) and user data (profiles, images) count
as **Restricted Data**:

- ❌ do not pass on to third parties
- ❌ do not exploit commercially
- ❌ **do not use with advertising/marketing platforms** → **no ad networks** on pages with
  listings

### 1.4 No fees

> Forbidden: "Charging a fee to use or access any part of Your application that integrates
> with Our API or the Content if we provide that access to users free of charge, without
> Our express written permission."

**Consequence for this project:** Fidelity is **free**. Full stop.
With no server there is nothing to finance anyway.

> **For context:** Discogs Enhancer (€3–10/year, 10,000+ users) and Vizcogs (€4/month)
> charge money and are visibly tolerated. The defensible reading would be: you pay for the
> *computation itself* (gap analysis, solver, fingerprint), not for access to Discogs data.
> **If money is ever to change hands: get written permission from Discogs first.** Cheap
> insurance.

### 1.5 No scraping

> "Use or attempt to use automated systems designed to access, analyze, or scrape Our
> online properties or applications, including Our API and/or the Content."

This concerns the HTML route `/sell/release/{id}` used by `discogs_alert`,
`discogs-market-monitor` and various Apify scrapers.

**Fidelity does not scrape.** The dealer-centric approach runs entirely on the documented
`/users/{u}/inventory` endpoint. That is not only clean but also more durable — the scrapers
break on Cloudflare regularly.

### 1.6 No diverting traffic

> Forbidden: "Using Our API or the Content with the intent to drive traffic to other
> non-Discogs websites or services."

→ **No eBay/Amazon affiliate links**, no price comparisons with other marketplaces.

### 1.7 Miscellaneous

- Do not circumvent the rate limits, in particular **not with additional API keys**
- Discogs reserves the right to **charge for API access in future**
- Do not resell API access

### ✅ No prohibition on a competing marketplace

The ToS contain **no** explicit clause against it. The nearest constraints are the
traffic-diversion and Restricted Data rules.

**Our position is strategically strong:** Fidelity is a buying advisor that ends in a
**Discogs checkout**. It drives traffic **to** Discogs and raises basket value. That is
exactly in Discogs' interest — a good argument, should it ever be needed.

---

## 2. CC0 – the free pass for catalogue data

[data.discogs.com](https://data.discogs.com/), verbatim:

> "This data is made available under the **CC0 No Rights Reserved** license."

So for releases, artists, labels and masters from the monthly dumps:

| | Live API | CC0 dumps |
|---|---|---|
| The six-hour rule | ✅ applies | ❌ does not |
| Attribution required | ✅ | ❌ |
| Storage limit | ✅ | ❌ |
| Commercial use | restricted | free |
| Marketplace data included | ✅ | ❌ (not in there at all) |

> **The architectural rule that follows is in `01-ARCHITEKTUR.md` §1 and is the project's
> most important one:** catalogue from the dumps, marketplace from the live API, **never
> mix them.** Not only legally clean but also the only solution that works technically (see
> the request budget).

---

## 3. GDPR – almost nothing to do

**Fidelity has no server.** There is no place where other people's personal data is
processed. Everything — token, collection, wantlist, dig results — lives in IndexedDB in the
user's browser and never leaves the device.

| Before (the server design) | Now |
|---|---|
| A processing agreement with the host | gone |
| OAuth tokens encrypted at rest | the token lives with the user |
| Access and data export (arts. 15, 20) | trivial — an export button, the data is local anyway |
| Erasure (art. 17) | trivial — `indexedDB.deleteDatabase()` |
| Server logs, retention periods | there are none |
| A cookie banner | none — no cookie, no tracking, no analytics |

**What is still needed** as soon as the app sits on a public domain:

- [ ] **A legal notice** (section 5 DDG)
- [ ] **A privacy notice** — short and honest: what the app sends to Discogs (the user's
      token), what is stored locally, and that none of it goes to us or to third parties
- [ ] If Sentry is used: name it as a processor, EU region, `sendDefaultPii: false`,
      **token redaction in the `beforeSend` hook**
- [ ] The host processes access logs — that belongs in the privacy notice

> **The privacy notice is allowed to be honestly short.** The most important sentence is:
> *"This app has no server. Your Discogs data is processed and stored exclusively in your
> browser."*

## 4. Accessibility (BFSG / EAA)

In force since **2025-06-28**, covering the private sector including e-commerce services.
The technical standard: **EN 301 549** (which incorporates WCAG 2.x AA).

**The micro-enterprise exemption:** < 10 employees **and** ≤ €2m turnover → exempt from the
service obligations. A private tool for friends clearly falls under it.

> **WCAG 2.2 AA from day one all the same.** The moment this ever becomes commercial or
> moves into a company, the exemption disappears — and retrofitting accessibility into a
> dense filter/table UI is considerably more expensive than building it in from the start.

Details: `05-DESIGN-SYSTEM.md` §6.

---

## 5. Naming rights

- **"Fidelity"** – a generic term, unproblematic. Research DPMA/EUIPO before registering a
  word mark (there is Fidelity Investments — a different Nice class, but check).
- **"High Fidelity"** – protected as a title; do **not** use as a product name.
- **"Championship Vinyl"** – a fictional shop name from a protected work. Harmless as an
  **internal screen name**, unnecessary risk as a **product name**.
- **"Barry"** – a first name, not protectable. Perfectly fine as a feature persona.
- **"Discogs"** is a trade mark of Zink Media, LLC → use descriptively only ("for Discogs"),
  never in the product name, never in the logo.

---

## 6. Compliance checklist before first public access

- [ ] The attribution strings verbatim in the footer
- [ ] "Data provided by Discogs" linked, **without** `nofollow`
- [ ] A deep link to the Discogs listing on every card
- [ ] `expires_at` enforces the six-hour rule technically
- [ ] No scraping, no undocumented endpoints (not even `/marketplace/search`)
- [ ] No advertising, no affiliate links, no fees
- [ ] Rate-limit headers respected, no key rotation to get round them
- [ ] Legal notice + privacy notice online
- [ ] Data export and account deletion work
- [ ] The user agent identifies the app correctly, including a URL
- [ ] Marketplace data is not passed on or exported anywhere
