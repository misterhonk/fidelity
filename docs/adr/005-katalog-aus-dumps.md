# ADR-005: Bedarfsgesteuerter Horizont statt Volldump

**Status:** Akzeptiert · **Datum:** 2026-08-09
**Ersetzt:** die erste Fassung dieses ADR („Katalog aus CC0-Dumps, lokal gebaut")

## Kontext

Fünf der elf Match-Signale brauchen Daten, die ein Inventory-Listing **nicht** enthält:
`master_id`, Genres, Styles, Land, Credits, vollständige Labelliste.

Die erste Überlegung war: für jedes der 10.000 Listings `/releases/{id}` aufrufen – das
kostet rund 3 Stunden pro Dig. Daraus folgte scheinbar zwingend der 10,4-GB-Volldump.

**Der Schluss war falsch, weil die Abfragerichtung falsch war.**

## Entscheidung

Wir cachen nicht die große, flüchtige Seite (das Inventar), sondern die **kleine, stabile**
(die Sammlung des Nutzers). Nach dem Sammlungs-Sync werden die relevanten Entitäten
einmalig in Release-ID-Mengen expandiert – der **Horizont**. Jeder Dig ist danach eine
Set-Intersection ohne einen einzigen zusätzlichen Request.

Verifiziert am 2026-08-09 gegen die Produktions-API:

- `GET /artists/{id}/releases` liefert ein **`role`-Feld** (`Main`, `Producer`, `Remix`, …)
  → Conny Plank: **1.095 Einträge in 11 Requests**. Damit ist der Credit-Graph (S8)
  ohne Dump erreichbar.
- `GET /masters/{id}/versions` liefert alle Pressungen mit `release_id`
  → Neu! 2: **55 Pressungen in 1 Request**. Damit ist S2 ohne Dump erreichbar.

Kosten für eine 2.412-Platten-Sammlung: **~670 Requests ≈ 12 Minuten, einmalig.**

## Alternativen

**Volldump (`releases.xml.gz`)** – der ursprüngliche Plan. 10,4 GB komprimiert, ~110 GB
entpackt, Streaming-Parser, ~6 GB Datenbank, 1,5–3 GB rsync – **monatlich**. Verworfen:
Der Aufwand steht in keinem Verhältnis, solange wir keine dreistellige Nutzerzahl haben.
Rechtlich (CC0) war er sauberer, praktisch ist er für 5–30 Nutzer grotesk überdimensioniert.

**`/releases/{id}` pro Listing** – ~3 Stunden pro Dig. Nie eine Option.

**Nur die kleinen Dumps** (artists 472 MB + labels 86 MB + masters 593 MB = 1,15 GB, CC0) –
liefern Stammdaten, Aliase und Sublabel-Hierarchien, aber **keine Kanten**
(release→master, Credits). Bleibt als optionale Ergänzung und als ToS-Fallback.

## Konsequenzen

**Leichter:** Kein Download, kein XML-Parser, keine Blau/Grün-Schema-Rotation, kein
monatlicher Wartungstermin. ~300–500 MB statt ~6 GB – damit ist Uberspaces 10-GB-Quota
kein Engpass mehr. M5 schrumpft von „der große Brocken" auf einen normalen Meilenstein.
Der Horizont wächst mit der Nutzung, statt monatlich zu veralten.

**Schwerer:** Große Labels (> 1.500 Releases) sind nicht expandierbar – dort feuert
`CATALOG_RUN` nicht. Der Credit-Graph reicht nur so weit wie die eigene Sammlung. Die
Ersteinrichtung kostet ~12 Minuten Rate-Limit-Budget pro Nutzer. Und: API-Daten
unterliegen formal der 6-Stunden-Regel, während der Dump CC0 wäre – wir speichern deshalb
ausschließlich ID-Kanten, nie anzeigbaren Content (siehe `11-KATALOG-STRATEGIE.md` §7).

**Ausstiegspfad:** Die Matching-Engine fragt eine **Tabelle**, keine Datenquelle. Ein
globaler Index aus dem Volldump ließe sich später **additiv** darunterlegen, ohne dass
sich an der Fachlogik etwas ändert. Auslöser dafür: dreistellige Nutzerzahl,
Explorationsfunktionen über den eigenen Horizont hinaus, oder ein VPS mit reichlich Platte.
