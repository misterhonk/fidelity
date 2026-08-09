# 10 – Deployment-Alternativen

> **Offen.** Uberspace ist der dokumentierte Standardpfad (`08-DEPLOYMENT.md`),
> aber nicht zwingend die beste Wahl für genau diese Arbeitslast.
> Entscheidung vertagt bis der Homeserver gescannt ist.

---

## 1. Was diese App vom Hosting braucht

Nicht offensichtlich, deshalb explizit — die Reihenfolge ist nach Wichtigkeit:

| Anforderung | Warum | Uberspace |
|---|---|---|
| **Eigene, stabile ausgehende IP** | Discogs limitiert **pro Quell-IP**. Geteilte IP heißt geteiltes 60/min-Budget mit fremden Kunden. | ⚠️ **geteilt** |
| **Plattenplatz 15–30 GB** | Katalog-DB ~6 GB, beim Refresh kurzzeitig doppelt | ⚠️ 10 GB (bis 100 buchbar, kostet) |
| **RAM ≥ 2 GB** | Postgres + Node + Refresh-Spitzen | ⚠️ **1,5 GB, harter Kill** |
| **Langlaufende Prozesse** | Ein Dig dauert 2–4 Min., Watchlist-Jobs laufen ständig | ✅ supervisord |
| **Docker** | Lokal/Prod-Parität, Katalog-Pipeline | ❌ |
| **Postgres mit Extensions** | `pg_trgm`, `unaccent`, `pgcrypto` | ✅ (ältere Major) |
| **HTTPS + eigene Domain** | OAuth-Callback, PWA-Installation, Web Push | ✅ automatisch |
| **Kosten** | Hobbyprojekt für 5–30 Leute | ✅ ~5–10 €/Mon. |

> **Die zwei roten Zeilen oben sind der eigentliche Punkt.** Das RAM-Limit und vor allem
> die **geteilte ausgehende IP** sind für genau diese App unglücklich — sie ist im Kern
> ein rate-limitierter API-Crawler.

---

## 2. Die Optionen

### A · Uberspace 7 — *„hast du schon"*

**~5–10 €/Monat** (Pay-what-you-want ab 5 €, +Storage-Upgrades)

| ✅ | ❌ |
|---|---|
| Hast du schon, kein neuer Vertrag | **Geteilte ausgehende IP** → Rate-Limit-Risiko |
| Kein Server-Betrieb, kein Patchen, kein Backup-Konzept nötig | **1,5 GB RAM hart** — Prozesse werden gekillt |
| TLS, Domains, Mail automatisch | **10 GB Disk** — Katalog-Refresh wird zur Turnerei |
| Deutscher Anbieter, DSGVO unkritisch | **Kein Docker** → keine Prod-Parität |
| Postgres offiziell unterstützt | Node max. 22, Postgres nicht die neueste Major |

**Verdikt:** Funktioniert für M0–M4 problemlos. Ab **M5 (Katalog-DB) wird es eng** —
6 GB Schema in 10 GB Quota, und beim Refresh liegen kurz zwei Schemas parallel.

---

### B · Kleiner VPS — **die pragmatische Empfehlung**

**Hetzner CX22 · 2 vCPU · 4 GB RAM · 40 GB SSD · ~4–5 €/Monat**
(Alternativen: Netcup RS 1000, Contabo, Scaleway Stardust, Hetzner CAX11/ARM ~3,50 €)

| ✅ | ❌ |
|---|---|
| **Eigene, feste IP** → volles 60/min-Budget, kein Fremdverbrauch | Du bist Sysadmin: Updates, Fail2ban, Backups |
| **4 GB RAM** → Postgres + Node + Katalog-Refresh entspannt | Etwas Einrichtungsaufwand |
| **40 GB SSD** → Katalog-DB inkl. Blau/Grün-Refresh kein Thema | |
| **Docker** → exakt dasselbe Compose wie lokal | |
| Postgres in der Version deiner Wahl, `pgvector` trivial | |
| Günstiger als Uberspace | |
| Standort Deutschland/Finnland, DSGVO unkritisch | |

**Stack:** Docker Compose + **Traefik** (TLS via Let's Encrypt, automatisch) oder **Caddy**
(noch weniger Konfiguration). Watchtower oder ein simpler Deploy-Hook aus GitHub Actions.

> **Für diese App objektiv der beste Kompromiss.** Billiger als Uberspace, dediziertes
> Rate-Limit-Budget, dreifacher RAM, vierfacher Platz, volle Docker-Parität.
> Der einzige echte Preis ist Systemadministration — bei einem Compose-Stack mit
> `unattended-upgrades` und automatischen Backups überschaubar.

---

### C · Homeserver + Cloudflare Tunnel

**~0 € Fixkosten** (plus Strom)

| ✅ | ❌ |
|---|---|
| **Hast du schon**, beliebig viel RAM und Platte | **Verfügbarkeit hängt an deinem Anschluss** — Freunde merken jeden Reboot |
| **Katalog-Pipeline läuft direkt dort** — kein 3-GB-rsync mehr | Dynamische IP / CGNAT (Tunnel löst das) |
| Cloudflare Tunnel: kein Port-Forwarding, keine Firewall-Löcher, TLS inklusive | Heimischer Upload ist der Flaschenhals |
| Cloudflare Access davor → Zugang nur für eingeladene Mails, ohne eigenes Auth | Strom + Lärm + Backup-Verantwortung |
| Perfekt für Staging und Mobile-Tests | ⚠️ **Cloudflare-ToS:** Tunnel für Web-Apps ist ok, exzessives Video/Streaming nicht — für uns unkritisch |

**Der unterschätzte Vorteil:** Die Katalog-Pipeline (10,4 GB Download, ~110 GB entpackt,
stundenlanges Parsen) läuft dort **nativ**. Der ganze „lokal bauen, komprimieren, hochladen"-
Tanz aus `08-DEPLOYMENT.md` §4 entfällt.

**Verdikt:** Als **Zwischenlösung und Staging exzellent.** Als Dauerbetrieb für Jens und
Freunde nur, wenn dir Verfügbarkeit egal ist. Deine eigene Einschätzung („nur als
Zwischenlösung") teile ich.

---

### D · Fly.io / Railway / Render

**~5–15 €/Monat**

Git-Push-Deploy, managed Postgres, kein Sysadmin. Aber: **geteilte oder wechselnde
ausgehende IPs** (dediziert kostet extra), Cold Starts, Volume-Limits, und der Preis
steigt schnell sobald die Katalog-DB dazukommt.

**Verdikt:** Bequem, aber teuert sich für den Katalog-Anteil selbst ab — und der
IP-Punkt trifft uns direkt.

---

### E · Vercel / Netlify

**❌ Ungeeignet.** Serverless-Timeouts (10–300 s) gegen einen Scan, der 2–4 Minuten
läuft, plus geteilte ausgehende IPs. Bräuchte ohnehin einen externen Worker — dann kann
man den auch gleich alles machen lassen.

---

## 3. Vergleich

| | Uberspace | **VPS (Hetzner)** | Homeserver | Fly.io | Vercel |
|---|:---:|:---:|:---:|:---:|:---:|
| Kosten/Monat | 5–10 € | **~4–5 €** | ~0 € | 5–15 € | 0–20 € |
| **Eigene ausgehende IP** | ❌ | **✅** | ✅ | 💰 | ❌ |
| RAM | 1,5 GB | **4 GB** | beliebig | 0,5–2 GB | – |
| Disk | 10 GB | **40 GB** | beliebig | 3–10 GB | – |
| Docker | ❌ | **✅** | ✅ | ✅ | ❌ |
| Langläufer | ✅ | ✅ | ✅ | ✅ | ❌ |
| Verfügbarkeit | ✅✅ | ✅✅ | ⚠️ | ✅✅ | ✅✅ |
| Wartungsaufwand | **keiner** | mittel | hoch | gering | keiner |
| Katalog-DB (M5) | ⚠️ eng | **✅** | ✅✅ | ⚠️ teuer | ❌ |

---

## 4. Empfehlung

**Zweistufig, ohne sich früh festzulegen:**

```
M0 – M4   Uberspace            Hast du. Reicht. Katalog-DB noch nicht relevant.
          (+ Homeserver als Staging über Cloudflare Tunnel)

ab M5     Hetzner CX22         Wenn der Katalog kommt, wird Uberspace eng —
          ~4,50 €/Monat        und der VPS ist dann sogar billiger.
```

**Das kostet nichts an Flexibilität**, weil die App so gebaut wird, dass beides geht:

- **Docker-Image existiert von Tag 1** (`07-DEV-PIPELINE.md` §5) und ist auf jedem VPS
  sofort lauffähig
- **Nitros `.output` ist self-contained** → läuft ohne Docker direkt auf Uberspace
- Der Deploy-Workflow bekommt einen `TARGET`-Schalter (`uberspace` | `docker`)
- **Keine anbieterspezifischen Dienste.** Kein S3, kein managed Redis, keine Edge-Functions.
  Nur Postgres und ein Node-Prozess.

> **Die einzige Entscheidung, die man nicht vertagen kann:** keine Vendor-Lock-in-Dienste
> einbauen. Das ist ohnehin schon so geplant.

---

## 5. Wenn es der VPS wird — Zielbild

```yaml
# compose.prod.yml (Skizze)
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
    image: postgres:18          # bewusster Versionssprung ggü. Uberspace 15
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment: { POSTGRES_DB: fidelity, … }
    healthcheck: { test: ["CMD-SHELL","pg_isready -U fidelity"], interval: 5s }
    restart: unless-stopped

volumes: { pgdata: {}, letsencrypt: {} }
```

**Deploy:** GitHub Actions baut das Image, pusht nach GHCR (OIDC, keine Langzeit-Secrets),
SSH-Hook auf dem VPS zieht und startet neu. Kein rsync, keine Symlink-Releases, kein
Migrations-Timing-Problem — das Image trägt seine Migrationen mit.

**Betrieb minimal halten:**
`unattended-upgrades`, UFW (nur 22/80/443), SSH nur mit Key, Fail2ban,
`pg_dump` per Cron nach `/backups` **und** per rsync auf den Homeserver oder eine
Hetzner Storage Box (~3 €/Monat für 1 TB).

---

## 6. Offene Punkte für die Homeserver-Session

Wenn du zuhause bist, schau ich mir an:

- [ ] Hardware: CPU, RAM, Platte, freier Platz
- [ ] OS und ob schon Docker läuft
- [ ] Bestehender Reverse Proxy (Traefik? Nginx Proxy Manager? Caddy?)
- [ ] Cloudflare-Setup: Domain, Tunnel schon aktiv?
- [ ] Anschluss: Upload-Bandbreite, feste IP oder CGNAT
- [ ] Was läuft schon drauf und welche Ports sind belegt
- [ ] Backup-Situation
- [ ] USV vorhanden? (bestimmt, ob „Zwischenlösung" oder „Dauerlösung")

Ergebnis: Entscheidung zwischen **Homeserver dauerhaft**, **Homeserver als Staging +
VPS produktiv**, oder **alles auf Uberspace bis M5**.
