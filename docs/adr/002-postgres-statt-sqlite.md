# ADR-002: PostgreSQL statt SQLite

**Status:** Akzeptiert · **Datum:** 2026-08-09

## Kontext

Produktion läuft auf Uberspace: 1,5 GB RAM für alle Prozesse, 10 GB Platte, kein Docker.
SQLite wäre dort erheblich einfacher – kein Daemon, kein RAM-Overhead, Backup = Datei
kopieren, Deploy = Datei rsyncen. Nutzerzahl: 5–30.

## Entscheidung

**PostgreSQL** (Major-Version = die auf Uberspace verfügbare, lokal identisch gepinnt),
mit `pg_trgm`, `unaccent`, `pgcrypto`.

## Alternativen

**SQLite/libSQL** – ernsthaft erwogen, an drei Punkten gescheitert:
1. Der Credit-Graph (Signal 8) und die Diskografie-Lücken (Signal 4) sind echte
   relationale Graph-Abfragen über 30M+ Zeilen
2. `pg_trgm` ist das Rückgrat des Fuzzy-Matchings; SQLites `spellfix1`/`editdist3` sind
   kein gleichwertiger Ersatz
3. Web-Tier und Job-Worker schreiben gleichzeitig; `FOR UPDATE SKIP LOCKED` gibt es nicht

Wir würden binnen eines Jahres migrieren – dann lieber gleich richtig.

**MariaDB** (Uberspace-Default) – kein `pg_trgm`, schwächere Volltextsuche, kein JSONB.

## Konsequenzen

**Leichter:** Fuzzy-Matching, Katalog-Joins, Queue (pg-boss statt Redis), späteres
`pgvector` für Stil-Adjazenz.

**Schwerer:** Ein Daemon mehr im 1,5-GB-Budget (~250 MB bei `shared_buffers=128MB`).
Uberspace-spezifische Einrichtung über supervisord. Version wahrscheinlich älter als das
lokal aktuellste Postgres – deshalb wird lokal auf dieselbe Major gepinnt.

**Ausstiegspfad:** Falls das RAM reißt, siehe Eskalationsliste in `08-DEPLOYMENT.md` §6.
Ein VPS-Umzug ist vorbereitet (Docker-Image existiert).
