# 17 – The road to 1.0: app, hub, catalogue, access

> **Status:** plan, agreed in outline on 2026-09-12 · **Author:** Martin + Claude
>
> Where the three parts stand, what 1.0 means for each, which technology carries it, how it
> is tested on the home lab and whether a cloud server could carry the same thing, and how
> a paid comfort tier works when every payer gets their own access. The paid tier is a
> way to support the developer; the app works without it and always will.

---

## 1. Where things stand

| Part | State on 2026-09-12 | Runs where |
|---|---|---|
| **App** | 0.44.0. Static PWA, Nuxt 4 in SPA mode, worker, IndexedDB. Eleven signals, digs, basket, shelf, map, wantlist with plan and priority, in-store with identify and pressing family, record fair, year on the shelf, CSV, vault, share, two languages, WCAG-checked. 1,379 unit tests, 344 browser tests, bundle 118 kB of 180. | `martinmelcher.de/fidelity` (webspace), `fidelity.mrtnmlchr.de` (home lab), GHCR image |
| **Hub** | Hono + `node:sqlite`, one process. Horizon cache with the lexicon, shipping tiers, covers, pressing families, vault, share links, the watcher with push. One shared secret per hub. 67 tests. | Home lab, behind Traefik and a Cloudflare tunnel; the Uberspace copy retired |
| **Catalogue** | Concept and decision only ([ADR-013](adr/013-catalogue-service.md), `docs/16`). | — |
| **Access** | None. A hub is a friend circle behind one word. | — |

What 1.0 changes is not the app's shape. It is three things: the catalogue exists, a
hosted hub and catalogue can be used by people who are not Martin's friends, and the
project can take money without breaking a rule it has kept for a year.

## 2. What "1.0" means

A version number is a promise. For each part, the promise:

**App 1.0** — *A stranger can install it, connect their Discogs account, and buy better
records in a shop the same afternoon, without reading a document.* Concretely: onboarding
that survives a first-time user; every screen in both languages; axe clean; the service
worker updating without a "reload" banner somebody has to understand; a `whats-new` that
reads as a changelog for people; a stable data schema with a migration path (IndexedDB
v11 and every version since v6 upgrade in place); the JSON backup importable across
versions; documentation that a self-hoster can follow (`deploy/`, `README`).

**Hub 1.0** — *It can hold a hundred strangers' data without any of them seeing another's,
and it can be run by anybody from the compose file.* Concretely: per-user access (§6)
beside the shared secret; the vault and the push registration keyed by the person who owns
them; the shared caches (horizon, covers, shipping, families) public to every member and
containing nothing personal; backups; a health page a monitor can read; rate limits per
key; a documented way to run it at home in five minutes.

**Catalogue 1.0** — *The six phases of `docs/16` shipped, the monthly build unattended for
three months in a row, and the two golden tests green: the scores do not move, the reach
does.*

**Access 1.0** — *A person pays, gets their own key, enters it once, and it works on all
their devices; when they stop paying, it stops working and nothing else does.* And the
letter to Discogs sent and answered, or the tier shaped so that it needs no answer (§6.1).

## 3. Technology, part by part

### 3.1 App — stays what it is

| Layer | Choice | Why it stays |
|---|---|---|
| Framework | Nuxt 4, `ssr: false`, static | The bundle is under budget, the build is understood, and ADR-001's remaining cost is a router and a build step. A move to Vite + Vue alone would save perhaps 15 kB and cost a month; `docs/14` §4 says the same |
| Storage | IndexedDB via `idb`, versioned schema | Eleven migrations in, all in place. Nothing needs SQLite-WASM |
| Compute | One worker, one Discogs client, one Web Lock across tabs | Rule 3; unchanged since M1 |
| PWA | Hand-written service worker, `injectManifest` | Push and offline depend on it; it is tested against the built output |
| Distribution | Web first. A Capacitor shell for the stores is a 1.x step, not 1.0 | `docs/14` §5: the shell is cheap because the app is already built as if it had no network; the store presence is a marketing decision |

**What 1.0 adds to the app:** the `CatalogueSource` port (M21.1), the access key in the
preferences (§6), and polish (§7, M24).

### 3.2 Hub — one process, two doors

Stays Hono + `node:sqlite`, one container, one file. What changes:

- **Two doors instead of one.** Today every route behind the secret. At 1.0 a route is
  either *member* (needs the hub secret **or** a valid access key) or *personal* (needs a key
  and answers only for that key's own rows: vault, push registration, share ownership).
  Self-hosters keep the secret and never see a key; the hosted hub has no secret and only
  keys.
- **Verification without a database of users.** Keys are signed (§6.2); the hub verifies
  the signature with a public key it was started with and checks a small revocation table
  it refreshes from the access service. It stores no email, no name, no payment state — a
  key's subject is an opaque id.
- **Per-key rate limits** at the hub, not only at the proxy.
- **Backups:** `hub.sqlite` nightly to the Storage Box (or a NAS share at home) with the
  VAPID keys, which are the one thing that cannot be rebuilt.

### 3.3 Catalogue — as decided

ADR-013 and `docs/16` §4–§7. The build is a container that runs monthly and exits;
serving is a second Hono process on the same SQLite pattern as the hub. No user, no
secret, cacheable for thirty days. Whether serving needs DuckDB instead of `node:sqlite`
is decided by the first measurement (M21.3).

### 3.4 Access service — the smallest new thing

A fourth process, `fidelity-access`, and it is deliberately tiny:

- receives the payment provider's webhooks (subscription created, renewed, cancelled; tip
  received),
- issues and renews **access keys** (§6.2),
- keeps the only table that maps a payer to a key: `payer_id, email_hash, tier, valid_until,
  key_id, revoked`,
- publishes the public key and the revocation list the hub reads,
- serves the two pages a payer sees: "here is your key" after checkout, and "manage your
  plan" (which is the provider's customer portal, linked, not rebuilt).

It is the one process that holds personal data (an email hash and a payment reference),
and therefore the one that gets a privacy notice of its own, a backup, and the shortest
possible attack surface: no login, no password, no session — a magic link from the
provider's receipt is the only way in.

### 3.5 Payment provider

Two shapes, and the choice is about VAT, not about fees:

| | Stripe | Merchant of record (Paddle, Lemon Squeezy) |
|---|---|---|
| Who is the seller | Martin. EU VAT on digital services is his: OSS registration, per-country rates, invoices | The provider. One invoice from them to Martin, VAT handled everywhere |
| Fees | ~1.5 % + €0.25 EU cards, Stripe Tax extra | ~5 % + €0.50 |
| Subscriptions, one-time tips, customer portal, webhooks | all there | all there |
| Effort at €30k a year | OSS filings quarterly, or a tax adviser | none beyond bookkeeping |

**Recommendation for 1.0: a merchant of record.** The tier is a support tier, the volume
is small, and a solo developer's evening is worth more than three per cent. Stripe is the
step when the numbers say so; the access service is written against a provider interface
with two methods (`verifyWebhook`, `portalUrl`) so the swap is a module. *Prices and fee
figures above are from memory of their public pages and must be checked before signing.*

## 4. The test setup, with the home lab

Three rings, and a thing moves outward only when the inner ring is green.

```
CI (GitHub Actions, per push)
  lint · typecheck · unit (1,379) · size · browser (344, Chromium + WebKit)
  hub tests (67) · catalogue ETL on the mini-dump (M21.2) · image builds

Home lab (fidelity.mrtnmlchr.de) — staging, always `latest`
  WUD pulls new images on digest change
  the monthly catalogue build runs here first, timed and sized
  Uptime Kuma: app, hub, catalogue health, build date < 40 days
  a nightly Playwright smoke run against the public name: pages load, hub answers,
    catalogue answers, the shop screen identifies a fixture barcode with routed Discogs
  Martin's phone is the canary: it points here, and the access logs are read

Production — the release tag, never `latest`
  today: the webspace for the app, the home lab for hub and catalogue
  at 1.0: a Hetzner server for hub, catalogue and access (§5), the app on a CDN
  promoted by a workflow that pins the tag, after the staging smoke run is green
```

**What is missing today and belongs to M23:** the nightly smoke run against staging (the
routed Discogs answers exist in the specs already); a load test of the catalogue
(`autocannon` against `family` and `credits` for a minute, with a stated target of 200
requests a second on the home lab); a restore drill for the hub's SQLite; a build-date
alert; and a `release channel` per environment so the home lab can run `latest` while
production runs tags.

## 5. Cross-check: would a Hetzner cloud server carry it?

Sizes from `docs/14` §8 (Hetzner prices as read on 2026-09-11, to be re-read before
ordering) and `docs/16` §4 (estimates, to be replaced by the first build).

| Need | Home lab (home-deb) | Hetzner CAX21 (4 vCPU arm64, 8 GB, 80 GB, €13.08) | Verdict |
|---|---|---|---|
| Hub | 60 MB RAM, a few MB disk | trivially | ✅ |
| Catalogue serving | ~300 MB RAM, 8 GB file, point lookups | trivially; the file on the 80 GB disk | ✅ |
| Catalogue **build** | 30 GB scratch, 4–8 GB RAM, 30–45 min | 80 GB minus 8 kept ×2 = tight; RAM fine | ⚠️ build **at home**, ship the file (8 GB rsync or Object Storage), swap on the server. The server never builds |
| Access service | negligible | trivially | ✅ |
| Traffic | a dig's worth of catalogue answers is a few hundred KB; covers come from Discogs | 20 TB included | ✅ |
| TLS and edge | Traefik + Cloudflare tunnel | Caddy or Traefik, Cloudflare proxy in front | ✅ same containers, `compose.homelab.yml` becomes `compose.cloud.yml` with one env file |
| Backups | NAS / Storage Box | Storage Box BX11 €3.81, Borg nightly | ✅ |
| Uptime | a home connection, a Proxmox host, one person | Hetzner's SLA, snapshots | this is the reason to move, not capacity |
| Images | arm64 and amd64 already built | arm64 | ✅ |

**Conclusion:** a single CAX21 carries hub, catalogue and access for the audience 1.0
addresses (hundreds, not thousands), at ~€17 a month with backups, provided the monthly
build stays at home and the artefact is shipped. The home lab is the staging ring either
way. The move is triggered by uptime and upload, not by CPU: the day the home connection
is what a paying member notices.

The x86 twin (CX33, €10.70) does the same job; the arm64 images are the ones already built,
so the CAX line is the path of least surprise.

## 6. Access to the paid comfort tier

> Why the code stays open and only a billing repository is private: [ADR-014](adr/014-open-core-hosted-comfort.md).

### 6.1 What is paid for, and what the terms allow

Discogs' terms forbid charging for *access to an application that integrates with the API*
(`docs/09` §1.4). The tier is therefore shaped so that nothing paid touches the API:

| Free, always, for everybody | Comfort tier (hosted by Martin) |
|---|---|
| The whole app: every signal, digs, basket, shelf, map, wantlist, plan, in-store, identify, pressing family via the API, year on the shelf, CSV, backup, two languages | **A hosted hub**: shared horizon and families (seconds instead of twelve minutes), covers, shipping tiers |
| Self-hosting hub and catalogue from the compose file, with every feature the hosted ones have | **The watcher with push** for the shops you follow |
| | **The vault and share links** on Martin's hub |
| | **The catalogue's reach**: runs above 1,500, credits in the second degree, identify and families without a request, the map compared |

Everything in the right column is *computation on CC0 data* or *hosting a cache*, and none
of it is an API call made on the member's behalf. The letter to Discogs (`docs/14` §7) is
still sent before the first euro — as a courtesy, and as insurance.

### 6.2 One key per payer — how it works

```
payer ── checkout at the provider ──▶ webhook ──▶ fidelity-access
                                                   │ issues key K = sign_ed25519({
                                                   │     kid, sub: payer_id, tier, iat, exp: +35 days })
                                                   │ shows K once, mails it with the receipt
payer ── enters K in Settings › Access ──▶ app stores K in IndexedDB (never in a URL)
app ── x-fidelity-key: K ──▶ hub / catalogue
                                 │ verify signature with the public key (no network)
                                 │ check kid against the revocation list (refreshed hourly)
                                 │ member route: ok · personal route: rows where owner = sub
app ── every 30 days ──▶ fidelity-access /renew with K ──▶ a fresh K if the plan is active
```

- **A key identifies a payer, not a Discogs account.** The Discogs token is never involved;
  the hub does not learn who you are on Discogs.
- **Short-lived, self-renewing.** Thirty-five days of validity, renewed silently while the
  plan runs. Cancelling means: no renewal, and the key expires within a month — no
  revocation needed for the ordinary case. Revocation (chargeback, abuse) is the small list.
- **Devices.** The key is a string; enter it on each device, or let the vault carry it —
  the vault is encrypted with the person's passphrase and already syncs between their
  devices. No device count is enforced at 1.0; a per-key rate limit is the honest ceiling.
- **Losing it.** The provider's receipt mail carries the key; the "manage your plan" page
  shows it again after the provider's magic link. No password anywhere in Fidelity.
- **Self-hosters** never see any of this: a hub with a secret ignores keys, a hub without a
  secret and without a public key is open, as today.

### 6.3 Tiers and tips, the LightMe way

The pattern from the screenshot: several yearly plans that all unlock the same features —
you choose how much the support is worth to you, not what you get — with names that make
you smile, and below them one-off tips that unlock nothing. Fidelity's version, in the
vocabulary it already has:

| Plan (yearly, all unlock the same) | | Tip (one-off, unlocks nothing) | |
|---|---|---|---|
| **A 7"** — *"Keep the lights on in the shop."* | €9.99 | **A cup of coffee at the counter** | €1.99 |
| **An LP** — *"A proper record for the shelf."* | €14.99 | **A new inner sleeve** | €4.49 |
| **A double album** — *"Room for the gatefold."* | €29.99 | **A round of stylus cleaner** | €9.99 |
| **The first pressing** — *"Help me do this full-time."* | €59.99 | | |

Monthly plans are deliberately absent at 1.0: the provider's fee eats a €0.99 month, and
`docs/14` §9 found the same in every survivor of this niche — cheap yearly, or once. A
lifetime tier ("the test pressing", €99) is worth offering from day one for the same reason.
*Prices are placeholders for the decision, not the decision.*

The screen: Settings › Support, one list, the plan the person has ticked, the rest
selectable, the tips below. No paywall anywhere else — a comfort feature that is not
available says, in one line, what it would take, and links here.

## 7. The plan, in milestones

Each milestone is releasable on its own; the order is chosen so that nothing paid exists
before the catalogue exists, and nothing hosted for strangers exists before the hub can
tell them apart.

| M | Track | Delivers | Effort |
|---|---|---|---|
| **M21** | Catalogue | The six phases of `docs/16`: seam, mini-dump, build, two routes, signals, shop and map | 3–4 weekends + evenings |
| **M22** | Hub | Two doors: access keys verified by public key, personal routes keyed by subject, per-key rate limit, revocation list, backups, health for monitors. `fidelity-access` with the provider interface, webhooks, key issue and renewal, the two pages. Settings › Access and Settings › Support in the app. **Nothing charged yet** — the tier exists with a "free while in beta" plan so the whole path is exercised | 2–3 weekends |
| **M23** | Ops | The staging ring on the home lab as in §4: nightly smoke, load test, restore drill, build-date alert, release channels. `compose.cloud.yml`. The Hetzner cross-check turned into a rehearsal: one CAX21 for a week, the artefact shipped, torn down again | 1–2 weekends |
| **M24** | App | Polish to the 1.0 promise: onboarding for strangers, the update flow without a banner to understand, `whats-new` for people, backup import across versions, self-hosting docs from a clean machine, axe and keyboard across every screen added since M8 | 2 weekends |
| **M25** | Launch | The letter to Discogs sent (before M22's first euro, so early in M22); prices decided; the provider account; the privacy notice for the access service; `docs/15` as the public page; the store shell deferred to 1.1 | 1 weekend + waiting |
| **1.0** | | Tag, changelog, the four promises of §2 checked one by one | |

Roughly a quarter of weekends. The catalogue is the long pole and the only technically
uncertain one, which is why it goes first and why M21.3 ends with numbers instead of
estimates.

## 8. Implementation plans, per part

### 8.1 Catalogue (M21) — as in `docs/16` §9

Repeated here only as the dependency edge: M22 needs M21.4 (the two routes) for the tier
to have something to sell beyond the hub.

### 8.2 Hub (M22)

**Progress, 2026-09-12:** 1, 2, 3 and 5 are in (`hub/src/access.ts`, the doors in
`app.ts`, the `owner` column, per-key limits, `accessKey` in the preferences, the header
on every hub and catalogue call, Settings › Access and Settings › Support, the key's
verdict on the hub check). `scripts/access-keys.ts` generates a pair and issues keys by
hand — the beta's issuer. What remains: 4, the access service with the provider glue, in
the private repository (ADR-014), and 6, the renewal in the keeper, which needs 4.

1. `hub/src/auth.ts`: a middleware that accepts either the secret or a key; key
   verification with `crypto.verify('ed25519')` from Node; the public key from
   `HUB_ACCESS_PUBLIC_KEY`; the revocation list from `HUB_ACCESS_URL/v1/revoked` cached an
   hour. Tests: secret only, key only, both, expired key, revoked key, wrong signature.
2. Personal routes: vault and push registration gain an `owner` column filled from the key's
   subject; a secret-only hub (self-hosted) keeps `owner = ''`. Migration adds the column.
3. Rate limit per key in the hub (a small token bucket in memory; the proxy keeps its own).
4. `fidelity-access`: Hono, `node:sqlite`, one table; `providers/paddle.ts` and
   `providers/stripe.ts` behind one interface; `/v1/webhook`, `/v1/renew`, `/v1/revoked`,
   `/v1/public-key`; the two HTML pages. Tests with recorded webhook bodies.
5. App: `accessKey` in the preferences (IndexedDB only, never logged, never in a URL — rule
   6 applies to it as to the token); `x-fidelity-key` on every hub and catalogue call when
   set; Settings › Access (enter, test, remove) and Settings › Support (the list of §6.3);
   the one-line "what it would take" on a comfort feature that is off.
6. The renewal in the keeper: once a day, if the key is older than 30 days, `/v1/renew`.

### 8.3 Ops (M23)

**Progress, 2026-09-12:** 1 (`tests/e2e/smoke/`, `playwright.smoke.config.ts`, the nightly
`Smoke` workflow against the home lab's public name), 2 (`catalogue/scripts/load.ts` with
`autocannon`, a floor in CI; measured on the home lab past the proxy: ~1,750 requests a
second for a family and for credits on the real build, p50 10 ms), 3 (`hub/scripts/backup.ts`,
`restore-drill.ts`, the `hub-backup` service), 4 without the rehearsal (`compose.cloud.yml`,
`Caddyfile`, `docs/08` §6.1), 5 (the `Promote` workflow and the `stable` channel). The
build-date alert is `"stale":false` in the catalogue's health for a keyword monitor. Open:
the Hetzner week, and the offsite copy of the backup volume.

1. `tests/e2e/smoke/` with a `BASE_URL` env: the routed specs already written run against
   staging; a nightly workflow with the home lab's public name.
2. `scripts/load/catalogue.mjs` with `autocannon`; a documented target; a CI job that runs
   it against the mini-dump service for a smoke number.
3. Backups: a Borg job in the compose file for hub and access; a restore drill script that
   starts a throwaway hub from last night's backup and reads health.
4. `compose.cloud.yml`: the same services, Caddy instead of Traefik, an env file; a
   `docs/08` section that walks from an empty CAX21 to a running stack in ten steps; the
   rehearsal, with its timing written down.
5. Release channels: the home lab on `latest`, production on `vX.Y.Z`, a `promote` workflow.

### 8.4 App (M24)

1. Onboarding: a first-run path that a stranger completes — token, sync, first dig — with
   a browser test that starts from an empty profile and never reads a doc.
2. Updates: the service worker's "new version" as a quiet, automatic step on the next
   navigation, with the banner only for a genuinely breaking schema.
3. `whats-new` as the changelog's leads (it already is) plus a per-version "what to do"
   line where one exists.
4. Backup import across versions: the JSON export carries its schema version; import runs
   the same migrations the database does.
5. A self-hosting walk-through from a clean machine, tested by doing it once on a fresh VM.

## 9. What was not verified, and what needs a decision

- Provider fees and portal features: from memory of public pages; check before choosing.
- The size of the audience the tier addresses: `docs/14` §7 guessed 20–50k serious
  collectors worldwide and 2,000 payers as an excellent outcome. Nothing measured.
- Whether a merchant-of-record provider accepts a "support tier that unlocks hosting" as a
  digital service — it should, it is the common case, but their terms are theirs.
- Discogs' answer to the letter. The tier is shaped so that "no answer" is survivable; a
  "no" would move the catalogue features to self-hosting only and leave the hosted hub as
  the tier.
- Prices and names of the plans (§6.3): placeholders.
- Whether the home connection's uptime is good enough for hosted members during M22/M23,
  or whether the Hetzner rehearsal in M23 becomes the move. The plan works either way.
