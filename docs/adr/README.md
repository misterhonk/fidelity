# Architecture Decision Records

Kurze Notizen zu Entscheidungen, die schwer rückgängig zu machen sind.

**Vorlage:**

```markdown
# ADR-NNN: <Titel>

**Status:** Vorgeschlagen | Akzeptiert | Ersetzt durch ADR-XXX
**Datum:** YYYY-MM-DD

## Kontext
Was ist die Situation? Welche Zwänge gelten?

## Entscheidung
Was wird gemacht?

## Alternativen
Was wurde erwogen und warum verworfen?

## Konsequenzen
Was wird dadurch leichter, was schwerer? Was ist der Ausstiegspfad?
```

| ADR | Titel | Status |
|---|---|---|
| [007](007-client-only-pwa.md) | **Reine Client-PWA ohne Backend** | **Akzeptiert** |
| [008](008-optionaler-hub.md) | Optionaler, selbst hostbarer Hub | Vorgeschlagen (M9) |
| [006](006-haendler-zuerst.md) | Händlerzentriert statt wantlistzentriert | Akzeptiert |
| [005](005-katalog-aus-dumps.md) | Bedarfsgesteuerter Horizont statt Volldump | Akzeptiert |
| [001](001-nuxt-statt-laravel.md) | Nuxt/Vue statt Laravel/PHP | Akzeptiert, tlw. ersetzt von 007 |
| [002](002-postgres-statt-sqlite.md) | PostgreSQL statt SQLite | ersetzt von 007 |
| [003](003-drizzle-gepinnt.md) | Drizzle 0.45 gepinnt | ersetzt von 007 |
| [004](004-ein-prozess.md) | Ein Node-Prozess für App und Worker | ersetzt von 007 |

**ADR-007 ist der wichtigste Eintrag.** Er ersetzt die serverseitige Hälfte des
ursprünglichen Entwurfs vollständig. Wer nur ein Dokument liest, liest dieses.
