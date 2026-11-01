# 21 – Threat model

> **Status:** in force · **As of:** 2026-11-01 · **Reporting:** [`SECURITY.md`](../SECURITY.md)

What Sleeveside protects, from whom, and what it leaves to others. The app is a client-only PWA
([ADR-007](adr/007-client-only-pwa.md)): everything worth stealing sits in one browser origin,
so most of this document is about who else can run code in that origin.

---

## 1. Assets

| Asset | Where it lives | Worth to an attacker |
|---|---|---|
| **Discogs personal access token** | IndexedDB `meta.token`, read only by the worker | The account as far as the API reaches: read and write collection and wantlist ([ADR-011](adr/011-fidelity-writes-back.md)), and everything else the token can read. Rule 6 of `CLAUDE.md`: never logged, never in a URL or report |
| **Cloud refresh tokens** (Dropbox, Google Drive) | IndexedDB `meta.cloudTokens` | Long-lived access to the app folder (Dropbox) or `drive.appdata` (Drive) — the scopes are the narrowest each provider has (`app/utils/cloud-vault.ts`) |
| **Vault passphrase** | Typed per sync, never stored, never sent | Decrypts the vault: the whole collection plus every judgement |
| **Judgements** | IndexedDB (grading, notes, places, basket, saved); sealed in the vault for sync | Not recoverable from Discogs — the one thing a wipe really destroys (`worker/vault/status.ts`) |
| **The build itself** | The docroot, the app image | Whoever replaces it owns every token on every device at the next update |

Not assets: marketplace data (public, and gone after six hours anyway), the horizon (derived
from public Discogs data), postage profiles.

## 2. Actors

### 2.1 A co-hosted origin

IndexedDB, the service worker and the Web Lock are bound to the **origin**, not the path. A
second app served from the same scheme, host and port — `example.org/sleeveside/` beside
`example.org/blog/` — reads the token like Sleeveside does.

- **Defence:** none in code; there cannot be one. Deploy on a host of its own
  (`docs/08-DEPLOYMENT.md`). `DEPLOY_BASE_URL` exists for convenience, not as isolation.
- **Residual risk:** a self-hoster who ignores this. Out of scope in `SECURITY.md`.

### 2.2 A third-party script

Any script that runs in the origin has the same reach as the app.

- **Defence:** the shipped Content-Security-Policy (`docs/08-DEPLOYMENT.md`): `script-src
  'self'` plus the hashes of this build's three inline scripts, computed at build time by
  `scripts/csp/write.mjs`; `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
  No analytics, no tag manager, fonts self-hosted.
- The YouTube preview (ADR-012) is a **frame** on `youtube-nocookie.com`, driven by
  `postMessage` — Google's script runs in Google's origin, not ours.
- New dependencies are bundled, not loaded from a CDN, and have to justify their bytes
  (rule 7) — which also keeps the supply chain small.
- Renovate (`renovate.json`) proposes a release only once it is seven days old; CI fails on a
  high or critical advisory in production dependencies (`pnpm audit --prod`); actions and
  base images are pinned by digest; release images and the release zip carry GitHub build
  provenance (`gh attestation verify`).
- **Residual risk:** a compromised npm dependency ends up inside `'self'`. `pnpm-lock.yaml`
  pins it; CSP cannot help.

### 2.3 A hub member

Somebody who shares a hub ([ADR-008](adr/008-optional-hub.md)), or runs it.

- **Cannot** see the Discogs token: the hub has no endpoint that takes one (`shared/ports.ts`).
- **Cannot** read the vault: one block of ciphertext per person, key derived on the device from
  the passphrase (`hub/src/app.ts`); a key reads only the rows it wrote.
- **Can** poison what is shared — horizon sets, postage profiles, covers. Answers go through a
  Zod schema in `worker/hub/client.ts`, time out after 2 s and fall back to the local way
  silently. The damage is wrong suggestions, not code execution or a leaked token.
- **Residual risk:** a wrong score or postage figure until the local path re-checks it.

### 2.4 Hostile dealer text

Dealer names, listing comments, release titles and notes come from strangers via Discogs.

- **Defence:** rendered by Vue interpolation only. No `v-html` anywhere in `app/` — the release
  notes are parsed by hand for that reason (`app/utils/release-notes.ts`). Inventory passes a
  Zod schema at the boundary (`worker/discogs/`). Links in text are not followed or fetched;
  images load lazily from `i.discogs.com` only (CSP `img-src`).
- **Residual risk:** misleading text — a comment that says "contact me off-site". That is the
  marketplace's problem, and the app shows the text as text.

### 2.5 A stolen deploy key

`DEPLOY_KEY` in GitHub Actions (`.github/workflows/deploy.yml`) writes to the docroot.

- Whoever holds it ships a build of their own, the service worker installs it on the next
  visit, and that build reads every token. **This is the worst case in the list.**
- **Defence:** the key is for this deployment only, scoped to a GitHub environment, and held
  as a secret, not a variable. The owner should restrict it on the server side as well:
  a dedicated deploy user that owns the deployment path and nothing else, with
  `restrict,from=…` in `authorized_keys`. A forced `rrsync` command does not fit as it
  stands — the same key also runs `rm -rf`/`mkdir` on `.incoming`, `chmod` and `publish.sh`,
  and `readlink` on `current` (`deploy.yml`), and `rrsync` refuses all of that. Narrowing it
  further means a forced-command wrapper that checks `$SSH_ORIGINAL_COMMAND` against exactly
  those calls, and changing it whenever the workflow's commands change.
- The server's host key is pinned in `DEPLOY_KNOWN_HOSTS`, not scanned on each run, so a
  spoofed host cannot collect the upload.
- **Residual risk:** the docroot itself. Rotate the key and redeploy if it may have leaked;
  every user then gets the clean build with the next update.

## 3. Deliberately not defended

- A compromised device, browser or browser extension. An extension with access to the site
  reads IndexedDB like the app does.
- Somebody holding the unlocked phone. There is no app PIN; the device lock is the lock.
- Discogs itself, Dropbox or Google.

## 4. When to update this

When a new place starts holding a secret, a new origin gets a frame or a connection, the hub
gets an endpoint that returns something the client acts on, or a new way to deploy appears.

## 5. Reporting

[`SECURITY.md`](../SECURITY.md), and `/.well-known/security.txt` from
`public/.well-known/security.txt`. That file has an `Expires` date; `tests/unit/security-txt.spec.ts`
turns red a month before it runs out.
