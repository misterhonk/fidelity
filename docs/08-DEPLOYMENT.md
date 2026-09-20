# 08 – Deployment

> **There is nothing to deploy but static files.**
> No server, no database, no migrations, no backups, no monitoring stack.
> See ADR-007.

---

## 1. What gets built

```bash
pnpm build          # nuxt generate  →  .output/public/
```

The result: HTML, JS, CSS, a service worker, a manifest, icons. **A few hundred
kilobytes.** No Node at runtime, no process that has to be running.

**What the hosting has to provide:**

- HTTPS (mandatory for the service worker, PWA installation and handling the token)
- An SPA fallback: every unknown path goes to `index.html`
- Correct MIME types, `Cache-Control: immutable` for hashed assets
- A few security headers

Any web server can do that. There is no reason to pay for it.

---

## 1a. Everything by Docker

Two services that know nothing about each other. That is not tidiness, it is ADR-008: the
app must work with the hub switched off, so both are **configured separately and started
separately**, and neither waits for the other.

```bash
cp .env.example .env

docker compose up -d app          # the app only
docker compose up -d app hub      # a home-network setup
```

| File | What is in it |
|---|---|
| `deploy/app.Dockerfile` | Two-stage: Node builds, **nginx serves**. No Node runs at runtime — there is nothing that would need to. 62 MB. |
| `deploy/nginx.conf` | The SPA fallback, cache headers, security headers |
| `deploy/hub.Dockerfile` | Node 24 Alpine, runs as `node`, `/data` as a volume, a healthcheck on `/v1/health` |
| `compose.yml` | Both services plus two tunnel profiles |
| `.env.example` | Ports, bind addresses, the hub secret, the tunnel token |

**`APP_BIND` is the one decision you make deliberately.** The default is `127.0.0.1` — this
machine only. `0.0.0.0` makes the app reachable across the home network, including on the
phone on the sofa.

**Cache headers that matter.** Hashed assets under `/_nuxt/` get a year of `immutable`; the
service worker and the shell get `no-cache`. A cached `sw.js` is an app that can never be
repaired again.

**Routes without a redirect.** Nuxt writes every route as its own directory; `/saved` is in
truth `saved/index.html`. `try_files … $uri/index.html` serves it directly; with `$uri/`,
nginx would redirect to `/saved/`, and a trailing slash is a different URL to the router, the
precache and the bookmark.

### From elsewhere

```bash
docker compose --profile tunnel-quick up -d   # a throwaway address, printed in the log
docker compose --profile tunnel up -d         # a fixed address, needs TUNNEL_TOKEN
```

> ⚠️ **A tunnel serves the app, not your data.** Collection, wantlist, digs and the token
> live in IndexedDB — per device **and per origin**. A quick tunnel gets a new hostname on
> every restart, and a new hostname is a new origin: the phone starts from nothing and would
> sync its own copy of Discogs.
>
> So for anything you use more than once: a **named tunnel with a fixed address**. Then what
> was synced once stays on the phone.
>
> What actually *is* shared is the hub — and it deliberately holds nothing personal
> (ADR-008): horizon chunks and shipping tiers, nothing else.

**The hub belongs behind a tunnel only when `HUB_SECRET` is set.** Empty means open; fine on
a home network, not on the internet.

---

## 1b. Keeping devices in step

Four targets, one of them empty. Everything that leaves the device is AES-GCM ciphertext with
a key derived from your passphrase — so where it is stored does not matter.

| Target | Runs on | A third party involved | What you need |
|---|---|---|---|
| This device only | anywhere | – | nothing |
| Your hub | anywhere, including an iPhone | – | the hub address |
| A file in a sync folder | **Chromium only** | your cloud client, not the app | a file |
| Dropbox / Google Drive | anywhere, including an iPhone | yes | your own client id |

**Not included:** the Discogs token (rule 6 — each device signs in once, itself) and digs
(rule 4 — prices are deleted after six hours).

### Set it up once, then it looks after itself

Choose a target, set a passphrase, sync once. After that it runs along when the app opens,
throttled to at most every five minutes and **never waited on** — a target that happens to be
unreachable does not hold anybody's screen. When it last worked is in the settings; that is
where you would look anyway.

**The passphrase may stay on the device** — by default it does. That looks like the key next
to the lock and is not one: the lock is on the copy that is far away. The local database is
unencrypted and always has been; the collection, the shortlist and the Discogs token have
long been in it. Putting the passphrase beside them gives nobody anything that possession of
the device does not already give.

On a shared machine that is a different question. Then uncheck it — the passphrase is
deleted, and every sync asks again.

### Dropbox and Drive: your own registration

There is no Fidelity server and therefore no Fidelity app at Dropbox or Google. You create
your own and enter the **client id** — public by design, since PKCE needs no secret.

**Dropbox** → `dropbox.com/developers/apps` → *Scoped access*, *App folder*.
Permissions `files.content.read` and `files.content.write`. The *app key* is the client id.

**Google Drive** → `console.cloud.google.com/apis/credentials` → an OAuth client id, type
*Web application*, enable the Drive API. Fidelity asks only for `drive.appdata`: a hidden
directory only this app can see — it cannot reach your own files.

> ⚠️ **The redirect URL has to match exactly.** The settings screen shows it for copying.
> Which rules out a quick tunnel: every restart is a new address and a new registration. For
> Dropbox and Drive you need the **named** tunnel or a fixed deployment.

---

## 2. Options

| Option | Cost | Effort | Note |
|---|---:|---|---|
| **An Uberspace docroot** | you have it | rsync in CI | Your own domain, a German provider. No more 1.5 GB RAM limit, because nothing runs. |
| **Cloudflare Pages** | €0 | git push | A global CDN, preview deploys per PR, automatic TLS |
| **GitHub Pages** | €0 | Actions | The simplest, when the repository is there anyway |
| **A home server + Caddy** | electricity | a container | Static files only now — availability matters less than it did with the server design |

> **The old trade-off is gone.** `10-DEPLOYMENT-ALTERNATIVES.md` compared Uberspace, a VPS
> and a home server in terms of RAM, disk and outbound IP. None of that matters now: there
> is no process, no database, and the Discogs requests go out from the **user's** IP.
>
> **Recommendation: the Uberspace docroot**, because you have it and want your own domain.
> Cloudflare Pages as a second route for preview deploys per pull request.

---

## 3. Uberspace

### Once

```bash
uberspace web domain add fidelity.example.de     # TLS comes automatically
mkdir -p ~/html/fidelity
```

The SPA fallback and the headers go in `~/html/fidelity/.htaccess`:

```apache
# SPA fallback: anything that is not a real file goes to index.html
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Cache hashed assets forever, index.html never
<FilesMatch "\.(js|css|woff2)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest)$">
  Header set Cache-Control "no-cache"
</FilesMatch>

Header set X-Content-Type-Options "nosniff"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Strict-Transport-Security "max-age=31536000"
Header set Content-Security-Policy "default-src 'self'; \
  connect-src 'self' https:; \
  img-src 'self' https://i.discogs.com data: blob:; \
  script-src 'self' https://www.youtube.com 'sha256-…' 'sha256-…' 'sha256-…'; \
  style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; \
  frame-src https://www.youtube-nocookie.com https://www.youtube.com; \
  frame-ancestors 'none'; base-uri 'self'; object-src 'none'; manifest-src 'self'; form-action 'self'"
```

> **Shipped since M34.5 (2026-09-16), and computed rather than typed.** The three hashes are
> those of Nuxt's two inline scripts and the import map of *this* build; `scripts/csp/write.mjs`
> runs after `nuxt build` and writes `.output/htaccess` and `.output/nginx.conf`, which the
> deploy workflow and the app image copy. `connect-src` is `https:` and not a host list,
> because the hub and the catalogue are origins the user names and the vault talks to
> Dropbox and Google — what stays forbidden is any `http:`, `ws:` or `data:` connection, and
> any script that is not this build's. A tighter `connect-src` would need the hub origin at
> build time, which a self-hosted app does not have.

### Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { tags: ['v*'] }
  workflow_dispatch:

permissions: { contents: read }

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@<SHA>
      - uses: pnpm/action-setup@<SHA>
      - uses: actions/setup-node@<SHA>
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: SSH key
        run: |
          mkdir -p ~/.ssh && echo "${{ secrets.UBERSPACE_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.UBERSPACE_KNOWN_HOSTS }}" > ~/.ssh/known_hosts

      # One rsync. That is the whole deployment.
      - name: Upload
        run: |
          rsync -az --delete --exclude='.htaccess' \
            .output/public/ \
            ${{ secrets.UBERSPACE_USER }}@${{ secrets.UBERSPACE_HOST }}:html/fidelity/

      - name: Smoke test
        run: curl -fsS https://fidelity.example.de/ | grep -q "Fidelity"
```

No build secret is needed — the app has no consumer secret, because it does no OAuth.

**Rollback:** check out the previous tag, `pnpm build`, rsync. Or straight from the Actions
artefact of the last green build.

### When a release only half runs through

Happened on 2026-08-12 with 0.16.0: `release-please` **created** the release and then bailed
out while tidying up labels. Because `site`, `images` and `deploy` hung off an output of that
job, all three were skipped — the tag and the release stood, there was no zip, no images, and
the site carried on running the previous version.

**Since then it repairs itself.** The workflow no longer asks "did release-please just create
something" but "is there a release with the zip missing" — and the zip is the evidence that
the rest ran. So a half release is finished off on the next push to `main`, and a complete
one never triggers anything again.

For anyone who does have to do it by hand:

```bash
# 1. The zip, exactly as the site job builds it — from the tag, not the working tree.
git checkout v0.16.0 && pnpm install --frozen-lockfile && pnpm build
sed "s|__FIDELITY_BASE__|/|" deploy/.htaccess > .output/public/.htaccess
cp deploy/LIESMICH.txt .output/public/LIESMICH.txt
(cd .output/public && zip -qr ../../fidelity-v0.16.0.zip . -x '.DS_Store')
gh release upload v0.16.0 fidelity-v0.16.0.zip --clobber

# 2. Images and deploy. **Always with --ref on the tag**: without it, the images
#    only get a SHA tag, so neither 0.16.0 nor latest.
gh workflow run images.yml --ref v0.16.0
gh workflow run deploy.yml --ref v0.16.0 -f dry_run=true   # check first
gh workflow run deploy.yml --ref v0.16.0 -f dry_run=false  # then do it
```

> ⚠️ **A service-worker trap:** after a deploy, old clients carry on until the SW updates.
> Configure `@vite-pwa/nuxt` with `registerType: 'prompt'` and offer the user "a new version
> is available — reload". **No `skipWaiting` without a prompt** — otherwise we swap the code
> out in the middle of a running dig.

---

## 4. Local development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

No Docker needed. No database, no compose stack, no seed. All you need is a Personal Access
Token from `discogs.com/settings/developers`.

> Docker stays optional as a prod-parity check (`docker run` with a static web server plus an
> `.htaccess` equivalent), but it is superfluous for daily work.

### Mobile testing

PWA installation and the service worker need HTTPS. Two routes:

```bash
# a) A Cloudflare tunnel against the dev server
cloudflared tunnel --url http://localhost:3000

# b) A staging domain on Uberspace
uberspace web domain add fidelity-stage.example.de
# its own folder ~/html/fidelity-stage, deploying from main rather than from tags
```

Recommendation: **both**. The tunnel for fast iteration on the phone, the staging domain for
anything that needs a stable origin — IndexedDB and the service worker are bound to the
origin, and a changing tunnel hostname throws everything away on every start.

---

## 5. Operations

There are none.

| The old task | Now |
|---|---|
| Watch the supervisord services | gone |
| PostgreSQL backups | gone — the data lives with the user and is reproducible from the API |
| Watch the RAM limit | gone |
| Watch the disk quota | a few hundred kB |
| Roll out migrations | the IndexedDB upgrade runs in the client |
| Load the catalogue dump | gone (see `11-CATALOGUE-STRATEGY.md`) |
| Manage the rate-limit queue | gone — every user has their own budget |

**What remains:**

- The uptime of the static hosting (Uberspace handles that)
- The bundle budget in CI (see `12-RESOURCE-BUDGET.md` §7)
- Optionally Sentry for client errors — **without** session replay, with
  `sendDefaultPii: false` and **redaction of the token** in the `beforeSend` hook

```ts
// The token must under no circumstances end up in an error report
beforeSend(event) {
  const s = JSON.stringify(event)
  return s.includes(getToken()) ? null : event
}
```

---

## 6. When a server does get added after all

### 6.1 One cloud box, in ten steps (M23)

`deploy/compose.cloud.yml` is the home lab's stack for a box that has nothing else on it:
the same four services and the backup, Caddy in front instead of Traefik, and the release
channel `stable` — a production box moves when a release is promoted, not when a build
lands. Cross-checked against a Hetzner CAX21 (4 vCPU ARM, 8 GB, 40 GB) in `docs/17` §5.

1. Create the box (Debian 12, ARM is fine: the images are built for arm64 too) and point
   the name at its address, A and AAAA.
2. `apt install docker.io docker-compose-v2` — or Docker's own repository; either works.
3. `mkdir -p ~/fidelity && cd ~/fidelity`, then fetch `deploy/compose.cloud.yml`,
   `deploy/Caddyfile` and `deploy/cloud.env.example` from the release tag.
4. `cp cloud.env.example .env` and fill in `DOMAIN`, and one door for the hub: `HUB_SECRET`
   for a private box, or `HUB_ACCESS_PUBLIC_KEY` from `scripts/access-keys.ts generate` for
   one with members.
5. `docker compose -f compose.cloud.yml up -d caddy app hub hub-backup` — Caddy fetches the
   certificate; a minute later `https://<DOMAIN>/hub/v1/health` answers.
6. The catalogue: 40 GB of disk is one build, not two. Either
   `docker compose -f compose.cloud.yml up -d catalogue-build` and wait ninety minutes (it
   deletes the download as it goes; 17.5 GB stays), or build at home and copy the file into
   the `catalogue-data` volume as `<date>.sqlite` with a `current` symlink. Then
   `up -d catalogue`.
7. `https://<DOMAIN>/catalogue/v1/catalogue/health` says `"stale":false` and the build date.
8. Point Uptime Kuma (or whatever watches) at the three health routes; for the catalogue,
   a keyword monitor on `"stale":false`.
9. Run the smoke suite against it once: `SMOKE_BASE_URL=https://<DOMAIN> pnpm test:smoke`.
10. Backups: `hub-backup` writes a daily copy into the `hub-backup` volume; copy that
    volume off the box nightly (a storage box, rclone, whatever is at hand), and run
    `docker compose -f compose.cloud.yml run --rm hub-backup node scripts/restore-drill.ts /backup`
    once a month to know the copies are worth something.

The rehearsal itself — a CAX21 for a week, the artefact shipped, torn down — is the step
that costs money and a decision, and it is listed as such in `docs/06` M23.


Only for two things, and both are **additive** — the app keeps working without them:

| Feature | Why a server is needed | A possible route |
|---|---|---|
| **Push notifications** | Web Push needs an application server that delivers to the push service | A Cloudflare Worker, free up to 100k requests a day |
| **Nightly watchlist runs** | A browser does not scan while it is closed | The same worker, with a cron trigger |

> ⚠️ **Careful with a watchlist server:** it would scan from *one* IP — which would bring the
> shared rate limit back. A sensible scope: the worker checks only `num_for_sale` per watched
> dealer (**1 request instead of 100**) and sends a push on a change. The actual scan is then
> done by the client again, on its own budget.

**Trigger:** push is genuinely missed. Not before.
