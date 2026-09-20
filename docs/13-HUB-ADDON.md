# 13 – The hub: an optional server add-on

> **Fidelity works completely without a hub.** The hub is a tiny, self-hostable service that
> enriches the experience — never a requirement.
> Status: **planned for M9**, but the seams are being built in M2/M5 already.

---

## 1. The principle

```
No hub configured              A hub configured
─────────────────────          ─────────────────────────────────
The app runs fully       →     The app runs fully
Horizon: 13 min to build →     Horizon: seconds (a shared cache)
Shipping tiers from JSON →     Shipping tiers from the community
Watchlist on opening     →     Push, when something moves
Digs stay local          →     Digs in step between your devices
```

**The rule that is never broken:** no feature may *require* a hub. The hub is an
accelerator, not a foundation. Switch it off and you lose convenience — never functionality.

There is exactly one field in the settings:

```
Hub URL (optional)   https://hub.mister-honk.de
                     [ Test the connection ]
```

Empty = everything local. Set = the app uses it where it helps, and falls back quietly to
the local route on any error.

---

## 2. What the hub can do – and what it deliberately cannot

### ✅ Worthwhile

| Feature | Benefit | Needs a token? |
|---|---|---|
| **Horizon cache** | Whoever has expanded Conny Plank already saves everybody else 11 requests. With three users, first-time setup shrinks from 13 min to seconds | ❌ no |
| **Shipping tiers** | One person enters them, everybody has them. Replaces the pull-request route | ❌ no |
| **The change watcher** | Polls `num_for_sale` per watched dealer — **1 request instead of 100** — and sends a push on a change | ❌ no |
| **Web Push** | The only route to real notifications. Strictly requires an application server | ❌ no |
| **Device sync** | Desktop and phone share wantlist notes, the basket, feedback | ❌ no |
| **Sharing a dig** | Upload a dig, send Jens the link | ❌ no |

> **The most important find: none of that needs the Discogs token.**
> `GET /users/{username}` works **unauthenticated** (25 req/min). The watcher polls only
> `num_for_sale`, compares it with the last value and sends a push on a difference. The
> actual scan is then done by the client again — on its own rate-limit budget.

### ❌ Deliberately not

| Not building | Why |
|---|---|
| **Server-side scanning as the default** | The hub has *one* IP. All users would be sharing 60 req/min again — the very limit we just got rid of |
| **Storing Discogs tokens** | A token gives full access including write rights to the collection, wantlist and orders. There are no scopes. That does not belong on somebody else's machine |
| **User accounts with passwords** | Nobody needs them. Access through a shared hub secret is enough for a circle of friends |
| **The hub as a Discogs proxy** | Would be borderline under the ToS ("circumvent rate limits") and makes it the bottleneck |

> ⚠️ **An optional exception, explicitly opt-in:** anybody who *wants* to can store their
> token in the hub so that it scans fully overnight. It must carry an unmistakable warning
> and is **never the default**. On a hub you host yourself and that serves only friends, that
> is defensible — the user makes the decision.

---

## 3. The seams in the client

**This is the part that has to be built now.** Three interfaces behind which a hub
implementation can sit later, without the matching engine or the UI noticing anything.

```ts
// shared/ports.ts — the only places a hub can attach

export interface HorizonSource {
  /** Fetch the edges for an entity. The hub is asked first, the API is the fallback. */
  fetch(kind: 'artist' | 'label' | 'master', id: number): Promise<HorizonChunk | null>
  /** Offer up after expanding ourselves. A no-op without a hub. */
  contribute?(chunk: HorizonChunk): Promise<void>
}

export interface ShippingProfileSource {
  get(dealer: string, toCountry: string): Promise<ShippingTier[] | null>
  contribute?(dealer: string, toCountry: string, tiers: ShippingTier[]): Promise<void>
}

export interface WatchService {
  /** Without a hub: a check at app start. With a hub: push. */
  register(dealers: string[]): Promise<void>
  pending(): Promise<WatchAlert[]>
}
```

The implementations:

```
worker/horizon/source-api.ts    ← the default: straight to Discogs
worker/horizon/source-hub.ts    ← from M9: the hub first, then the API fallback

worker/shipping/source-bundled.ts   ← shipping-profiles.json from the build
worker/shipping/source-hub.ts       ← from M9

worker/watch/service-local.ts   ← a check at app start
worker/watch/service-hub.ts     ← from M9: a push subscription
```

**The effort now: three interfaces and a fallback chain.** Maybe an hour. Without them M9
would be a refactoring right across the worker.

### The fallback chain

```ts
// Every hub query is optimistic and fails silently.
// A broken or switched-off hub must NEVER block the app.
async function fetchHorizon(kind, id) {
  if (hubUrl) {
    try {
      const hit = await withTimeout(hub.horizon(kind, id), 2000)
      if (hit) return hit
    } catch { /* deliberately quiet – we simply fall back */ }
  }
  const fresh = await api.expandEntity(kind, id)
  void hub?.contribute(fresh)          // fire and forget
  return fresh
}
```

**A 2-second timeout, no retry.** A slow hub is worse than no hub.

### And what was already there

The chain above only applies when something is fetched at all. But the horizon run skips
everything that is already local and fresh — and until 2026-08-13 it skipped the
contribution with it. For the most common route, using the app first and entering the hub
afterwards, that meant: **nothing ever went up.** Measured, one entry at the hub against
hundreds on the device; the shared cache, the only reason the hub exists, was dead — and
nothing about it looked broken.

Skipped blocks are therefore sent on afterwards, once per block. That costs no Discogs
request — the block is already there — and `sharedAt` on the record remembers what is up.
**It is only remembered after an accepted response**, or a wrong secret would be a block that
never goes up again. At most fifty per run, so that the first run after entering a hub does
not become half a minute of chatter; the limit reports itself in the log rather than quietly
truncating.

---

## 4. The hub itself

Small enough to build in an afternoon and run anywhere.

```
hub/
├── src/
│   ├── app.ts            The Hono app, all the routes
│   ├── watch.ts          Subscriptions, VAPID, the watcher pass
│   ├── db.ts             Schema and access
│   └── server.ts         Start, environment variables, the timer
├── scripts/
│   └── ring-once.ts      Check push end to end (see below)
├── test/
└── package.json
```

**The stack:** Node ≥ 22.6 + **Hono** + **`node:sqlite`**. No driver, no ORM, no Redis, no
native dependency — and therefore no compiler in the image either. The service is started as
TypeScript (`node src/server.ts`), which works without a flag from 22.18.

**Resources:** ~60 MB of RAM, ~50 MB of disk with three users. Runs on Uberspace
(supervisord + `uberspace web backend`), on a home server behind Traefik, on any VPS, or as a
Cloudflare Worker + D1.

### Where it is best placed: next to the app

> **As of 2026-09-12 the hub runs on the home lab** — `fidelity.mrtnmlchr.de/hub`, behind
> Traefik and a Cloudflare tunnel, see `docs/14` §8 — and the Uberspace copy described below
> is switched off: its supervisord unit is retired and the `/hub` backend deleted, source and
> database left in place. `hub.yml` with "ausliefern" would bring it back; do not run it
> unless that is the intention. The section stays as the record of how it was placed.


The obvious answer — on the home network — is the worse one as soon as the app is served over
`https`. A hub at `http://localhost` is **mixed content** from there, and WebKit rejects that
hard (measured 2026-08-10); on an iPhone a perfectly running hub is then simply unreachable.

Under **the same domain as the app** all of that falls away — same origin means no CORS, no
mixed content, no second certificate, no DNS entry:

```
martinmelcher.de/fidelity/   the app (static files)
martinmelcher.de/hub         the service on port 8787, prefix stripped
```

`.github/workflows/hub.yml` sets up exactly that — separate from `deploy.yml` and by hand
only, because ADR-008 applies to more than the code: a failure at the hub must not take the
app with it.

> ⚠️ **The downside: the app and the hub drift apart, and quietly.**
>
> The release workflow does build a hub image but does **not** deploy it to Uberspace. On
> 2026-09-11 the app stood at 0.24.0 with the share button while the running hub was still
> the version before: `GET /v1/share/{id}` answered **401 instead of 404**, because the route
> did not exist there and the auth layer rejects anything unknown. A shared link would have
> been dead for anyone without the secret — that is, for exactly the people it is made for.
>
> It was only noticed because after the release the **running** server was checked, not the
> local one. The tests were green, the browser was green, and the feature was broken in the
> wild all the same.
>
> **After every release that touches the hub:** run `hub.yml` with `deploy` and then check
> the three doors —
>
> ```
> GET  /v1/share/<random>  → 404   (reading works without the secret)
> POST /v1/share           → 401   (writing does not)
> GET  /v1/covers          → 401   (the other doors stay shut)
> ```
>
> A 401 at the first of these means: the hub is old.

**The client looks in this order:** `<origin>/hub`, then the bare origin, then
`http://localhost:8787` in both spellings. Whatever answers without a secret is entered
without asking; whatever demands one is only filled in — the word cannot be discovered, which
is what makes it one.

### The API

```
GET    /v1/horizon/:kind/:id           → HorizonChunk | 404
PUT    /v1/horizon/:kind/:id           ← contribute a chunk
GET    /v1/shipping/:dealer/:country   → { tiers, confirmedBy } | 404   (one vote per key, M34.3)
PUT    /v1/shipping/:dealer/:country   ← contribute tiers; answers { stored, confirmedBy }
GET    /v1/covers?ids=1,2,3            → { covers: { releaseId: {thumbUrl, coverUrl} } }
PUT    /v1/covers                      ← contribute { covers: [...] }
GET    /v1/family/:master              → PressingFamilyFacts | 404   (M20 #7, CC0, 30 days)
PUT    /v1/family/:master              ← contribute a family
GET    /v1/vault/:id                   → { sealed, updatedAt } | 404
PUT    /v1/vault/:id                   ← an encrypted block
DELETE /v1/vault/:id                   ← forget a block (moving the identifier)
POST   /v1/watch/subscribe             ← a push subscription + the dealer list
POST   /v1/watch/unsubscribe           ← unregister an endpoint
GET    /v1/watch/key                   → { publicKey }  (VAPID, generated once)
GET    /v1/health                      → { ok, horizon, shipping, covers, families, watching, secured }
```

**Every one of these methods belongs in `allowMethods`.** The client is a page on another
origin, so the preflight is not a formality but the gate. `POST` was missing there until
2026-08-13 — the hub ran, the watcher polled shops, and **no browser could ever subscribe**,
because `/v1/watch/subscribe` is a POST. It survived the day push rang for the first time,
because the subscription then went through `curl`, and curl asks nobody for permission.

**Auth:** a shared secret in the `Authorization` header, generated once at setup. Entirely
sufficient for a circle of friends. No user accounts, no passwords, no sessions.

### Covers — the cheapest win in the whole add-on

The inventory endpoint delivers **no images at all**: `release.thumbnail` is empty, in 1,200
of 1,200 rows across four shops (measured 2026-08-10, see `02-DISCOGS-API.md`). Every cover a
client shows therefore costs it a lookup of `/releases/{id}` of its own — and that returns
the same answer for everybody, permanently, because a cover does not change. Exactly the case
this hub exists for.

**In bulk, not one at a time.** A screen wants about a dozen covers at once. A dozen round
trips to a Raspberry Pi, each with its own two-second limit, costs more than the requests they
are meant to save.

**Empty pairs are stored deliberately.** "Discogs has no image for this release" is worth as
much as an image and costs the same request to find out.

**The addresses are checked at both ends, and that is not a formality.** They land in an
`<img src>` on every device using the same hub — anyone who could write here freely could make
all those devices load arbitrary addresses. Only `i.discogs.com` over HTTPS is accepted, and
**parsed rather than pattern-matched**:

```
https://i.discogs.com.evil.test/x.jpeg      ← survives a naive includes()
https://evil.test/?a=https://i.discogs.com  ← likewise
```

The hub rejects them on the way in, the client rejects them again on the way out. The hub is
precisely the component `worker/hub/client.ts` is written against — an old version, a
misconfigured one, or somebody else's hub. Neither side relies on the other.

### The watcher

```ts
// A cron job, hourly. The only background process in the whole project.
for (const dealer of watchedDealers) {
  const { num_for_sale } = await discogs.get(`/users/${dealer}`)   // no token!
  if (num_for_sale !== lastSeen[dealer]) {
    await push(subscribersOf(dealer), {
      title: `${dealer} has new records`,
      body: `${num_for_sale - lastSeen[dealer]} new listings`,
    })
    lastSeen[dealer] = num_for_sale
  }
}
```

**One request per dealer per hour.** With 20 watched dealers that is 20 of 25 unauthenticated
requests a minute — comfortably within bounds. The full scan stays with the client.

> ⚠️ **`num_for_sale` only detects net changes.** If a dealer sells 3 records and lists 3
> new ones, the number stays the same. As an alarm clock that is still enough: anybody
> actively tending a stock produces movement constantly. And a missed alert is considerably
> less bad than 100 requests per dealer per hour.

**It tells Discogs who it is.** A request with no user agent gets a 403 from Discogs
(`docs/02`). Node's own `node` would get through but is exactly the meaningless
identification a provider eventually blocks — and the failure would be the quietest
imaginable, because a response without `ok` is swallowed and every shop would look unmoved
forever.

**Optionally as a registered application.** If `HUB_DISCOGS_KEY` and `HUB_DISCOGS_SECRET` are
present, the identification goes out as an `Authorization: Discogs key=…` header — not as a
query parameter, since a secret in a URL ends up in every log along the way — and the pacing
goes from 2,400 to 1,200 ms. It is **not** a sign-in as a person; a personal token does not
belong on a shared service (rule 6).

### Ringing it once

A pass only reports growth. That is right, and it makes the chain untestable: after a deploy
you want to know whether VAPID, subscription, delivery and the service worker still fit
together — and not wait days until somebody puts records in.

```
node scripts/ring-once.ts [by-how-much]
```

The script lowers the watcher's **memory**, not reality: the Discogs response is real, the
arithmetic is real, the notification is real, and the pass writes the true number back
afterwards itself. With no recipient or no watched shop it aborts rather than reporting
success — a ring with no ear would be no proof. From a distance, through the workflow, which
knows four positions — `check`, `deploy`, `ring`, `deploy-and-ring`:

```
gh workflow run Hub -f what=ring
```

`ring` does not touch the service. Before, finding Node hung off "not a dry run", so every
ring ran the whole deploy including a restart — four times in one afternoon, just to check a
notification.

---

## 5. Privacy

The hub deliberately stores almost nothing personal:

| What | Personal data | Note |
|---|---|---|
| Horizon edges | ❌ none | Public catalogue facts – who produced what |
| Shipping tiers | ❌ none | Public dealer terms |
| Watched dealer names | ⚠️ indirectly | Reveals collecting interests |
| Push subscription | ⚠️ yes | The endpoint URL of the push service |
| Shared digs | ⚠️ yes | TTL 6 h, deleted after that (a ToS requirement anyway) |
| **The Discogs token** | 🔴 | **Is not stored** (except explicitly opt-in, see §2) |

Anybody running the hub for others needs a short privacy notice. Anybody running it only for
themselves needs nothing at all.

---

## 6. Timing

**M9, after `v1.0.0`.** Not before — for two reasons:

1. Only once the app runs without a hub do you know what the hub would really have to
   contribute. Guesses about that are almost always wrong.
2. The client has to demonstrably work without one. Build both in parallel and dependencies
   creep in inevitably.

**What is prepared in M2/M5:** the three interfaces from §3 together with the fallback chain
and the `hubUrl` field in the preferences. Nothing more.

**Triggers for actually building the hub:**

- Push is noticeably missed
- A third or fourth user arrives and the 13-minute first-time setup grates
- Maintaining shipping tiers by pull request becomes tiresome
- You want digs in step between desktop and phone

Before that: do not build it.


---

## The vault – `PUT`/`GET /v1/vault/{id}`

One block of encrypted bytes per person, so that their own devices can find one another. Not
a cache and not shared: the other routes speed everybody up, this one belongs to somebody.

```
PUT    /v1/vault/{id}   { version, iv, salt, cipher }   → { stored: true }
GET    /v1/vault/{id}                                    → { sealed, updatedAt } | 404
DELETE /v1/vault/{id}                                    → { gone: true }
```

**The identifier** is derived from the **passphrase**, with the Discogs user id as the salt
(PBKDF2, 600,000 rounds, 16 bytes hex). Every device belonging to the same person arrives at
the same identifier with no further input — passphrase and user id are the shared knowledge
anyway.

> **Until 2026-08-13 it hung off the user id alone** (`SHA-256("fidelity-vault:" + id)`), on
> the grounds that a changed passphrase should not orphan everything so far. That was bought
> too dearly: a Discogs user id is public, so anybody with the secret of a shared hub could
> compute the storage location of every co-user. There was nothing to read there — the block
> is encrypted — but downloading and overwriting, yes. On a hub you share with friends, and
> that is exactly what it is built for, that is the wrong default.

Two details of the derivation are deliberate:

- **PBKDF2 rather than SHA-256.** A fast hash over a passphrase turns the identifier into an
  oracle: anybody who sees it can try words offline and know on every hit that they are right.
- **A separate, fixed salt** (`fidelity-vault-id:{userId}`). The encryption's salt is random
  and sits next to the block — you would have to have found it already. The separate prefix
  makes sure no key material follows from the identifier.

**The move** happens at the first sync after the update: nothing at the new identifier → look
at the old one → carry it across → clear the old one away. That is what `DELETE` is for. A
move that left the block at the computable address would have fixed nothing.

**The price the old reasoning named remains** — only handled: a changed passphrase now moves
the location too. "Cannot be opened" becomes "there is nothing there", which looks like a
first-time setup, while in truth two devices run alongside each other from then on. So the
client says so explicitly when a store is empty even though this device has synced before.

**The hub checks the envelope and nothing else** — four fields, otherwise a 400. That keeps
the table from becoming a pastebin for anybody who can reach the hub. It cannot check the
content and should not: it has no key.

**The limit:** 32 MB per block. A whole horizon including the shortlist fits several times
over, and a client gone haywire cannot fill a Raspberry Pi's card overnight.

**404 is the normal first answer.** A device that has never written asks into the void —
that is not an error and not something that deserves a log entry.
