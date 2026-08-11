# Mitarbeiten

Danke fürs Hinsehen. Dieses Dokument ist kurz, weil das Wichtigste woanders steht:
[`CLAUDE.md`](CLAUDE.md) hält die Regeln fest, die dieses Projekt zusammenhalten, und
[`docs/`](docs/) begründet sie.

---

## Womit es läuft

**Node ≥ 22.5** und **pnpm**. Sonst nichts — keine Datenbank, kein Docker, kein Seed.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Der Hub ist ein eigenes Paket mit eigenen Tests und ohne Abhängigkeit zur App:

```bash
cd hub
node --test test/*.test.ts
```

## Bevor du etwas einreichst

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm size
```

Dazu **`pnpm test:e2e`**, wenn du an Bildschirmen etwas geändert hast. Der Pre-Commit-Hook
prüft nur Format, Lint, Typen und die Unit-Tests — Playwright läuft dort nicht, weil er
Minuten braucht. Wer sich auf den Hook verlässt, pusht irgendwann eine rote Suite. (Das
ist keine Vermutung. Genau so ist es passiert.)

Und: **lies die Zusammenfassung eines Testlaufs, nicht die letzte Zeile.** `| tail -3`
zeigt bei Playwright den letzten grünen Test, nicht das Ergebnis.

---

## Die Regeln, die nicht verhandelbar sind

Vollständig und begründet in [`CLAUDE.md`](CLAUDE.md). Die Kurzfassung, weil jede einzelne
schon einmal jemanden gekostet hat:

**Kein Backend.** Keine Datenbank, kein Serverprozess. Wenn eine Aufgabe nach einem Server
verlangt, ist die Aufgabe falsch gestellt — frag nach.
([ADR-007](docs/adr/007-client-only-pwa.md))

**Nie `/releases/{id}` in einer Schleife über alles.** Zehntausend Releases sind drei
Stunden. Einzelne, bedarfsgesteuert, für das, was jemand ansieht: in Ordnung. Alle: nie.

**Nie nebenläufige Discogs-Anfragen.** Genau eine gleichzeitig, 1.200 ms mit Token,
2.400 ms ohne — und zwar **über alle Tabs hinweg**, denn das Limit gilt pro IP und ein Tab
ist keine IP. Alles läuft durch den einen Client im Worker.

**Nie Marktplatzdaten älter als sechs Stunden anzeigen.** Das sind die Bedingungen, unter
denen wir die API benutzen dürfen. Nicht umgehen, auch nicht „nur zum Entwickeln".

**Nie scrapen.** Nur dokumentierte Endpunkte. Es gibt genau eine benannte Ausnahme mit
eigener ADR ([ADR-009](docs/adr/009-haendler-import.md)); eine zweite braucht eine zweite.

**Der Token verlässt IndexedDB nicht.** Nie in ein Log, nie in eine URL, nie in einen
Fehlerbericht, nie an einen Hub.

**Jede neue Abhängigkeit muss ihre Bytes rechtfertigen.** Das Budget ist 120 kB gzip für
den ersten sinnvollen Paint, und `pnpm size` bricht den Build, wenn es reißt.

**Kein Feature darf den Hub voraussetzen.** Er beschleunigt. Hub-Abfragen laufen mit zwei
Sekunden Zeitlimit, ohne Wiederholung, und fallen lautlos auf den lokalen Weg zurück.

---

## Wie hier geschrieben wird

**Sprache:** Code, Kommentare, Commits und Variablennamen auf **Englisch**. Alles, was ein
Nutzer liest, und die Projektdokumentation auf **Deutsch**.

**Nutzersichtbarer Text spricht nicht über die Maschine.** Keine „Requests", keine
„Entitäten", kein „IndexedDB", keine ADR-Nummern. Kosten werden in Minuten genannt, nicht
in Anfragen — das ist die Einheit, in der jemand plant. Und sag, was etwas bringt, nicht,
was es nicht bringt.

**Kommentare erklären das Warum.** Was der Code tut, steht im Code. Warum er es so tut —
und was die Alternative gekostet hat — steht darüber. Besonders bei allem, was aus einer
Messung folgt: dann gehört die Messung mit Datum dazu.

**Miss, statt zu behaupten.** Die meisten harten Entscheidungen in diesem Projekt kommen
aus einem Versuch gegen die echte API oder einen echten Browser. Wenn du etwas über
Discogs, einen Browser oder eine Grenze schreibst: prüf es, notier das Datum, und wenn du
es nicht prüfen konntest, schreib das hin.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), erzwungen durch commitlint.

```
feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(horizon): pack release ids as Int32Array
docs(api): document the 10k pagination wall
```

Scopes: `dig` `match` `discogs` `horizon` `auth` `basket` `watch` `dealers` `hub` `demo`
`sync` `ui` `db` `pwa` `deploy` `deps`. Ein neuer Scope gehört in
`commitlint.config.mjs` **und** in `CLAUDE.md` — sonst driften die beiden Listen
auseinander.

Der Text darunter darf lang sein. Er ist oft die einzige Stelle, an der steht, warum eine
Änderung nötig war.

## Releases

Macht `release-please` aus den Commits. **Die Version niemals von Hand hochsetzen**, und
`CHANGELOG.md` nie direkt für ein Release bearbeiten — nur im Release-PR nachschärfen.

---

## Tests

**Der wichtigste Test des Projekts** ist der Golden-File-Test der Scoring-Engine
(`tests/unit/scoring.spec.ts`) gegen eingefrorene echte Inventare und Sammlungen. Jede
Änderung an Signalgewichten muss den Snapshot aktualisieren — **und der Diff muss im PR
erklärt werden.** Ein stillschweigend neu aufgenommener Snapshot ist kein Test.

`SCALE` und `SECONDARY` in der Score-Formel sind Konstanten und bleiben es. Wer sie pro
Meilenstein nachjustiert, macht Punktzahlen über die Zeit unvergleichbar.

**Außerdem Pflicht:**

- Discogs wird im Test **immer** gemockt. Fixtures unter `tests/fixtures/`. Die Suite darf
  keine echte API brauchen — sonst scheitert CI aus Gründen, die nichts mit dem Code zu
  tun haben.
- Playwright **inklusive WebKit**. Das schwächste Ziel ist iOS Safari, und es verhält sich
  regelmäßig anders als Chrome.
- 20.000 synthetische Listings müssen in unter 250 ms bewertet werden.
- `pnpm size` hält das Bundle-Budget.

**Prüf deine Wachen, indem du sie brichst.** Wenn ein Test eine Bedingung absichern soll,
dreh die Bedingung einmal um und sieh nach, ob der Test wirklich umfällt. Ein Test, der
grün bleibt, wenn man das Geprüfte kaputtmacht, prüft nichts.

## Entscheidungen

Alles, was schwer rückgängig zu machen ist, kommt als ADR nach `docs/adr/` — Vorlage ist
[ADR-001](docs/adr/001-nuxt-statt-laravel.md). Auch die verworfenen bleiben stehen: die
Geschichte einer Entscheidung ist die Hälfte ihres Werts.

Ein neues Signal für die Matching-Engine wird erst in
[`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) beschrieben und dann gebaut.

Ein neuer Discogs-Endpunkt kommt erst in [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md)
— mit Kosten, Auth-Anforderung und CORS-Verhalten, gemessen.

---

## Noch offen: die Lizenz

Dieses Repository trägt **noch keine Lizenz**, und `package.json` steht auf `private`.
Ohne Lizenz behält der Urheber alle Rechte — Forken, Weiterverwenden und Weitergeben sind
damit nicht erlaubt, auch wenn der Quelltext sichtbar ist.

Wer etwas beitragen möchte, sollte das wissen. Und wer das Projekt öffnen will, muss diese
Entscheidung zuerst treffen; sie gehört dem Urheber und niemandem sonst.
