# Der Hub

Ein optionaler Beschleuniger für Fidelity. **Kein Fundament.**

Die App läuft vollständig ohne ihn — wer ihn abschaltet, verliert Komfort, nie
Funktionalität (ADR-008, `docs/13-HUB-ADDON.md`). Genau das prüft ein Test in
der Haupt-Suite: mit leerer `hubUrl` muss alles durchlaufen.

## Was er kann

| Route | Zweck |
|---|---|
| `GET /v1/health` | Lebt er? |
| `GET /v1/horizon/:kind/:id` | Expandierte Entität aus dem gemeinsamen Cache |
| `PUT /v1/horizon/:kind/:id` | Eine selbst expandierte Entität beisteuern |
| `GET /v1/shipping/:dealer/:country` | Versandstaffel eines Händlers |
| `PUT /v1/shipping/:dealer/:country` | Eine Staffel beisteuern |
| `GET /v1/family/:master` | Pressungsfamilie eines Albums aus dem gemeinsamen Cache (CC0, 30 Tage) |
| `PUT /v1/family/:master` | Eine selbst geholte Familie beisteuern |

Wer Conny Plank schon expandiert hat, erspart allen anderen elf Requests. Bei
drei Nutzern schrumpft die Ersteinrichtung von dreizehn Minuten auf Sekunden.

## Was er bewusst nicht kann

- **Keine Discogs-Tokens.** Ein Token gibt Vollzugriff inklusive Schreibrechten
  auf Sammlung, Wantlist und Bestellungen — es gibt keine Scopes. Das gehört
  nicht auf einen fremden Rechner.
- **Kein Scannen von Inventaren.** Der Hub hat *eine* IP. Alle Nutzer teilten
  sich wieder 60 Requests pro Minute — genau die Grenze, die die
  Client-Architektur gerade losgeworden ist.
- **Kein Discogs-Proxy.** Wäre ToS-grenzwertig („circumvent rate limits") und
  machte den Hub zum Flaschenhals.
- **Keine Marktplatzdaten.** Preise und Zustände sind Restricted Data
  (`docs/09` §1.3) und werden hier nicht angenommen.

## Starten

```
docker compose -f hub/compose.yml up
```

Oder direkt, ohne Docker:

```
cd hub && node --experimental-sqlite src/server.ts
```

SQLite kommt aus `node:sqlite` — in Node 22/23 hinter einem Flag, ab Node 24
ohne. Kein Treiber, keine native Abhängigkeit, keine Kompilierung.

## Zugang

Ein geteiltes Geheimnis, kein Nutzerkonto — für einen Freundeskreis reicht das
(`docs/13` §2). Setze `HUB_SECRET`; Clients schicken es als `x-hub-secret`.
Without a secret or an access key the hub refuses to start (since 0.112). An open hub is
a choice you write down: `HUB_OPEN=1` — inside a home network only.

## Der Wächter

Standardmäßig **aus**. Er ist das Einzige in diesem Dienst, das von sich aus nach draußen
geht — alles andere antwortet nur, wenn es gefragt wird.

```bash
HUB_WATCH=1 HUB_VAPID_SUBJECT=mailto:du@example.de docker compose up -d
```

Er sieht bei jedem beobachteten Laden höchstens einmal pro Stunde nach, wie viele Platten
dort im Angebot sind, und schickt eine Benachrichtigung, wenn es mehr geworden sind. **Eine
Abfrage für alle**, statt einer je Laden und Nutzer — das ist der eigentliche Grund, warum
es diesen Dienst gibt.

Was er dabei nicht tut:

- **Kein Token.** `GET /users/{name}` gibt die Zahl ohne Anmeldung heraus.
- **Kein Scan.** Eine Zahl je Laden, keine zweihundert Seiten Inventar. Das Durchsuchen
  eines Ladens gehört auf das Gerät des Nutzers, dessen IP ihr eigenes Budget hat.
- **Keine Meldung beim ersten Blick.** Der erste Stand ist eine Grundlinie; sonst bekäme
  jeder, der einen Laden neu aufnimmt, sofort eine Nachricht über zweitausend „neue"
  Platten.
- **Keine Meldung nach unten.** Ein Laden, der etwas verkauft, ist keine Nachricht.

Die VAPID-Schlüssel werden beim ersten Start erzeugt und liegen in der Datenbank. Sie
müssen bleiben: der öffentliche Teil steckt in jeder Push-Anmeldung, die je vergeben wurde.


## The second door: access keys (M22)

A hub with `HUB_SECRET` has one door, and every row is the self-hoster's. A hosted hub
takes keys instead: signed statements (`fk1.<payload>.<sig>`, Ed25519) with a subject, a
tier and an end date, verified with a public key and nothing else.

```
HUB_ACCESS_PUBLIC_KEY   32 raw bytes, base64url — what `scripts/access-keys.ts generate` prints
HUB_ACCESS_URL          the access service; `/v1/revoked` is read once an hour (optional)
HUB_ACCESS_REVOKED      revoked key ids by hand, comma-separated (optional)
```

Both doors may be open at once. Issue a key by hand — the beta's way — with the private
half, which never goes on the hub:

```
HUB_ACCESS_PRIVATE_KEY=./issuer.pem node scripts/access-keys.ts issue <subject> beta 90
```

A key holder shares the hub with people they don't know, so a key gets limits the secret
does not (constants in `src/app.ts`):

| Answer | When |
|---|---|
| `403` | more than 3 vaults, 50 live shares, 5 push endpoints or 50 shops — counting only vaults and shops the hub wrote in the last 30 days, by its own clock (a client's `seenAt` does not count). Rewriting one's own vault or shop last written longer ago counts as a new one |
| `429` + `retry-after: 1` | a second large upload (vault, share, horizon) on the same route while the first is still sending |
| `409` | a share id that already exists — shares are never overwritten (on every door) |
| `stored: false` | a horizon chunk or family another key wrote less than 30 days ago (counted from its first write). Such a cover is not refused either: it is silently left out of the `stored` count. The hold binds every other writer, the secret door included; rows from the secret door or from before the owner column have no owner and are open to everyone |

The hub deletes expired shares, horizon chunks and families past the 30-day client TTL,
and watch state for shops nobody watches, once an hour.


## Backups and the drill (M23)

`scripts/backup.ts` makes a consistent copy of the hub's file once a day with `node:sqlite`'s
online backup — `hub-<date>.sqlite` in `HUB_BACKUP_DIR`, fourteen kept — while the hub keeps
writing. The VAPID keys are in every copy; the rest is a cache. `scripts/restore-drill.ts`
starts a throwaway hub on the newest copy and reads health: exit 0 means the copies are
worth something. Both run from the hub's image with a different command; see
`deploy/compose.homelab.yml` (`hub-backup`). The hub's volume is mounted writable there on
purpose: SQLite in WAL mode needs the `-shm` file even to read, and behind `:ro` the copy
fails with "unable to open database file".
