# CLAUDE.md

Arbeitsanweisungen für Claude Code in diesem Repository.

---

## Was das hier ist

**Fidelity** – ein Kaufberater für Discogs. Scannt das Sortiment eines Händlers, gleicht es
gegen Sammlung und Wantlist des Nutzers ab, liefert eine bewertete Fundliste mit
Begründungssatz pro Treffer.

**Lies vor der ersten Aufgabe:** `docs/00-KONZEPT.md`, `docs/01-ARCHITEKTUR.md`,
`docs/02-DISCOGS-API.md`.

---

## Die fünf Regeln, die du nie brechen darfst

1. **Niemals `/releases/{id}` in einer Scan-Schleife.**
   10.000 Releases = 10.000 Requests ≈ 3 Stunden. Release-Metadaten kommen aus dem
   `catalog`-Schema (CC0-Dumps) oder gar nicht.

2. **Niemals nebenläufige Discogs-Requests.**
   Das Rate-Limit gilt **pro IP**. Parallelität erzeugt nur 429er. Genau ein In-Flight-
   Request app-weit, gesteuert über den zentralen Client in `server/lib/discogs/`.

3. **Niemals Marktplatzdaten älter als 6 Stunden anzeigen.**
   ToS-Vorgabe. `app.dig.expires_at` erzwingt das im Datenmodell. Nicht umgehen, nicht
   „nur für die Entwicklung" aushebeln.

4. **Niemals scrapen.** Kein `discogs.com/sell/…`-HTML, kein undokumentiertes
   `/marketplace/search`. Nur dokumentierte API-Endpunkte.

5. **Niemals OAuth-Tokens loggen, ausgeben oder an den Client schicken.**
   Verschlüsselt via `pgcrypto`, Redaction-Liste im Logger.

---

## Fakten über die Discogs-API, die du dir merken musst

| Fakt | Konsequenz |
|---|---|
| **Max. 10.000 Listings** pro fremdem Händler (Seite 101 → 403) | `sort_order` asc+desc für 20.000; Coverage ehrlich anzeigen |
| `pagination.pages` **lügt** bei Inventory | Nie darauf verlassen, immer auf 403 vorbereitet sein |
| **60 Req/min pro IP**, gleitendes Fenster | Token-Bucket über `X-Discogs-Ratelimit-Remaining` steuern, nicht über eigenen Zähler |
| **Kein `Retry-After`** bei 429 | Eigener exponentieller Backoff mit Jitter |
| `X-Discogs-Ratelimit-Used` ist **nicht monoton** | Nur `-Remaining` als Steuergröße nutzen |
| Inventory-`release` hat **kein `master_id`, kein `genre`/`style`** | „Anderes Pressing" braucht das `catalog`-Schema |
| Inventory-`release.label` ist **nur das erste Label** | Multi-Label-Releases werden unterschätzt |
| Inventory-`artist` ist ein **String ohne IDs** | Fuzzy-Kaskade: exact → Token → `pg_trgm` |
| `status`-Filter wird bei fremden Händlern **ignoriert** | Clientseitig filtern |
| **Zwei Fehlerformate** (legacy + FastAPI) | Beide parsen |
| **User-Agent ist Pflicht** | Sonst leere Antwort oder 403 |
| Bilder: **separates Cloudflare-Limit** (~30–40/min) | Bilder **nur** clientseitig laden, nie serverseitig |
| Wantlist-Pfad heißt **`/wants`**, nicht `/wantlist` | |
| OAuth: **PLAINTEXT-Signatur**, von Discogs empfohlen | Kein HMAC-SHA1, spart die Base-String-Hölle |
| Fast alle Wantlists sind **privat** | OAuth ist Pflicht, auch für eigene Daten |

Vollständig: `docs/02-DISCOGS-API.md`.

---

## Codekonventionen

**Sprache:** Code, Kommentare, Commits, Variablennamen: **Englisch**.
Nutzersichtbare Texte und die Projektdokumentation: **Deutsch**.

```
server/lib/discogs/    Der einzige Ort, an dem HTTP zu Discogs stattfindet.
                       Kein anderes Modul ruft die API direkt auf.
server/lib/match/      Scoring-Engine. REINE FUNKTIONEN, kein I/O, keine DB.
                       Das ist Absicht – so ist sie Golden-File-testbar.
server/jobs/           pg-boss Job-Handler.
server/db/             Drizzle-Schema und Migrationen.
shared/                Zod-Schemas und Typen für beide Seiten.
app/                   Nuxt: pages, components, composables.
scripts/catalog/       Dump-Pipeline. Läuft NUR lokal, nie in Produktion.
```

**TypeScript:** `strict`. Kein `any`. Externe Daten (API-Antworten, Formulare) immer durch
ein Zod-Schema an der Grenze.

**Geld:** `numeric(10,2)` in der DB, in TS als Integer-Cents oder `decimal.js`.
**Niemals `float` für Preise.**

**Zeit:** immer `timestamptz`, immer UTC in der DB, Formatierung nur in der UI.

---

## Commits

Conventional Commits, erzwungen durch commitlint:

```
feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(match): add trigram index on normalized artist names
docs(api): document the 10k pagination wall
```

Scopes: `dig` `match` `discogs` `auth` `catalog` `basket` `ui` `db` `deploy`

Releases macht `release-please`. **Version niemals von Hand hochsetzen**,
**CHANGELOG.md niemals direkt für ein Release editieren** – nur im Release-PR nachschärfen.

---

## Tests

Vor jedem PR: `pnpm lint && pnpm typecheck && pnpm test:unit`

**Score-Formel:** stärkstes Signal + 0,3 × Summe der übrigen, skaliert auf 115 = 100 Punkte.
`SCALE` und `SECONDARY` sind **Konstanten und bleiben es** – wer sie pro Meilenstein
nachjustiert, macht Scores über die Zeit unvergleichbar. Details in
`docs/04-MATCHING-ENGINE.md` §4.

**Der wichtigste Test des Projekts** ist der Golden-File-Test der Scoring-Engine
(`tests/unit/scoring.spec.ts`). Er läuft gegen eingefrorene Fixtures echter Inventare und
Sammlungen. **Jede Änderung an Signalgewichten muss den Snapshot aktualisieren** – und der
Diff muss im PR erklärt werden. Ohne das ist die Score-Entwicklung Blindflug.

Discogs-API im Test: **immer gemockt**. Fixtures unter `tests/fixtures/`. Ein echter
Smoke-Test läuft nightly, nicht pro PR.

---

## Wenn du unsicher bist

- **Neue Discogs-Endpunkte:** erst `docs/02-DISCOGS-API.md` prüfen. Steht er nicht drin,
  vor der Nutzung Request-Kosten und Auth-Anforderungen recherchieren und dort ergänzen.
- **Architekturentscheidungen:** ADR unter `docs/adr/` anlegen (Vorlage: ADR-001).
- **Neue Signale in der Matching-Engine:** erst `docs/04-MATCHING-ENGINE.md` erweitern,
  dann implementieren. Gewicht begründen.
- **Neue Abhängigkeit:** Ist sie nötig? Uberspace hat 1,5 GB RAM und 10 GB Platte.
  Jede Abhängigkeit ist eine Wette auf deren Wartung.

## Was du nicht ohne Rückfrage tun sollst

- Den Stack wechseln oder eine Kernabhängigkeit ersetzen (Nuxt, Postgres, Drizzle, pg-boss)
- Drizzle auf die 1.0-RC-Linie heben (bewusst gepinnt, siehe ADR-003)
- Auf TypeScript 7 wechseln (vue-tsc/typescript-eslint hinken noch)
- Redis/Valkey einführen (RAM-Budget)
- Serverseitiges Bild-Fetching einbauen
- Die 6-Stunden-Regel oder das `expires_at`-Feld anfassen
