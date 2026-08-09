# ADR-003: Drizzle 0.45 gepinnt, nicht 1.0-RC

**Status:** **Ersetzt durch ADR-007** · **Datum:** 2026-08-09

> **Gegenstandslos.** Kein Server, keine SQL-Datenbank, kein ORM.
> Dokument bleibt als Entscheidungshistorie erhalten.

## Kontext

Wir schreiben viel SQL-nahen Code: `pg_trgm`-Similarity, CTEs für Diskografie-Lücken,
Array-Operatoren, JSONB-Aggregation. Ein ORM, das sich dazwischendrängt, ist ein Gegner.

Drizzle passt fachlich am besten – aber **1.0 ist seit über 18 Monaten im RC**
(beta.2 im Februar 2025, immer noch RC im August 2026), und stable ist weiterhin die
0.45-Linie mit letztem Release im März 2026. Das ist ein Signal.

## Entscheidung

**Drizzle ORM 0.45.x, hart gepinnt.** Von Renovate ausgenommen. Upgrades nur manuell
und bewusst.

## Alternativen

**Drizzle 1.0-rc** – nein. Ein Projekt, das man behalten will, baut nicht auf einem RC,
der seit anderthalb Jahren RC ist.

**Prisma 7.9** – seit 7.0 ohne Rust-Query-Engine (was die Docker-/Bundling-Schmerzen
beseitigt hat) und mit stetiger Release-Kadenz. Verloren wegen SQL-Transparenz: bei
`pg_trgm`- und CTE-lastigen Queries kämpft man gegen Prisma.

**Kysely 0.29** – reiner typisierter Query-Builder, keine Migrations-Meinung. Bleibt
der Fallback.

## Konsequenzen

**Leichter:** Rohes SQL da, wo es hingehört. Kein Abstraktionskampf.

**Schwerer:** Wir sitzen möglicherweise auf einer stagnierenden Linie.

**Ausstiegspfad:** Weil die Query-Logik ohnehin SQL-nah geschrieben ist, wäre eine
Migration zu Kysely überschaubar – im Wesentlichen Schema-Definition und Migrations-Tooling.
**Auslöser für eine Neubewertung:** Drizzle 1.0 geht GA, oder die 0.45-Linie bekommt
6 Monate lang kein Sicherheitsupdate.
