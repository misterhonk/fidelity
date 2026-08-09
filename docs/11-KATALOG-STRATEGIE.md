# 11 – Katalog-Strategie: Horizont statt Volldump

> **Entscheidung:** Der 10,4-GB-Releases-Dump wird **nicht** gebraucht.
> Stattdessen bauen wir bedarfsgesteuert einen **Horizont** – die Teilmenge des
> Discogs-Katalogs, die für *diesen Nutzer* relevant ist.
> Ersetzt den ursprünglichen Ansatz aus ADR-005.

---

## 1. Der Denkfehler im ersten Entwurf

Die ursprüngliche Überlegung war:

> „Ein Inventar-Listing enthält keine `master_id`, keine Genres, keine Credits.
> Also müssen wir für jedes der 10.000 Listings die Metadaten nachschlagen.
> Das kostet 10.000 Requests ≈ 3 Stunden. Also brauchen wir den Volldump."

Der Fehler steckt in „für jedes Listing". **Die Abfragerichtung war falsch herum.**

```
FALSCH:  10.000 Inventar-Listings  →  je 1 Request  →  Metadaten
         teuer, flüchtig, pro Dig neu

RICHTIG: ~150 Entitäten aus MEINER Sammlung  →  je 1–11 Requests  →  Release-ID-Mengen
         einmalig, langlebig, danach ist jeder Dig eine Set-Intersection zum Nulltarif
```

Meine Sammlung ist klein (2.412 Platten, 418 Künstler, 197 Labels) und ändert sich
langsam. Das Inventar ist groß und wechselt ständig. **Man cacht die kleine, stabile
Seite – nicht die große, flüchtige.**

---

## 2. Live gegen die API verifiziert (2026-08-09)

### `GET /artists/{id}/releases` liefert ein `role`-Feld

```
GET /artists/40135/releases?per_page=100    (Conny Plank)
→ 1.095 Einträge · 11 Requests · keine Seitengrenze

Rollenverteilung Seite 1:  { Main: 13, Remix: 11, Producer: 76 }
Typen Seite 3:             { master: 72, release: 28 }
```

**Das ist der entscheidende Fund.** Der Endpunkt liefert nicht nur die Alben, auf denen
jemand Hauptkünstler ist, sondern **auch die, die er produziert, gemischt oder geremixt
hat** – mit expliziter Rollenangabe.

Damit ist der **Credit-Graph (Signal S8) ohne Dump erreichbar.** Elf Requests für Conny
Planks komplettes Werk. Danach ist „Hat dieser Händler eine Conny-Plank-Produktion, die
mir fehlt?" ein `WHERE release_id = ANY(...)` – null zusätzliche Requests, egal wie oft.

### `GET /masters/{id}/versions` liefert alle Pressungen

```
GET /masters/2598/versions?per_page=100     (Neu! – Neu! 2)
→ 55 Pressungen · 1 Request

release_id 29630659 · Germany · 1973 · brain 1028
release_id  2248441 · France  · 1973 · 6499 591
release_id  1086110 · UK      · 1973 · UAG 29500
   …
```

Damit ist **Signal S2 (anderes Pressing) ohne Dump erreichbar.** Ein Request pro
Wantlist-Album, einmalig.

---

## 3. Der Horizont

Nach dem Sammlungs-Sync ermittelt die App, welche Entitäten für den Nutzer relevant sind,
und expandiert sie in Release-ID-Mengen.

| Was | Auswahlkriterium | Endpunkt | Requests |
|---|---|---|---|
| **Wantlist-Alben** | alle mit `master_id ≠ 0` | `/masters/{id}/versions` | ~1 pro Album |
| **Künstler** | ≥ 2 Platten in der Sammlung | `/artists/{id}/releases` | 1–11 pro Künstler |
| **Labels** | Lift ≥ 2 **und** < 1.500 Releases | `/labels/{id}/releases` | 1–15 pro Label |
| **Credits** | Personen mit Lift ≥ 3 in der Sammlung | `/artists/{id}/releases` | 1–11 pro Person |

### Kostenrechnung für eine reale Sammlung (2.412 Platten)

| Posten | Entitäten | Requests |
|---|---:|---:|
| Wantlist-Master | 184 | ~190 |
| Künstler mit ≥ 2 Platten | ~80 | ~210 |
| Labels mit Lift ≥ 2, klein genug | ~30 | ~160 |
| Produzenten/Engineers mit Lift ≥ 3 | ~20 | ~110 |
| **Summe, einmalig** | ~314 | **~670 ≈ 12 Minuten** |

Danach nur noch Deltas: neue Platte in der Sammlung → 1–11 Requests.
Turnusmäßige Revalidierung: 30 Tage, gestaffelt, ~20 Requests/Tag.

**Zum Vergleich der Dump-Weg:** 10,4 GB Download, ~110 GB entpacktes XML, Stunden
Parsing, ~6 GB Datenbank, 1,5–3 GB rsync – **jeden Monat neu.**

---

## 4. Wie ein Dig danach abläuft

```
Vorher (Dump-Ansatz):
  Inventar holen → für jedes Listing im 20-Mio-Zeilen-Katalog nachschlagen

Jetzt (Horizont, im Browser):
  Inventar holen → horizonIndex.get(listing.releaseId)
                   eine Map-Abfrage in O(1) ueber ein paar hunderttausend IDs
```

Beide Wege kosten **null zusätzliche API-Requests pro Dig**. Der Unterschied ist
ausschließlich, wie die Nachschlagetabelle entstanden ist.

### Der Master/Release-Zweischritt

`/artists/{id}/releases` liefert gemischt `type: "master"` und `type: "release"`.
Master-Einträge tragen `main_release`. Vorgehen:

1. **Stufe 1 – gratis:** `main_release_id` und alle direkten `release`-IDs in den Horizont.
   Deckt die Hauptpressung ab.
2. **Stufe 2 – bedarfsgesteuert:** Trifft ein Inventar-Listing *nicht*, gehört aber
   plausibel dazu (gleicher Künstlername, ähnlicher Titel), wird der Master per
   `/masters/{id}/versions` nachexpandiert – **ein** Request, danach dauerhaft im Horizont.

Die zweite Stufe läuft asynchron nach dem Dig. Der Horizont wird also mit jedem Dig etwas
besser. Das ist ein Feature, kein Workaround.

---

## 5. Was man dadurch verliert – ehrlich

| Einschränkung | Auswirkung | Bewertung |
|---|---|---|
| **Große Labels nicht expandierbar** | RCA hat 186.808 Releases = 1.869 Requests | Egal. Completism bei Majors ergibt keinen Sinn – das Signal zielt auf Brain, Ohr, Blue Note, ECM. Harte Grenze: 1.500 Releases, darüber kein `CATALOG_RUN`. |
| **Credit-Graph reicht nur so weit wie die Sammlung** | „Alle Kollaborateure zweiten Grades von Conny Plank" geht nicht | Egal für die Kernfunktion. Wäre eine Explorationsfunktion, kein Kaufberater. |
| **Kein globaler `release → master`-Index** | Ein Listing außerhalb des Horizonts bleibt unaufgelöst | Genau richtig. Ein Release außerhalb deines Horizonts ist per Definition keine Empfehlung. |
| **Ersteinrichtung dauert ~12 Min** | Frisst das gemeinsame 60/min-Budget | Einmalig, im Hintergrund, mit Fortschrittsanzeige. Bei mehreren Nutzern über Nacht gestaffelt. |
| **Genres/Styles pro Listing fehlen weiterhin** | S7 nur für Releases im Horizont | Akzeptabel – Stil-Adjazenz ist mit Gewicht 30 ohnehin das schwächste Signal. |
| **ToS: API-Daten statt CC0** | Formal gilt die 6-Stunden-Regel für allen API-Content | Siehe §7. Argumentierbar, aber nicht so eindeutig wie CC0. |

---

## 6. Was man gewinnt

- **Kein 10,4-GB-Download, kein 110-GB-Parse, kein monatlicher Wartungstermin**
- **Statt ~6 GB auf einem Server nur ~1,4 MB im Browser des Nutzers** - als
  `Int32Array`-Parallelarrays gepackt, siehe `03-DATENMODELL.md` Abschnitt 4
- **M5 ist kein Brocken mehr**, sondern ein normaler Meilenstein. Die fünf teuren Signale
  rücken damit näher an M2
- **Der Horizont wächst mit der Nutzung** statt monatlich zu veralten
- **Kein XML-Streaming-Parser**, kein `pg_dump`/rsync-Tanz, keine Blau/Grün-Schema-Rotation
- **Die Daten sind aktueller als ein Monatsdump**

---

## 7. ToS-Bewertung

Die 6-Stunden-Regel gilt dem Wortlaut nach für allen API-`Content`. Wir bewegen uns
deshalb bewusst so:

- **Gespeichert werden nur ID-Mengen und Kanten** – `artist_id → release_id + role`.
  Keine Titel, keine Bilder, keine Preise, keine Zustände. Das ist kein anzeigbarer
  Content, sondern ein Index auf öffentliche Fakten.
- **Alles Anzeigbare kommt frisch** aus dem Inventory-Listing desselben Digs
  (Titel, Künstler, Label, Katalognummer, Preis, Zustand) und verfällt nach 6 Stunden
  über `app.dig.expires_at`.
- **Revalidierung alle 30 Tage** hält die Kanten aktuell.
- Dieselben Fakten stehen als **CC0-Dump** frei zur Verfügung – wir holen sie nur auf
  einem anderen Weg.

> **Fallback, falls das je beanstandet wird:** Die drei *kleinen* Dumps
> (`artists.xml.gz` 472 MB, `labels.xml.gz` 86 MB, `masters.xml.gz` 593 MB, zusammen
> 1,15 GB) sind CC0 und liefern Künstler- und Labelstammdaten inklusive Aliase,
> Namensvarianten und Sublabel-Hierarchien. Sie ersetzen die Kanten zwar nicht, decken
> aber die Stammdaten sauber ab. Der **releases**-Dump bleibt in jedem Fall draußen.

---

## 8. Wann der Volldump doch Sinn ergibt

Nicht dogmatisch sein. Der Dump-Weg wird wieder interessant bei:

- **mehreren hundert Nutzern** – dann amortisiert sich ein gemeinsamer globaler Index
  gegenüber vielen individuellen Horizonten
- **Explorationsfunktionen über den eigenen Horizont hinaus** („zeig mir alle
  Krautrock-Produzenten der 70er, egal was ich besitze")
- **Offline-Analysen** über den gesamten Katalog
- **Reichlich Platte** – auf einem VPS mit 40 GB ist der Dump-Weg kein Problem mehr

Dann ist es eine **additive** Entscheidung: Der Horizont bleibt, der globale Index kommt
darunter. Nichts an der Matching-Engine muss sich dafür ändern – sie fragt eine Tabelle,
nicht eine Datenquelle.
