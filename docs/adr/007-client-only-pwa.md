# ADR-007: Reine Client-PWA ohne Backend

**Status:** Akzeptiert · **Datum:** 2026-08-09
**Ersetzt Teile von:** ADR-001, ADR-002, ADR-003, ADR-004

## Kontext

Ziel: minimaler Ressourcenverbrauch. Der Serverentwurf (Nuxt SSR + PostgreSQL + pg-boss
auf Uberspace) brauchte ~700 MB RAM, ein Deployment, Backups, eine Datenbank und
verteilte ein **geteiltes** Rate-Limit-Budget auf alle Nutzer.

Die Frage war: Geht das komplett im Browser?

## Verifiziert am 2026-08-09 gegen `api.discogs.com`

```
access-control-allow-origin:  *
access-control-allow-headers: Content-Type, authorization, User-Agent,
                              Private-Auth-Secret, Discogs-UID
access-control-expose-headers: Location
```

| Test | Ergebnis |
|---|---|
| GET mit `Origin`-Header | **200**, `allow-origin: *` |
| Preflight mit `authorization` | **204**, Header erlaubt |
| `/users/juno_records/inventory` mit **Safari-User-Agent** | **200**, 43.223 Listings |
| Preflight `PUT /users/{u}/wants/{id}` | erlaubt `DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT` |
| Preflight `POST /oauth/access_token` | **500**, nur `HEAD, OPTIONS` |
| `x-discogs-ratelimit-*` in `expose-headers` | ❌ **nicht enthalten** |

## Entscheidung

**Fidelity wird eine reine Client-PWA.** Statische Dateien, kein Backend, keine Datenbank,
kein Deployment-Prozess. Der Browser spricht direkt mit `api.discogs.com`.

**Authentifizierung über Personal Access Token.** Der Nutzer erzeugt sich unter
`discogs.com/settings/developers` selbst einen Token und trägt ihn in die App ein.
Der Token liegt in IndexedDB auf seinem Gerät und verlässt es nie.

> **OAuth 1.0a ist keine Option mehr** – `POST /oauth/access_token` ist per CORS gesperrt.
> Das ist kein Verlust: Ein PAT liest genau die Daten seines Besitzers, und genau das
> braucht jeder Nutzer. Der ursprüngliche Ausschlussgrund („ein PAT liest nur die Daten
> seines eigenen Besitzers") galt nur für eine Server-App, die viele Nutzer bedient.

## Der eigentliche Gewinn: das Rate-Limit

Discogs drosselt **pro Quell-IP**. Bei einer Server-App teilen sich alle Nutzer *ein*
Budget von 60 Requests/Minute – auf Uberspace sogar noch mit fremden Kunden auf demselben
Host. Im Browser hat **jeder Nutzer sein eigenes Budget**.

```
Server-Architektur:   30 Nutzer  →  1 × 60 req/min   →  Warteschlange, Staffelung
Client-Architektur:   30 Nutzer  →  30 × 60 req/min  →  keine Warteschlange
```

Das löst die härteste Skalierungsgrenze des Projekts – ersatzlos.

## Alternativen

**Server-Architektur (der ursprüngliche Entwurf)** – gibt geteilten Horizont,
Hintergrund-Watchlist und echte Push-Benachrichtigungen. Kostet dafür ~700 MB RAM,
Betrieb, Backups, DSGVO-Pflichten und das geteilte Rate-Limit. Verworfen: das Verhältnis
stimmt für 5–30 Nutzer nicht.

**Hybrid (statische PWA + winziger Push-Dienst)** – bleibt als **additive** Ausbaustufe
offen, siehe §„Ausstiegspfad". Nicht jetzt.

**Browser-Extension** – hätte den User-Agent frei setzbar gemacht. Verworfen: Store-Review,
kein iOS, schlechtere Installierbarkeit. Der Test zeigt ohnehin, dass Discogs
Browser-User-Agents akzeptiert.

## Konsequenzen

**Leichter**

- Kein Server, keine Datenbank, kein ORM, keine Job-Queue, kein Deployment, keine Backups
- Hosting = statische Dateien. Uberspace-Docroot, Cloudflare Pages, GitHub Pages – gratis
- **Pro Nutzer ein volles Rate-Limit-Budget**
- DSGVO wird trivial: es gibt keinen Verantwortlichen für fremde Daten, weil keine fremden
  Daten irgendwo liegen. Kein Auftragsverarbeiter, kein Token auf fremden Servern
- Offline-Fähigkeit fällt praktisch ab – die Daten liegen ohnehin lokal
- Rechenlast trägt das Endgerät, und jedes Handy ist stärker als der Uberspace-Account

**Schwerer**

| Verlust | Ersatz |
|---|---|
| **Keine Push-Benachrichtigungen** – Web Push braucht einen Application Server | Beim Öffnen prüfen + Badge-API. Ein „seit deinem letzten Besuch"-Banner |
| **Keine nächtlichen Watchlist-Scans** – Periodic Background Sync ist Chromium-only und unzuverlässig | Watchlist-Prüfung beim App-Start, gestaffelt im Hintergrund-Worker |
| **Rate-Limit-Header für JS unsichtbar** (`expose-headers` listet nur `Location`) | Konservativ blind fahren: 1 Request/1,2 s, exponentieller Backoff auf 429 (der **Status** ist lesbar) |
| **Horizont wird nicht geteilt** – jeder Nutzer expandiert selbst | ~12 Minuten einmalig, mit eigenem Budget. Kein echtes Problem |
| **Versandstaffeln nicht crowdsourcebar** | Als `shipping-profiles.json` im Repo, per Pull Request gepflegt, mit der App ausgeliefert |
| **Digs nicht per Link teilbar** | Export als JSON-Datei |
| **iOS räumt Daten nach ~7 Tagen Inaktivität ab** – außer bei installierten Home-Screen-Apps | Installation aktiv bewerben; der Horizont ist ohnehin reproduzierbar |
| **Kein User-Agent setzbar** – `fetch()` verbietet den Header | Verifiziert unkritisch: Discogs akzeptiert Browser-UAs. **In M1 als erstes gegenprüfen.** |

**Ausstiegspfad**

Die Trennlinie ist sauber: Die App spricht mit einem `DiscogsClient`-Interface und einem
`Store`-Interface. Beide lassen sich später gegen eine Server-Implementierung tauschen,
ohne dass die Matching-Engine oder die UI davon etwas merkt.

Ein **Cloudflare Worker** (kostenlos bis 100.000 Requests/Tag) könnte später additiv
dazukommen – ausschließlich für Push und nächtliche Watchlist-Läufe, nicht für das
Scannen. **Auslöser:** Push wird vermisst, oder die Nutzerzahl geht in den dreistelligen
Bereich.
