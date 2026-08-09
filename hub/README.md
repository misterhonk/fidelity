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
Ohne gesetztes Secret startet der Hub im offenen Modus und sagt das beim Start.
