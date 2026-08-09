# 08 – Deployment auf Uberspace

> **Lokal entwickeln in Docker, produktiv auf Uberspace 7.**
> Uberspace kann **kein Docker**. Deployed wird das fertig gebaute Nitro-`.output`.
>
> ⚠️ **Diese Entscheidung ist nicht endgültig.** Uberspace hat für genau diese Arbeitslast
> zwei ungünstige Eigenschaften (geteilte ausgehende IP, 1,5 GB RAM). Alternativen –
> kleiner VPS, Homeserver mit Traefik/Cloudflare Tunnel – stehen in
> [`10-DEPLOYMENT-ALTERNATIVEN.md`](10-DEPLOYMENT-ALTERNATIVEN.md).
> Die App wird so gebaut, dass beides ohne Umbau geht.

---

## 1. Die Randbedingungen von Uberspace 7

| Ressource | Limit | Konsequenz |
|---|---:|---|
| **RAM** | **1,5 GB gesamt** | Prozesse über dem Limit werden **beendet**. Ein Prozess für App+Worker. |
| **Disk** | 10 GB (Soft), 11 GB (Hard), bis 100 GB buchbar | Katalog-DB ist der Engpass |
| **Node** | **18 / 20 / 22** – 22 ist Default | ⚠️ **Kein Node 24.** Lokal ebenfalls 22. |
| **PostgreSQL** | via `uberspace tools version use postgresql` | ⚠️ **Vor Projektstart `uberspace tools version list postgresql` prüfen** und lokal dieselbe Major pinnen |
| **CPU** | „fairer Anteil", Drosselung statt Kill | Scans sind I/O-gebunden – unkritisch |
| **Docker** | ❌ nicht verfügbar | Deploy per rsync |
| **Ausgehende IP** | geteilt | ⚠️ siehe unten |

> ⚠️ **Das größte betriebliche Risiko:** Discogs limitiert **pro Quell-IP**. Uberspace-Hosts
> haben eine geteilte ausgehende IP. Theoretisch teilen wir uns 60 Requests/Minute mit
> anderen Uberspace-Kunden, die dieselbe API nutzen. Wahrscheinlichkeit gering, Wirkung
> spürbar.
> **Mitigation:** Der Token-Bucket steuert über `X-Discogs-Ratelimit-Remaining` aus der
> *Antwort*, nicht über einen eigenen Zähler – er merkt fremden Verbrauch automatisch.
> Zusätzlich: 429-Backoff und ein sichtbarer Hinweis in der UI („API gerade ausgelastet,
> Scan läuft langsamer").

### RAM-Budget

| Prozess | Ziel |
|---|---:|
| PostgreSQL (`shared_buffers=128MB`, `max_connections=20`) | ~250 MB |
| Nitro (SSR + API + pg-boss-Worker in-process) | ~250 MB |
| Reserve (Deploy, Migration, `psql`, Cron) | ~200 MB |
| **Summe** | **~700 / 1.500 MB** |

---

## 2. Einmalige Einrichtung

### 2.1 PostgreSQL

```bash
uberspace tools version list postgresql          # verfügbare Majors prüfen!
uberspace tools version use postgresql <MAJOR>

mkdir -p ~/opt/postgresql
initdb -D ~/opt/postgresql/data -E UTF8 --locale=de_DE.UTF-8

# ~/opt/postgresql/data/postgresql.conf – RAM-schonend
cat >> ~/opt/postgresql/data/postgresql.conf <<'EOF'
unix_socket_directories = '/home/<USER>/tmp'
listen_addresses = ''
max_connections = 20
shared_buffers = 128MB
work_mem = 8MB
maintenance_work_mem = 64MB
max_worker_processes = 4
max_files_per_process = 64
logging_collector = on
log_directory = 'log'
EOF
```

```ini
; ~/etc/services.d/postgresql.ini
[program:postgresql]
command=postgres -D %(ENV_HOME)s/opt/postgresql/data/
autostart=true
autorestart=true
startsecs=30
```

```bash
supervisorctl reread && supervisorctl update
createdb fidelity
psql fidelity -c 'CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION pgcrypto;'
```

> Extensions liegen unter `/usr/pgsql-<MAJOR>/share/extension/`. `CREATE EXTENSION` braucht
> Superuser – als DB-Eigentümer auf Uberspace gegeben.

### 2.2 Node & App

```bash
uberspace tools version use node 22
mkdir -p ~/apps/fidelity/{releases,shared}
```

```ini
; ~/etc/services.d/fidelity.ini
[program:fidelity]
directory=%(ENV_HOME)s/apps/fidelity/current
command=node server/index.mjs
environment=NODE_ENV="production",PORT="8080",HOST="0.0.0.0"
autostart=true
autorestart=true
startsecs=15
stdout_logfile=%(ENV_HOME)s/logs/fidelity.log
stderr_logfile=%(ENV_HOME)s/logs/fidelity.err.log
```

> ⚠️ Die App **muss** auf `0.0.0.0` lauschen, Port zwischen 1024 und 65535.

```bash
uberspace web backend set / --http --port 8080
uberspace web domain add fidelity.example.de     # TLS kommt automatisch
```

### 2.3 Secrets

```bash
touch ~/apps/fidelity/shared/.env && chmod 600 ~/apps/fidelity/shared/.env
```

```dotenv
DATABASE_URL=postgres:///fidelity?host=/home/<USER>/tmp
NUXT_DISCOGS_CONSUMER_KEY=…
NUXT_DISCOGS_CONSUMER_SECRET=…
NUXT_DISCOGS_USER_AGENT=Fidelity/0.1.0 +https://fidelity.example.de
FIDELITY_TOKEN_KEY=…            # 32 Byte, für pgcrypto
FIDELITY_SESSION_SECRET=…
SENTRY_DSN=…
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
```

Nie im Repo. In CI als GitHub Secrets.

---

## 3. Deploy

Symlink-Releases (Capistrano-Muster), Rollback in einer Sekunde:

```
~/apps/fidelity/
├── releases/
│   ├── 20260809-141230-a1b2c3d/
│   └── 20260812-093015-e4f5g6h/
├── shared/.env
└── current -> releases/20260812-093015-e4f5g6h
```

```yaml
# .github/workflows/deploy.yml (Auszug)
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
      - run: pnpm build                       # → .output/  (self-contained)

      - name: SSH-Key
        run: |
          mkdir -p ~/.ssh && echo "${{ secrets.UBERSPACE_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.UBERSPACE_KNOWN_HOSTS }}" > ~/.ssh/known_hosts

      - name: Upload
        run: |
          REL=$(date +%Y%m%d-%H%M%S)-${GITHUB_SHA::7}
          echo "REL=$REL" >> $GITHUB_ENV
          rsync -az --delete .output/ \
            ${{ secrets.UBERSPACE_USER }}@${{ secrets.UBERSPACE_HOST }}:apps/fidelity/releases/$REL/

      - name: Migrate, umschalten, neu starten
        run: |
          ssh ${{ secrets.UBERSPACE_USER }}@${{ secrets.UBERSPACE_HOST }} bash -s <<EOSSH
            set -euo pipefail
            cd ~/apps/fidelity
            # ⚠️ absoluter Pfad – ein relativer würde gegen das LINK-Verzeichnis
            #    aufgelöst und landete bei releases/$REL/shared/.env (existiert nicht)
            ln -sfn ~/apps/fidelity/shared/.env releases/${{ env.REL }}/.env
            # Migrationen VOR dem Umschalten – müssen abwärtskompatibel sein
            cd releases/${{ env.REL }} && node server/migrate.mjs
            cd ~/apps/fidelity
            ln -sfn releases/${{ env.REL }} current
            supervisorctl restart fidelity
            ls -1dt releases/*/ | tail -n +6 | xargs -r rm -rf   # 5 Releases behalten
          EOSSH

      - name: Smoke-Test
        run: curl -fsS https://fidelity.example.de/api/health
```

> ⚠️ **Migrationen laufen vor dem Symlink-Wechsel.** Sie müssen daher mit der *alten*
> Codeversion kompatibel sein: erst Spalte hinzufügen, in einem späteren Release
> befüllen/umstellen, in einem noch späteren die alte entfernen. Expand/Contract.

**Rollback:**

```bash
ln -sfn releases/<VORIGE> current && supervisorctl restart fidelity
```

---

## 4. Katalog-Deploy (M5)

Läuft **nicht** auf Uberspace – 10,4 GB gz und ~110 GB entpackt sind dort unmöglich.

```bash
# LOKAL (Docker, viel Platte)
pnpm catalog:download              # inkl. SHA-256 gegen CHECKSUM.txt
pnpm catalog:build                 # Streaming-SAX → catalog-Schema
pnpm catalog:verify                # Stichproben gegen die Live-API
pg_dump -n catalog --no-owner fidelity | zstd -19 > catalog-202608.sql.zst

# HOCHLADEN (~1,5–3 GB → besser über Nacht)
rsync -avz --progress catalog-202608.sql.zst uber:~/tmp/

# AUF UBERSPACE – blau/grün, damit die App nie ohne Katalog dasteht
# ⚠️ NICHT per sed am Dump herumschneiden: pg_dump ab PG 11 schreibt kein
#    "SET search_path = catalog" mehr, sondern set_config('search_path','') plus
#    voll qualifizierte Namen und ein eigenes CREATE SCHEMA. Stattdessen:
#    altes Schema wegbenennen, Dump normal einspielen, altes löschen.
ssh uber <<'EOF'
  set -euo pipefail
  psql fidelity -c 'DROP SCHEMA IF EXISTS catalog_old CASCADE;'
  psql fidelity -c 'ALTER SCHEMA catalog RENAME TO catalog_old;'
  # ab hier fehlen die M5-Signale kurzzeitig – S1/S3/S5/S7 laufen weiter
  zstd -dc ~/tmp/catalog-202608.sql.zst | psql fidelity --single-transaction
  psql fidelity -c 'DROP SCHEMA catalog_old CASCADE;'
  psql fidelity -c 'ANALYZE;'
  rm ~/tmp/catalog-202608.sql.zst
EOF
```

> ⚠️ **Vorher Platz prüfen.** Während des Umschaltens liegen kurzzeitig **zwei** Katalog-
> Schemas parallel (`catalog_old` + der neue Import). Bei ~6 GB pro Schema und 10 GB
> Quota geht das **nicht** auf.
> Optionen, in dieser Reihenfolge:
> 1. Quota vor dem Refresh auf 25 GB hochbuchen (Uberspace erlaubt bis 100 GB)
> 2. Oder: `catalog` löschen und neu importieren (kurze Downtime der M5-Signale,
>    die Basis-Signale S1/S3/S5 laufen weiter)
>
> **Vor M5 den echten Platzbedarf messen** – die 6 GB sind eine Schätzung.

**Kadenz:** monatlich, halbautomatisch, manuell ausgelöst. Kein Cron – das ist ein
bewusster Wartungsvorgang.

---

## 5. Backups

```bash
# ~/bin/backup.sh  (täglich per Cron, 03:30)
set -euo pipefail
D=$(date +%F)
# NUR das app-Schema. catalog ist aus CC0-Dumps jederzeit reproduzierbar
# und würde das Quota sprengen.
pg_dump -n app --no-owner fidelity | zstd -12 > ~/backups/app-$D.sql.zst
find ~/backups -name 'app-*.sql.zst' -mtime +30 -delete
```

```
30 3 * * * ~/bin/backup.sh >> ~/logs/backup.log 2>&1
```

**Zusätzlich wöchentlich vom lokalen Rechner ziehen** – ein Backup, das nur auf demselben
Host liegt, ist kein Backup:

```bash
rsync -az uber:~/backups/ ~/Backups/fidelity/
```

**Restore-Test:** einmal pro Quartal. Ein ungetestetes Backup ist eine Vermutung.

---

## 6. Betrieb

```bash
supervisorctl status
supervisorctl restart fidelity
tail -f ~/logs/fidelity.log
psql fidelity -c "SELECT status, count(*) FROM app.dig GROUP BY 1;"
psql fidelity -c "SELECT name, state, count(*) FROM pgboss.job GROUP BY 1,2;"
quota -gs                                   # Disk-Verbrauch
ps -u $USER -o rss,comm --sort=-rss | head  # RAM-Verbrauch
```

### Wenn das RAM-Limit reißt

Reihenfolge der Gegenmaßnahmen:

1. `shared_buffers` in Postgres auf 64 MB senken
2. Nuxt auf `ssr: false` umstellen – statisches SPA-Bundle aus dem Docroot, Nitro nur noch
   als API-Daemon. Spart ~80 MB und macht den Prozess schlanker
3. Node mit `--max-old-space-size=384` starten
4. Katalog-Abfragen mit `LIMIT` härten (ein unbeschränkter Credit-Graph-Join kann eskalieren)
5. Erst dann: VPS statt Uberspace erwägen (das Docker-Image liegt bereit)

### Mobile Tests

Für PWA-Installation, Web Push und OAuth-Callback braucht es HTTPS. Lokal über
Cloudflare Tunnel (siehe `07-DEV-PIPELINE.md` §5) — **oder** direkt gegen die
Uberspace-Staging-Domain testen.

Empfehlung: **zweiter Uberspace-Bereich als Staging** (`fidelity-stage.example.de`,
eigene DB `fidelity_stage`, eigener supervisord-Service auf Port 8081). Kostet fast nichts
und erspart „auf Produktion testen".
