# Fidelity

> The clerk behind the counter — for Discogs.

Discogs is a search engine, not a record shop. It answers *"do you have record X?"*
perfectly and *"what would you have for me?"* not at all.

**Fidelity** reads a Discogs dealer's stock, matches it against your collection and your
wantlist, and hands back a scored list of finds — **with a sentence of reasoning for
every one.**

```
You: "fatplastics"
Fidelity, two minutes later:

  74 · Top Five
  Hemmann + Kaden – Guten Tag EP · Freude Am Tanzen FAT 016 · 12", EP · 2003 · €5.00
  Wighnomy Brothers worked on this — you have 3 records of theirs.
  Also: label Freude Am Tanzen, catalogue run FAT.
```

**A browser app and nothing else. No backend, no database, no running costs.**
All of it stays on your device.

---

## What it does

**Dig.** Enter a dealer's name, or the link to their Discogs page. Fidelity reads their
stock and scores every record against your taste. Eleven signals, a score from 0 to 100, a
sentence saying why. Very large shops get a deep scan across thirteen orderings, and shops
you already know get "only what is new" since your last visit.

**Understand why.** Every find says which signals fired and what they were based on: an
artist in your collection, a wish on your wantlist, a label you follow, a gap in a
catalogue run, somebody who appears in the small print of your favourite records. None of
it is a black box.

**The basket.** One per dealer, because postage is charged per parcel. Postage tiers, the
marginal cost of each further record, and the question "what would fit €50?" with an
answer.

**Your collection.** Shelf, map and wantlist. The map shows where your collection is dense
and where the gaps are — by label, decade and style.

**In the shop.** With the record in your hand: "do I have this already?" Answered from the
device, with no signal. Record shops are basements.

**Shops.** What a dealer actually stocks, how well they fit you, and whether their stock
has moved since your last visit.

**Try it without signing in.** The start page demonstrates it on one record, with no token
and no account. Real machinery, not a mock-up.

**In English or German.** Picked from your device the first time, changed under
Settings → Appearance whenever you like.

---

## Getting started

A **personal access token** from
[discogs.com/settings/developers](https://www.discogs.com/settings/developers) is all you
need. It stays on your device.

Three ways in, depending on how much you want to run yourself:

| | for whom | what you need |
|---|---|---|
| **[Upload it](#on-your-own-webspace--without-installing-anything)** | you have webspace and want no more than that | FTP access |
| **[On your network](#on-your-own-network-with-docker)** | NAS, Raspberry Pi, homelab | Docker |
| **[Build it](#building-it-and-working-on-it)** | your own server, or an interest in the code | Node |

None of the three is a cut-down version. The first *is* the whole app — everything else
only makes it faster.

### On your own webspace — without installing anything

Every [release](https://github.com/misterhonk/fidelity/releases) has the finished site
attached as a zip. Download it, unpack it, put the contents in your docroot. That is all —
no Node, no pnpm, no Docker.

Two things the webspace has to do, or it breaks somewhere inconspicuous:

**Addresses need handling.** Every known page is written into its own directory at build
time, so `/basket` really exists — but a bare web server answers it with a redirect to
`/basket/`, and a trailing slash is a different address to the app than one without.
Anything not foreseen at all has to fall back to `200.html`, so the app can answer instead
of a 404.

**`sw.js` must not be cached for long.** The service worker decides when everything else
updates — if it is stale itself, the app can never be repaired again. Everything under
`/_nuxt/` may be kept forever, on the other hand; those filenames carry a hash.

Both are ready to use: [`deploy/.htaccess`](deploy/.htaccess) for Apache — just put it in
the docroot too — and [`deploy/nginx.conf`](deploy/nginx.conf) for nginx.

### On your own network, with Docker

One file, no source, nothing to build:

```bash
curl -O https://raw.githubusercontent.com/misterhonk/fidelity/main/deploy/compose.homelab.yml
docker compose -f compose.homelab.yml up -d
```

Prebuilt images, **arm64 included** — a home server is often a Raspberry Pi. Afterwards the
app is at `http://127.0.0.1:3000`, local only on purpose; `APP_BIND=0.0.0.0` opens it to
your network so the phone can reach it too.

> If `pull` stops with `unauthorized`, the images are still private — GHCR sets new
> packages that way by default. Then go via the source: clone the repository and run
> `docker compose up -d`, which builds locally.

Updating is `pull` and `up`:

```bash
docker compose -f compose.homelab.yml pull && docker compose -f compose.homelab.yml up -d
```

The hub is in that file and **optional** — delete the block and everything works the same,
only slower the first time. For access from outside without opening a port on your router,
there is a tunnel profile in [`compose.yml`](compose.yml).

### Building it, and working on it

```bash
corepack enable     # brings exactly the pnpm version this project expects
pnpm install
pnpm dev            # http://localhost:3000
```

`corepack` ships with every Node from 16.9 on — you do not have to install pnpm.

It also works without Node on your own machine: the project brings a
[devcontainer](.devcontainer/devcontainer.json). In VS Code, "Reopen in Container", or
straight into GitHub Codespaces. Node, pnpm and every dependency are set up for you.

For your own deployment:

```bash
pnpm build
rsync -av --delete .output/public/ your-server:/path/to/docroot/
```

Details and alternatives: [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) and
[`docs/10-DEPLOYMENT-ALTERNATIVEN.md`](docs/10-DEPLOYMENT-ALTERNATIVEN.md). How work is
done here: [`CONTRIBUTING.md`](CONTRIBUTING.md).

> **A note on HTTPS:** if you serve the app over `https://`, it can only reach a hub on
> `http://localhost` in Chrome — Safari refuses it (measured 2026-08-10, see below).
> Anybody using the hub is better off giving it an HTTPS address of its own.

### The hub — optional

A small service you can run yourself. It remembers what is the same for everybody: what
Fidelity has worked out about artists and labels, postage per dealer, record covers. Then
not every device has to fetch it for itself, and people sharing a hub work for each other.

```bash
cd hub && docker compose up -d
```

**No feature depends on it.** Without a hub everything works the same, it only takes
longer the first time. It never sees your Discogs token — there is nowhere it could accept
one. [`docs/13-HUB-ADDON.md`](docs/13-HUB-ADDON.md),
[ADR-008](docs/adr/008-optionaler-hub.md).

---

## Also useful as …

**An offline reference.** Sync once and your collection is on the device. The "in the shop"
screen answers "do I have this already?" with no network — that never needs a dig.

**A map of your collection.** Where it is dense, where the gaps are, which labels you
actually buy rather than believe you buy. Costs not a single request once the collection is
there.

**A demonstration with no account.** The start page runs without a token. Anybody who wants
to know what the app does need not hand anything over.

**A shared hub for a group.** A record club, a shared flat, a circle of friends: one hub on
one machine, and the work one person puts in benefits everybody. Nothing personal is in it
— apart from the encrypted block your own devices use to find each other, which the hub
cannot read.

**A way out.** Every dig can be written to a file, and so can the collection. Prices and
conditions stay out; those may not be passed on.

---

## How it works

The whole design rests on five measured facts — not on assumptions. All of them checked
live against `api.discogs.com`, with a date.

1. **Discogs allows CORS** (`access-control-allow-origin: *`, `authorization` permitted).
   That is why this app needs no backend. *(2026-08-09)*

2. **The limit of 60 requests a minute is per IP** — and in a browser that is the *user's*
   IP. Thirty users are thirty budgets rather than one. The hardest scaling limit of a
   server design disappears. *(2026-08-09)*

3. **The rate-limit headers are not in `expose-headers`, and the 429 arrives without CORS
   headers.** So JavaScript sees neither how much budget is left nor that it was
   exceeded — only a rejected `fetch()`. Which means driving blind: 1,200 ms with a token,
   2,400 ms without, exactly one request at a time, across every tab. *(2026-08-10)*

4. **`/artists/{id}/releases` carries a `role` field** (`Producer`, `Remix`, `Engineer`).
   Conny Plank's complete work is 1,095 entries in 11 requests. That is why this app does
   not need the 10.4 GB catalogue dump. *(2026-08-09)*

5. **The inventory endpoint returns no images at all.** `release.thumbnail` is empty in
   1,200 of 1,200 rows across four shops — while the same releases fetched individually
   have between 1 and 29 images. So covers come from a store of their own: free from the
   collection, otherwise one at a time and only for what is on screen. *(2026-08-10)*

The rules that follow from those are in [`CLAUDE.md`](CLAUDE.md) — short enough to read
before changing anything.

### Layout

```
app/       Nuxt: pages, components, composables. Presentation only.
worker/    Web Worker: scanning, matching, scoring, horizon. This is where work happens.
db/        IndexedDB schema and access.
shared/    Types, and the protocol between the main thread and the worker.
hub/       The optional service. Its own package, its own tests.
docs/      Concept, architecture, measured API facts, ADRs.
```

The main thread does not compute. Everything that costs time runs in the worker —
otherwise a list of twenty thousand entries stutters when you scroll it.

```
Framework  Nuxt 4.5 (ssr: false, static) · Vue 3.5 · TypeScript strict
Storage    IndexedDB via idb · horizon packed as Int32Array
Auth       Discogs personal access token, local only
UI         Tailwind CSS 4 · OKLCH tokens (DTCG) · glyphs of its own
Language   English and German, no i18n package (ADR-010)
PWA        Offline, installable
Tests      Vitest · Playwright including WebKit · axe-core · size-limit
Hub        Node ≥ 22.5 · Hono · node:sqlite — no native dependencies
Backend    none
```

---

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) explains the tools, the testing obligations and the
rules that are not up for negotiation.

> **`docs/` is still German.** The interface, the code and this file are English since
> [ADR-010](docs/adr/010-englisch-als-grundsprache.md); the documents underneath are the
> largest and least urgent part of that move, and they are being translated last. Nothing
> in them is required reading to contribute — `CLAUDE.md` and this README carry the rules
> — but if a document you need is in the way, say so in an issue and it moves up the list.

## Documentation

| Document | Contents |
|---|---|
| [`docs/00-KONZEPT.md`](docs/00-KONZEPT.md) | Vision, naming, competition, backlog |
| [`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) | System design, Discogs client, horizon |
| [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md) | API reference, measured limits, CORS, traps |
| [`docs/03-DATENMODELL.md`](docs/03-DATENMODELL.md) | IndexedDB stores, TypedArray packing |
| [`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) | The eleven signals, Barry score, reasoning |
| [`docs/05-DESIGN-SYSTEM.md`](docs/05-DESIGN-SYSTEM.md) | Tokens, components, accessibility, PWA |
| [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md) | M0–M10 with a definition of done |
| [`docs/07-DEV-PIPELINE.md`](docs/07-DEV-PIPELINE.md) | CI, conventional commits, release-please |
| [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) | Static hosting — one rsync |
| [`docs/09-LEGAL.md`](docs/09-LEGAL.md) | Discogs terms, GDPR, accessibility law |
| [`docs/10-DEPLOYMENT-ALTERNATIVEN.md`](docs/10-DEPLOYMENT-ALTERNATIVEN.md) | Where else it can run |
| [`docs/11-KATALOG-STRATEGIE.md`](docs/11-KATALOG-STRATEGIE.md) | Why no 10.4 GB dump is needed |
| [`docs/12-RESSOURCEN-BUDGET.md`](docs/12-RESSOURCEN-BUDGET.md) | Bundle, storage, compute, requests |
| [`docs/13-HUB-ADDON.md`](docs/13-HUB-ADDON.md) | The optional server add-on |
| [`docs/adr/`](docs/adr/) | Architecture decision records, including the rejected ones |

---

## Licence

[**GNU AGPL-3.0**](LICENSE). Take it, run it, rebuild it. The one condition: if you pass on
a modified version **or host one for other people**, your source has to be open under the
same licence.

That is deliberate and not an obstruction. Fidelity is a project with no intent to profit,
and the AGPL is the licence that keeps it that way — including in the version somebody else
puts on the internet. Anybody meaning well satisfies it with a link to their source.

Without warranty, and here that is not merely a formula: this app works with its users'
Discogs accounts.

---

This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
