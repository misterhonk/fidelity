# 10 - Deployment alternatives

> **LARGELY OBSOLETE (2026-08-09).** This document compared hosting options for the server
> design in terms of RAM, disk and outbound IP. Since **ADR-007** Fidelity has **no backend**
> — what gets deployed is static files. None of those figures is relevant any more.
>
> **The current options are in [`08-DEPLOYMENT.md`](08-DEPLOYMENT.md) section 2.**
> The short version: an Uberspace docroot, Cloudflare Pages or GitHub Pages — all free, all
> equivalent, all interchangeable. The home server stays an option and, as pure static
> hosting, is considerably less critical than it was with the server design.
>
> The rest stays as decision history — and for the case that a small service for push does
> get added later (`08-DEPLOYMENT.md` section 6).

---

## 1. What this app needs from hosting

Not obvious, hence explicit — in order of importance:

| Requirement | Why | Uberspace |
|---|---|---|
| **Its own, stable outbound IP** | Discogs limits **per source IP**. A shared IP means sharing the 60/min budget with other customers. | ⚠️ **shared** |
| **15–30 GB of disk** | The catalogue DB is ~6 GB, briefly double during a refresh | ⚠️ 10 GB (up to 100 bookable, at a price) |
| **RAM ≥ 2 GB** | Postgres + Node + refresh peaks | ⚠️ **1.5 GB, a hard kill** |
| **Long-running processes** | A dig takes 2–4 min, watchlist jobs run constantly | ✅ supervisord |
| **Docker** | Local/prod parity, the catalogue pipeline | ❌ |
| **Postgres with extensions** | `pg_trgm`, `unaccent`, `pgcrypto` | ✅ (an older major) |
| **HTTPS + our own domain** | The OAuth callback, PWA installation, Web Push | ✅ automatic |
| **Cost** | A hobby project for 5–30 people | ✅ ~€5–10/month |

> **The two red rows above are the actual point.** The RAM limit and above all the **shared
> outbound IP** are unfortunate for this app specifically — at heart it is a rate-limited API
> crawler.

---

## 2. The options

### A · Uberspace 7 — *"you already have it"*

**~€5–10/month** (pay what you want from €5, plus storage upgrades)

| ✅ | ❌ |
|---|---|
| You already have it, no new contract | **A shared outbound IP** → a rate-limit risk |
| No server operation, no patching, no backup plan needed | **1.5 GB RAM, hard** — processes get killed |
| TLS, domains, mail automatic | **10 GB of disk** — a catalogue refresh becomes gymnastics |
| A German provider, GDPR uncritical | **No Docker** → no prod parity |
| Postgres officially supported | Node max 22, Postgres not the newest major |

**Verdict:** works without trouble for M0–M4. From **M5 (the catalogue DB) it gets tight** —
a 6 GB schema inside a 10 GB quota, and during a refresh two schemas sit side by side for a
while.

---

### B · A small VPS — **the pragmatic recommendation**

**Hetzner CX22 · 2 vCPU · 4 GB RAM · 40 GB SSD · ~€4–5/month**
(alternatives: Netcup RS 1000, Contabo, Scaleway Stardust, Hetzner CAX11/ARM ~€3.50)

| ✅ | ❌ |
|---|---|
| **Its own fixed IP** → the full 60/min budget, nobody else consuming it | You are the sysadmin: updates, fail2ban, backups |
| **4 GB of RAM** → Postgres + Node + a catalogue refresh, relaxed | Some setup effort |
| **40 GB SSD** → the catalogue DB including a blue/green refresh is a non-issue | |
| **Docker** → exactly the same compose file as locally | |
| Postgres in whatever version you like, `pgvector` trivial | |
| Cheaper than Uberspace | |
| Located in Germany/Finland, GDPR uncritical | |

**The stack:** Docker Compose + **Traefik** (TLS via Let's Encrypt, automatic) or **Caddy**
(even less configuration). Watchtower or a simple deploy hook from GitHub Actions.

> **Objectively the best compromise for this app.** Cheaper than Uberspace, a dedicated
> rate-limit budget, three times the RAM, four times the space, full Docker parity. The only
> real price is systems administration — manageable for a compose stack with
> `unattended-upgrades` and automatic backups.

---

### C · A home server + a Cloudflare tunnel

**~€0 fixed cost** (plus electricity)

| ✅ | ❌ |
|---|---|
| **You already have it**, as much RAM and disk as you like | **Availability depends on your connection** — friends notice every reboot |
| **The catalogue pipeline runs right there** — no more 3 GB rsync | Dynamic IP / CGNAT (the tunnel solves that) |
| Cloudflare Tunnel: no port forwarding, no holes in the firewall, TLS included | Domestic upload is the bottleneck |
| Cloudflare Access in front → entry only for invited addresses, without auth of our own | Electricity + noise + backup responsibility |
| Perfect for staging and mobile testing | ⚠️ **Cloudflare ToS:** a tunnel for web apps is fine, excessive video/streaming is not — uncritical for us |

**The underrated advantage:** the catalogue pipeline (a 10.4 GB download, ~110 GB unpacked,
hours of parsing) runs there **natively**. The whole "build locally, compress, upload" dance
from `08-DEPLOYMENT.md` §4 falls away.

**Verdict:** **excellent as an interim solution and for staging.** As permanent hosting for
Jens and friends only if availability does not matter to you. I share your own assessment
("only as an interim solution").

---

### D · Fly.io / Railway / Render

**~€5–15/month**

Git-push deploys, managed Postgres, no sysadmin. But: **shared or changing outbound IPs**
(a dedicated one costs extra), cold starts, volume limits, and the price rises quickly once
the catalogue DB arrives.

**Verdict:** convenient, but it prices itself out on the catalogue part — and the IP point
hits us directly.

---

### E · Vercel / Netlify

**❌ Unsuitable.** Serverless timeouts (10–300 s) against a scan that runs 2–4 minutes, plus
shared outbound IPs. It would need an external worker anyway — at which point that worker may
as well do everything.

---

## 3. Comparison

| | Uberspace | **VPS (Hetzner)** | Home server | Fly.io | Vercel |
|---|:---:|:---:|:---:|:---:|:---:|
| Cost/month | €5–10 | **~€4–5** | ~€0 | €5–15 | €0–20 |
| **Its own outbound IP** | ❌ | **✅** | ✅ | 💰 | ❌ |
| RAM | 1.5 GB | **4 GB** | any | 0.5–2 GB | – |
| Disk | 10 GB | **40 GB** | any | 3–10 GB | – |
| Docker | ❌ | **✅** | ✅ | ✅ | ❌ |
| Long-running | ✅ | ✅ | ✅ | ✅ | ❌ |
| Availability | ✅✅ | ✅✅ | ⚠️ | ✅✅ | ✅✅ |
| Maintenance effort | **none** | medium | high | low | none |
| Catalogue DB (M5) | ⚠️ tight | **✅** | ✅✅ | ⚠️ expensive | ❌ |

---

## 4. Recommendation

**In two stages, without committing early:**

```
M0 – M4   Uberspace            You have it. It is enough. The catalogue DB is not
          (+ the home server    relevant yet.
           as staging over a
           Cloudflare tunnel)

from M5   Hetzner CX22         When the catalogue arrives Uberspace gets tight —
          ~€4.50/month         and the VPS is cheaper by then anyway.
```

**That costs nothing in flexibility**, because the app is built so both work:

- **A Docker image exists from day one** (`07-DEV-PIPELINE.md` §5) and runs on any VPS
  immediately
- **Nitro's `.output` is self-contained** → runs without Docker directly on Uberspace
- The deploy workflow gets a `TARGET` switch (`uberspace` | `docker`)
- **No provider-specific services.** No S3, no managed Redis, no edge functions. Just
  Postgres and a Node process.

> **The one decision that cannot be postponed:** do not build in vendor-lock-in services.
> That is the plan anyway.

---

## 5. If it becomes the VPS — the target picture

```yaml
# compose.prod.yml (sketch)
services:
  traefik:
    image: traefik:v3
    command:
      - --providers.docker
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.le.acme.tlschallenge=true
      - --certificatesresolvers.le.acme.email=…
    ports: ["80:80","443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

  app:
    image: ghcr.io/mister-honk/fidelity:${VERSION}
    env_file: .env
    depends_on: { db: { condition: service_healthy } }
    labels:
      - traefik.http.routers.fidelity.rule=Host(`fidelity.example.de`)
      - traefik.http.routers.fidelity.tls.certresolver=le
    restart: unless-stopped

  db:
    image: postgres:18          # a deliberate version jump over Uberspace 15
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment: { POSTGRES_DB: fidelity, … }
    healthcheck: { test: ["CMD-SHELL","pg_isready -U fidelity"], interval: 5s }
    restart: unless-stopped

volumes: { pgdata: {}, letsencrypt: {} }
```

**Deploy:** GitHub Actions builds the image, pushes to GHCR (OIDC, no long-lived secrets),
an SSH hook on the VPS pulls and restarts. No rsync, no symlink releases, no migration
timing problem — the image carries its migrations with it.

**Keep operations minimal:**
`unattended-upgrades`, UFW (only 22/80/443), SSH by key only, fail2ban, `pg_dump` by cron to
`/backups` **and** by rsync to the home server or a Hetzner Storage Box (~€3/month for 1 TB).

---

## 6. Open points for the home-server session

When you are at home, I will look at:

- [ ] Hardware: CPU, RAM, disk, free space
- [ ] The OS and whether Docker is already running
- [ ] Any existing reverse proxy (Traefik? Nginx Proxy Manager? Caddy?)
- [ ] The Cloudflare setup: domain, tunnel already active?
- [ ] The connection: upload bandwidth, fixed IP or CGNAT
- [ ] What is already running on it and which ports are taken
- [ ] The backup situation
- [ ] Is there a UPS? (which decides "interim" vs. "permanent")

Outcome: a decision between **the home server permanently**, **the home server as staging +
a VPS in production**, or **everything on Uberspace until M5**.
