# ADR-004: Ein Node-Prozess für App und Worker

**Status:** Akzeptiert · **Datum:** 2026-08-09

## Kontext

Reine Lehre wäre: Web-Tier und Job-Worker als getrennte Prozesse. Uberspace gibt
**1,5 GB RAM für alles**. Postgres braucht ~250 MB, jeder Node-Prozess ~200–250 MB.

## Entscheidung

**Ein Nitro-Prozess.** Der pg-boss-Worker startet als Nitro-Plugin in-process.

## Begründung

Der Scan ist **I/O-gebunden bei einem Request pro Sekunde**. Er verbraucht praktisch keine
CPU und konkurriert nicht mit dem Request-Handling. Ein zweiter Prozess kostete ~200 MB
für einen Vorteil, den wir bei 5–30 Nutzern nicht messen könnten.

## Konsequenzen

**Leichter:** Halbes RAM-Budget, ein supervisord-Service, ein Deploy-Artefakt, ein Logstream.

**Schwerer:** Kein unabhängiges Skalieren. Ein Crash im Worker reißt die Web-App mit
(Mitigation: Job-Handler in Try/Catch, `autorestart=true`). Ein CPU-intensiver Job – etwa
der Optimierer bei sehr großen Körben – kann Requests blockieren
(Mitigation: Kandidaten auf 200 deckeln, Greedy statt exakter Solver).

**Ausstiegspfad:** pg-boss ist ohnehin prozessübergreifend. Der Worker lässt sich mit
wenigen Zeilen als eigener Entry-Point (`server/worker.mjs`) plus zweitem
supervisord-Service herauslösen. **Auslöser:** > 50 Nutzer, mehrere parallele Digs,
oder messbare Request-Latenz während eines Scans.
