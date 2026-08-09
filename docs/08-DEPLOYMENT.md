# 08 – Deployment

> **Es gibt nichts zu deployen außer statischen Dateien.**
> Kein Server, keine Datenbank, keine Migrationen, keine Backups, kein Monitoring-Stack.
> Siehe ADR-007.

---

## 1. Was gebaut wird

```bash
pnpm build          # nuxt generate  →  .output/public/
```

Ergebnis: HTML, JS, CSS, Service Worker, Manifest, Icons. **Ein paar hundert Kilobyte.**
Kein Node zur Laufzeit, kein Prozess, der laufen muss.

**Anforderungen an das Hosting:**

- HTTPS (Pflicht für Service Worker, PWA-Installation und den Token-Umgang)
- SPA-Fallback: alle unbekannten Pfade auf `index.html`
- Korrekte MIME-Types, `Cache-Control: immutable` für gehashte Assets
- Ein paar Security-Header

Das kann jeder Webserver. Es gibt keinen Grund, dafür Geld auszugeben.

---

## 2. Optionen

| Option | Kosten | Aufwand | Anmerkung |
|---|---:|---|---|
| **Uberspace-Docroot** | hast du | rsync im CI | Eigene Domain, deutscher Anbieter. Keine 1,5-GB-RAM-Grenze mehr, weil nichts läuft. |
| **Cloudflare Pages** | 0 € | Git-Push | Global CDN, Preview-Deploys pro PR, automatisches TLS |
| **GitHub Pages** | 0 € | Actions | Am simpelsten, wenn das Repo ohnehin dort liegt |
| **Homeserver + Caddy** | Strom | Container | Nur noch statische Dateien – Verfügbarkeit ist unkritischer als beim Serverentwurf |

> **Der frühere Zielkonflikt ist weg.** `10-DEPLOYMENT-ALTERNATIVEN.md` verglich Uberspace,
> VPS und Homeserver anhand von RAM, Plattenplatz und ausgehender IP. Nichts davon spielt
> noch eine Rolle: Es gibt keinen Prozess, keine Datenbank, und die Discogs-Requests gehen
> von der IP des **Nutzers** aus.
>
> **Empfehlung: Uberspace-Docroot**, weil du es hast und eine eigene Domain willst.
> Cloudflare Pages als Zweitweg für Preview-Deploys pro Pull Request.

---

## 3. Uberspace

### Einmalig

```bash
uberspace web domain add fidelity.example.de     # TLS kommt automatisch
mkdir -p ~/html/fidelity
```

SPA-Fallback und Header über `~/html/fidelity/.htaccess`:

```apache
# SPA-Fallback: alles, was keine echte Datei ist, geht an index.html
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Gehashte Assets ewig cachen, index.html nie
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
  connect-src 'self' https://api.discogs.com; \
  img-src 'self' https://i.discogs.com data: blob:; \
  script-src 'self'; style-src 'self' 'unsafe-inline'; \
  worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'"
```

> ⚠️ **`connect-src` auf `api.discogs.com` beschränken.** Das ist der wirksamste Schutz
> für den Personal Access Token: Selbst wenn irgendwann fremder Code in die Seite käme,
> könnte er den Token nirgendwohin schicken.

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

      - name: SSH-Key
        run: |
          mkdir -p ~/.ssh && echo "${{ secrets.UBERSPACE_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.UBERSPACE_KNOWN_HOSTS }}" > ~/.ssh/known_hosts

      # Ein rsync. Das ist das ganze Deployment.
      - name: Upload
        run: |
          rsync -az --delete --exclude='.htaccess' \
            .output/public/ \
            ${{ secrets.UBERSPACE_USER }}@${{ secrets.UBERSPACE_HOST }}:html/fidelity/

      - name: Smoke-Test
        run: curl -fsS https://fidelity.example.de/ | grep -q "Fidelity"
```

Kein Build-Secret nötig – die App hat kein Consumer Secret, weil sie kein OAuth macht.

**Rollback:** vorherigen Tag auschecken, `pnpm build`, rsync. Oder direkt aus dem
Actions-Artefakt des letzten grünen Builds.

> ⚠️ **Service-Worker-Fallstrick:** Nach einem Deploy laufen alte Clients weiter, bis der
> SW aktualisiert. `@vite-pwa/nuxt` mit `registerType: 'prompt'` konfigurieren und dem
> Nutzer ein „Neue Version verfügbar – neu laden" anbieten. **Kein `skipWaiting` ohne
> Prompt** – sonst tauschen wir mitten in einem laufenden Dig den Code aus.

---

## 4. Lokale Entwicklung

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Kein Docker nötig. Keine Datenbank, kein Compose-Stack, kein Seed. Man braucht nur
einen Personal Access Token aus `discogs.com/settings/developers`.

> Docker bleibt optional als Prod-Parität-Check (`docker run` mit einem statischen
> Webserver plus `.htaccess`-Äquivalent), ist aber für die tägliche Arbeit überflüssig.

### Mobile Tests

PWA-Installation und Service Worker brauchen HTTPS. Zwei Wege:

```bash
# a) Cloudflare Tunnel gegen den Dev-Server
cloudflared tunnel --url http://localhost:3000

# b) Staging-Domain auf Uberspace
uberspace web domain add fidelity-stage.example.de
# eigener Ordner ~/html/fidelity-stage, Deploy von main statt von Tags
```

Empfehlung: **beides**. Der Tunnel für schnelle Iteration am Handy, die Staging-Domain
für alles, was einen stabilen Origin braucht – IndexedDB und Service Worker sind an den
Origin gebunden, ein wechselnder Tunnel-Hostname wirft bei jedem Start alles weg.

---

## 5. Betrieb

Es gibt keinen.

| Frühere Aufgabe | Jetzt |
|---|---|
| supervisord-Services überwachen | entfällt |
| PostgreSQL-Backups | entfällt – Daten liegen beim Nutzer und sind aus der API reproduzierbar |
| RAM-Limit überwachen | entfällt |
| Disk-Quota überwachen | ein paar hundert KB |
| Migrationen ausrollen | IndexedDB-Upgrade läuft im Client |
| Katalog-Dump einspielen | entfällt (siehe `11-KATALOG-STRATEGIE.md`) |
| Rate-Limit-Warteschlange verwalten | entfällt – jeder Nutzer hat sein eigenes Budget |

**Was bleibt:**

- Uptime des statischen Hostings (Uberspace macht das)
- Bundle-Budget im CI (siehe `12-RESSOURCEN-BUDGET.md` §7)
- Optional Sentry für Client-Fehler – **ohne** Session Replay, mit `sendDefaultPii: false`
  und **Redaction des Tokens** in der `beforeSend`-Hook

```ts
// Der Token darf unter keinen Umständen in einen Fehler-Report geraten
beforeSend(event) {
  const s = JSON.stringify(event)
  return s.includes(getToken()) ? null : event
}
```

---

## 6. Wann doch ein Server dazukommt

Nur für zwei Dinge, und beide sind **additiv** – die App funktioniert ohne sie weiter:

| Funktion | Warum ein Server nötig ist | Möglicher Weg |
|---|---|---|
| **Push-Benachrichtigungen** | Web Push braucht einen Application Server, der an den Push-Dienst zustellt | Cloudflare Worker, gratis bis 100k Requests/Tag |
| **Nächtliche Watchlist-Läufe** | Ein Browser scannt nicht, während er zu ist | Derselbe Worker, mit Cron-Trigger |

> ⚠️ **Achtung beim Watchlist-Server:** Er würde von *einer* IP scannen – damit wäre das
> geteilte Rate-Limit zurück. Sinnvoller Zuschnitt: der Worker prüft nur `num_for_sale`
> pro beobachtetem Händler (**1 Request statt 100**) und schickt bei Veränderung einen
> Push. Den eigentlichen Scan macht dann wieder der Client mit seinem eigenen Budget.

**Auslöser:** Push wird tatsächlich vermisst. Nicht vorher.
