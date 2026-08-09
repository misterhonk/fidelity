# ADR-005: Katalog aus CC0-Dumps, lokal gebaut

**Status:** Akzeptiert · **Datum:** 2026-08-09

## Kontext

Fünf der elf Match-Signale brauchen Daten, die das Inventory-Listing **nicht** enthält:
`master_id`, Genres, Styles, Land, Credits, vollständige Labelliste.

Über die API kostet das `/releases/{id}` – **einen Request pro Release**. Bei 10.000
Listings sind das rund 3 Stunden. Unbrauchbar.

## Entscheidung

Ein **`catalog`-Schema aus den monatlichen Discogs-Data-Dumps**, gebaut auf dem lokalen
Rechner, als komprimierter `pg_dump` nach Uberspace übertragen. Read-only in Produktion.

## Warum das rechtlich sauber ist

Die Dumps stehen ausdrücklich unter **CC0** („No Rights Reserved"). Damit gelten für
Katalogdaten **keine** 6-Stunden-Regel, **keine** Attributionspflicht, **keine**
Speicherbegrenzung. Marktplatzdaten sind in den Dumps gar nicht enthalten – die
Lizenzwelten bleiben sauber getrennt.

## Warum lokal gebaut

`releases.xml.gz` ist 10,4 GB komprimiert, ~110 GB entpackt. Uberspace hat 10 GB Quota und
1,5 GB RAM. Verarbeitung dort ist ausgeschlossen. Lokal (Docker, viel Platte) ist es ein
Streaming-SAX-Parse und dauert Stunden statt Wochen.

## Konsequenzen

**Leichter:** Fünf zusätzliche Signale zum Nulltarif an Requests. Master-Auflösung,
Diskografie-Lücken und der Credit-Graph werden instantane SQL-Joins.

**Schwerer:** Ein manueller monatlicher Wartungsvorgang. ~6 GB von 10 GB Quota
(Schätzung – **vor M5 real messen**). Beim Refresh liegen kurzzeitig zwei Schemas
parallel; siehe `08-DEPLOYMENT.md` §4 für die Eskalationsstufen.

**Ausstiegspfad:** Signale S2/S4/S6/S8/S9 sind einzeln abschaltbar. Ohne `catalog`-Schema
funktioniert die App weiter – mit S1/S3/S5/S7. Das ist Absicht: **M2–M4 laufen komplett
ohne Katalog-DB.**
