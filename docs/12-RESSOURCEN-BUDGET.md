# 12 – Ressourcen-Budget

> Leitsatz: **Die günstigste Ressource ist die, die man nicht benutzt.**
> Diese App hat kein Backend. Was sie verbraucht, verbraucht sie auf dem Gerät des Nutzers –
> und auch dort sparsam.

---

## 1. Serverseitig: null

| Ressource | Verbrauch |
|---|---:|
| RAM | **0** |
| CPU | **0** |
| Datenbank | **keine** |
| Hintergrundprozesse | **keine** |
| Traffic | nur die statischen Dateien beim ersten Laden |
| Betriebskosten | **0 €** |

Gehostet werden ein paar hundert Kilobyte statischer Dateien. Uberspace-Docroot,
Cloudflare Pages oder GitHub Pages – überall kostenlos, überall austauschbar.

---

## 2. Bundle-Budget

Das Ding muss im Keller eines Plattenladens über 3G laden.

| Teil | Budget (gzip) | Stand M3 |
|---|---:|---:|
| HTML + kritisches CSS | ≤ 8 KB | |
| App-Shell JS (Vue + Router + UI-Kern) | ≤ 90 KB | |
| Matching-Engine (Worker, lazy) | ≤ 35 KB | 31,5 KB |
| Restliche Routen (lazy) | je ≤ 30 KB | 13,9 KB |
| **Erster sinnvoller Paint** | **≤ 120 KB** | **118 KB** |

> **Warum der Worker von 25 auf 35 KB gegangen ist (M3).** Die 25 KB waren
> geschätzt, bevor es Code gab. Gemessen sind es 31,5 KB, davon rund 16 KB Zod.
> Der naheliegende Ausweg wäre `zod/mini` gewesen – spart etwa 13 KB.
> Dagegen sprach: die Schemas *sind* die Grenze zwischen ungeprüften API-Daten
> und allem anderen (CLAUDE.md), und der Worker blockiert den ersten Paint
> nicht, er lädt parallel dazu. Die entscheidende Zahl, die 120 KB, ist
> eingehalten. Zods Kern ist außerdem monolithisch: die 16 KB sind einmalig
> bezahlt, weitere Schemas kosten kaum noch etwas – das Budget läuft also nicht
> von selbst weiter weg.
>
> Falls der Worker doch einmal deutlich über 35 KB steigt, ist die Reihenfolge:
> erst Horizont- und Matching-Code erst beim Dig nachladen, dann `zod/mini`.

**Maßnahmen**

- Nuxt im **SPA-Modus** (`ssr: false`), statisch generiert – kein Node zur Laufzeit
- Route-basiertes Code-Splitting; Korb, Landkarte und Händlerprofil laden erst bei Bedarf
- Nuxt UI **selektiv** importieren, nicht als Gesamtpaket
- Keine Icon-Bibliothek als Ganzes – nur die ~20 tatsächlich benutzten SVGs, inline
- **Keine Chart-Bibliothek.** Balken und Verteilungen sind `<div>`s mit `width: %`.
  Das Serien-Raster ist CSS Grid. Spart 60–150 KB gegenüber Chart.js/ECharts
- Keine Moment/date-fns – `Intl.DateTimeFormat` und `Intl.NumberFormat` sind eingebaut
- Keine Lodash, keine Polyfills (Baseline 2026 ist die Zielplattform)
- `motion-v` nur wenn es sich in der Praxis lohnt; CSS-Transitions reichen für fast alles
- Bundle-Größe im CI prüfen, Budget-Überschreitung bricht den Build

---

## 3. Speicher auf dem Gerät

| Was | Größe |
|---|---:|
| Sammlung, 2.412 Einträge (schlank) | ~1,4 MB |
| Wantlist, 184 Einträge | ~0,1 MB |
| Geschmacksprofil | ~50 KB |
| Horizont: ~200.000 Release-IDs als `Int32Array` | **800 KB** |
| Horizont-Metadaten (Rolle, Katalognummer, Jahr) | ~6 MB |
| Letzte 5 Digs, nur Treffer ab Score 30 | ~1 MB |
| **Summe** | **< 10 MB** |

**Maßnahmen**

- **Release-IDs als `Int32Array`, nicht als Array oder Set von Objekten.**
  200.000 IDs = 800 KB statt ~9 MB. Lookup per binärer Suche auf dem sortierten Array
  oder einmalig in ein `Set` gehoben (dann ~4 MB, aber O(1)) – je nach Messung
- Vom Inventar wird **nichts** persistiert außer den Treffern. 20.000 Listings fließen
  durch den Worker und werden verworfen
- Dig-Verlauf hart auf 5 begrenzt, danach FIFO
- Marktplatzfelder werden nach 6 Stunden genullt (ToS) – der Speicher wird ohnehin frei
- IndexedDB über `idb` (~2 KB), nicht Dexie (~25 KB)
- `navigator.storage.persist()` anfragen, damit iOS nicht nach 7 Tagen aufräumt

---

## 4. Rechenlast auf dem Gerät

Ein Dig verarbeitet bis zu 20.000 Listings. Das klingt nach viel und ist es nicht.

```
20.000 Listings
  → normalisieren            ~20.000 × regex        ≈  40 ms
  → harte Filter             ~20.000 × Vergleich    ≈   5 ms
  → Set-Lookup Horizont      ~20.000 × O(1)         ≈   3 ms
  → Fuzzy nur für Reste      ~800 × Trigram         ≈  60 ms
  → Scoring + Begründung     ~600 Treffer           ≈  15 ms
                                            gesamt  ≈ 120 ms
```

Zum Vergleich: Das **Netzwerk** braucht für dieselben 20.000 Listings **200 Requests
à 1,2 s = 4 Minuten.** Die Rechenzeit verschwindet vollständig im Rauschen.

**Maßnahmen**

- Scan und Scoring komplett im **Web Worker** – der Main-Thread bleibt bei 60 fps
- **Inkrementell pro Seite** verarbeiten, nie 20.000 Objekte gleichzeitig im Speicher
- Normalisierte Namen der Sammlung **einmal** beim Sync berechnen, nicht pro Dig
- Fuzzy-Matching ist die einzige teure Stufe → läuft **nur** für Listings, die den
  exakten Map-Lookup nicht getroffen haben
- Ergebnisliste virtualisiert (`@tanstack/vue-virtual`) – nie 600 DOM-Karten
- Keine Reaktivität auf großen Arrays: Ergebnisse als `shallowRef`, nicht `ref`
- Cover lädt der Browser lazy und nur im Viewport

---

## 5. Netzwerk – die eigentliche Kostenstelle

Das Rate-Limit ist die einzige Ressource, die wirklich knapp ist.

| Vorgang | Requests | Dauer |
|---|---:|---:|
| Ersteinrichtung: Sammlung + Wantlist | ~25 | ~30 s |
| Horizont-Expansion (einmalig) | ~670 | **~13 min** |
| Ein Dig, 10.000 Listings | ~101 | ~2 min |
| Ein Dig, 20.000 Listings | ~201 | ~4 min |
| Sammlungs-Delta (täglich) | 1–3 | ~4 s |
| Horizont-Revalidierung | ~20/Tag | ~25 s |

**Maßnahmen**

- **`per_page=100` überall.** Der Default ist 50 – das würde alles verdoppeln
- **Sammlungs-Delta statt Vollsync:** `sort=added&sort_order=desc` und abbrechen, sobald
  ein bekannter Eintrag kommt. Ohne neue Platten kostet der tägliche Sync **einen** Request
- **Niemals `/releases/{id}` in einer Schleife** – das ist die teuerste Regel des Projekts
- `/marketplace/stats/` nur für die **Top 50** nach Vorscore, nicht für alle Treffer
- **Bilder zählen nicht aufs API-Budget**, haben aber ein eigenes Cloudflare-Limit
  (~30–40/min) → lazy, nur im Viewport, `CacheStorage` mit LRU-Deckel bei 150 MB
- Abgebrochene Digs sind resumierbar: Seitencursor wird persistiert
- Horizont-Expansion läuft in kleinen Häppchen und übersteht Reloads

---

## 6. Was bewusst nicht gebaut wird

| Verzichtet auf | Gespart |
|---|---|
| Chart-Bibliothek | 60–150 KB Bundle |
| Server-Rendering | ein ganzer Node-Prozess |
| PostgreSQL | ~250 MB RAM, Backups, Migrationen |
| Redis/Valkey | ein weiterer Dienst |
| Job-Queue | Prozess + Schema |
| `pgvector`/Embeddings | Rechenzeit und Komplexität ohne belegten Nutzen |
| Sentry Session Replay | Bandbreite und CPU beim Nutzer |
| Analytics/Tracking | alles davon, plus Cookie-Banner |
| Volldump (10,4 GB) | ~6 GB Platte und ein monatlicher Wartungstermin |
| Eigene Nutzerkonten | Datenbank, Passwort-Handling, DSGVO-Pflichten |

---

## 7. Messen, nicht raten

Im CI, mit Schwellwerten die den Build brechen:

- **Bundle-Budget** pro Chunk (`vite-bundle-visualizer`, `size-limit`)
- **Lighthouse** auf Mobile-Drosselung: Performance ≥ 95, LCP < 2,0 s
- **Scoring-Benchmark**: 20.000 synthetische Listings müssen unter 250 ms bleiben
- **IndexedDB-Größe** nach einem simulierten Vollsync: unter 15 MB

Regel: **Jede neue Abhängigkeit muss ihren Platz im Budget rechtfertigen.**
Uberspace hätte 1,5 GB RAM gehabt – ein Handy im 3G-Keller hat weniger Geduld.
