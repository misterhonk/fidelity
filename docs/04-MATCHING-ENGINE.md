# 04 – Matching-Engine & Barry Score

> Das Herzstück. Hier entscheidet sich, ob die App ein Filter ist oder ein Verkäufer.

---

## 1. Leitprinzip

> **Eine Empfehlung ohne Begründung ist Rauschen. Eine Empfehlung mit Begründung ist ein
> Verkäufer.**

Jeder Treffer trägt (a) einen Score, (b) die Liste der auslösenden Signale mit Belegen und
(c) genau einen deutschen Satz, der erklärt, warum. Der Satz ist **kein Nice-to-have** – er
ist das Produkt. Ohne ihn ist Fidelity ein besserer Filter, mit ihm ist es Barry.

---

## 2. Pipeline

```
Inventory-Seite (100 Listings)
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 1. NORMALISIEREN                                          │
│    artist_string, label_string, title, catno → *_norm     │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 2. HARTE FILTER (bevor irgendwas gescort wird)            │
│    Format ∉ formats_allow            → verwerfen          │
│    Preis > max_price (Budget)        → verwerfen          │
│    ships_from ∈ block                → verwerfen          │
│    bereits in der Sammlung           → verwerfen*         │
│    *außer FORMAT_UPGRADE greift                           │
│                                                           │
│    Händler-Rating < min_seller_rating → Dig gar nicht     │
│    starten (gilt für den ganzen Händler, nicht pro Zeile) │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 3. SIGNALE ERMITTELN (parallel, jedes liefert 0..1)       │
│    S1 Wantlist exakt      S7  Stil-Adjazenz               │
│    S2 Wantlist-Pressing   S8  Credit-Graph                │
│    S3 Künstler bekannt    S9  Format-Upgrade              │
│    S4 Diskografie-Lücke   S10 Preis-Signal                │
│    S5 Label-Affinität     S11 Seltenheit                  │
│    S6 Katalog-Serie                                       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 4. SCORE = Σ(gewicht × konfidenz) → Sättigung → ×Modif.   │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 5. BEGRÜNDUNGSSATZ aus dem stärksten Signal + Kontext     │
└──────────────────────────────────────────────────────────┘
```

**Wichtig:** Schritt 2 läuft **vor** Schritt 3. Signale zu berechnen und danach
wegzuwerfen ist bei 10.000 Listings pure Verschwendung.

> ⚠️ **Hart und weich sauber trennen.** Ein Kriterium ist entweder ein Filter *oder* ein
> Dämpfer – nie beides, sonst ist der Dämpfer toter Code.
>
> | Kriterium | Art | Feld |
> |---|---|---|
> | Format | **hart** – verwerfen | `formats_allow` |
> | Budget | **hart** – verwerfen | `max_price` |
> | Versandherkunft | **hart** – verwerfen | `ships_from_block` |
> | Bereits in der Sammlung | **hart** – verwerfen | – |
> | Händler-Rating | **hart** – Dig gar nicht starten | `min_seller_rating` |
> | Zustand | **weich** – dämpfen ×0.4 | `pref_media_cond` |
> | Wohlfühlpreis | **weich** – dämpfen ×0.55 | `target_price` |
> | Negatives Preissignal | **weich** – dämpfen ×0.75 | – |

---

## 3. Die Signale im Detail

### S1 · `WANTLIST_EXACT` — Gewicht 100

```ts
wantlistIds.has(listing.releaseId)      // Set<number>, O(1)
```

Konfidenz immer 1.0. Kostenlos. Der Basis-Treffer, den auch Discogs schon kann – aber wir
zeigen ihn im Kontext des gesamten Digs.

> *„Steht seit 14 Monaten auf deiner Wantlist."*

### S2 · `WANTLIST_PRESSING` — Gewicht 75 · ab M5

Anderes Pressing eines Wantlist-Albums, über `catalog.release.master_id`.

```ts
// Der Horizont enthaelt fuer jedes Wantlist-Album ALLE Pressungen
// (aus /masters/{id}/versions, 1 Request je Album).
const hit = horizonIndex.get(listing.releaseId)
hit?.some(h => h.kind === 'master' && wantlistMasterIds.has(h.entityId))
```

Konfidenz 0.9, gedämpft auf 0.6 wenn das Pressing deutlich jünger ist als das gewünschte
(Reissue-Verdacht).

> *„Nicht die Pressung von deiner Wantlist, aber dasselbe Album – UK-Original von 1971
> statt der 2015er Reissue."*

### S3 · `ARTIST_KNOWN` — Gewicht 55

Der Kern des MVP. Künstler in der Sammlung, dieses Release nicht.

**Matching-Kaskade** (weil das Inventory nur einen String liefert):

| Stufe | Bedingung | Konfidenz |
|---|---|---|
| 1 | `artistMap.get(norm)` - Map-Lookup, O(1) | **1.00** |
| 2 | Token-Containment: `"Kraftwerk / Neu!"` enthält `"kraftwerk"` | **0.85** |
| 3 | Trigram-Ähnlichkeit ≥ 0.85 - **nur für die Reste**, in JS | **0.70** |
| — | `artist_norm IN ('various','various artists','v/a','unknown')` | **verwerfen** |

Zusätzlich mit dem Gewicht aus dem Geschmacksprofil multipliziert: Ein Künstler, von dem
du 12 Platten hast, zählt mehr als einer mit einer.

> **Performance:** Stufe 1 und 2 sind Map- bzw. String-Operationen und kosten für 20.000
> Listings zusammen unter 10 ms. Stufe 3 ist die einzige teure – sie läuft nur für die
> wenigen hundert Listings, die 1 und 2 nicht getroffen haben. Gesamtbudget < 60 ms.

> ⚠️ **Disambiguierungs-Suffixe niemals strippen.** `"Nirvana (2)"` ist ein *anderer*
> Künstler als `"Nirvana"`. Das ist der klassische Fehler, der die Precision zerstört.

> *„Du hast 12 Platten von Can – diese nicht."*

### S4 · `ARTIST_GAP` — Gewicht 70 · ab M5

Die psychologisch stärkste Karte: fast vollständige Serien sind unwiderstehlich.

```
Für jeden Künstler in der Sammlung mit ≥ 3 Releases:
  gap_ratio = besessen / (Hauptalben des Künstlers im relevanten Zeitfenster)
  Signal feuert, wenn gap_ratio ≥ 0.5 UND dieses Release die Lücke schließt
  Konfidenz = gap_ratio  (0.5 → 0.5 … 0.9 → 0.9)
```

Relevanzfilter: nur `role === 'main'` im Horizont, nur Alben, keine Compilations/Singles,
Zeitfenster aus der eigenen Sammlung ableiten (wer nur 60er-Miles sammelt, will keinen 80er).

> *„Du hast 4 von 6 Blue-Note-Leader-Dates von Hank Mobley aus 1960–61. Das hier ist die
> fünfte."*

### S5 · `LABEL_AFFINITY` — Gewicht 45

Nicht der Absolutwert zählt, sondern der **Lift**:

```
lift = anteil_in_deiner_sammlung / anteil_global
```

Zehn Warner-Platten heißen nichts. Drei Ohr-Platten heißen alles.
Konfidenz = `min(1, log2(lift) / 3)`, feuert ab `lift ≥ 2`.

> ⚠️ Das Inventory liefert **nur das erste Label**. Multi-Label-Releases werden dadurch
> systematisch unterschätzt. Ab M5 über `catalog.release_label` korrigierbar.

> *„Brain Records – davon hast du 7, das ist 9× mehr als der Durchschnitt."*

### S6 · `CATALOG_RUN` — Gewicht 60 · ab M5

Katalognummern-Serien: Blue Note 4000er, ECM 1000er, Impulse! AS-, Vertigo Swirl,
Brain/Ohr/Pilz, Factory FAC-.

```
Zerlege catno → (prefix, nummer):  "BLP 4058" → ("BLP", 4058)
Für jeden (label, prefix) in der Sammlung mit ≥ 3 Einträgen:
  Ermittle besetzte Nummern → Lücken
  Signal feuert, wenn listing.catno_num in eine Lücke fällt
  Konfidenz steigt mit Dichte der Serie in deiner Sammlung
```

> *„Blue Note 4058 – dir fehlen in der 4000er-Reihe nur noch 4051 und 4058."*

Verdient eine eigene **visuelle Darstellung**: die Serie als Raster mit
besessen / hier-kaufbar / fehlt. Das ist der Dopamin-Loop für Jazz- und Krautrock-Sammler.

### S7 · `STYLE_ADJACENT` — Gewicht 30

Der Stil-Zentroid der Sammlung als gewichteter Vektor über Discogs-Styles.

```
score = cosine(style_vector(listing), style_centroid(user))
Signal feuert ab 0.6.
```

Ab M2 nur, wenn das Release in der Sammlung/Wantlist bekannt ist (Styles fehlen im
Inventory). Ab M5 aus `catalog.release.styles` für jedes Listing.

> **Kein pgvector am Anfang.** Discogs hat ~600 Styles – ein Sparse-Vektor in JSONB plus
> Kosinus in SQL reicht völlig. `pgvector` erst, wenn gemessene Relevanz das rechtfertigt.

> *„Deep House mit Detroit-Einschlag – dein Kernrevier."*

### S8 · `CREDIT_GRAPH` — Gewicht 65 · ab M5 · **das Differenzierungsmerkmal**

Der ungenutzte Schatz. Praktisch kein Tool konsumiert die `extraartists`.

```
Für jede Rolle in ('Producer','Engineer','Mixed By','Mastered By','Recorded At'):
  Ermittle die Personen, die in deiner Sammlung überrepräsentiert sind (Lift ≥ 3)
  Signal feuert, wenn dieses Release eine davon in derselben Rolle trägt
  Konfidenz = min(1, count_in_collection / 8)
```

Auch die **Sideman-Achse**: Personen, die in deiner Sammlung häufig als `role IS NOT NULL`
auftauchen, aber nie als Hauptkünstler – der klassische Jazz- und Dub-Navigationspfad.

> *„Conny Plank am Pult, 1974. Du hast 9 seiner Produktionen – diese nicht."*
> *„Rudy Van Gelder hat das aufgenommen. Wie 23 andere Platten in deinem Regal."*

### S9 · `FORMAT_UPGRADE` — Gewicht 40 · ab M5

Du besitzt den Master auf CD, hier gibt es Vinyl (oder eine ältere Pressung).

```ts
// ⚠️ masterId 0 heisst "kein Master" - ohne diesen Guard landen ALLE
//    masterlosen Releases in einem Topf und erzeugen Falschtreffer.
const masterId = horizonMasterOf(listing.releaseId)
masterId !== 0
  && nonVinylMasterIds.has(masterId)          // Set<number>, beim Sync gebaut
  && /vinyl/i.test(listing.format)
```

> *„Hast du auf CD. Das hier ist die deutsche Erstpressung."*

### S10 · `PRICE_SIGNAL` — Gewicht 35 · ab M4 · **1 API-Request pro Release**

`GET /marketplace/stats/{release_id}` → `lowest_price`, `num_for_sale`.

> ⚠️ **Niemals für alle Treffer.** Nur für die **Top 50 nach Vorscore**, nach dem Scan,
> als eigene Phase im Worker. Sonst kostet ein Dig 10.100 statt 101 Requests.
> ⚠️ `lowest_price` aus `/releases/{id}` ist nachweislich fehlerhaft – `/marketplace/stats/`
> verwenden.

```
ratio = listing.price / market_lowest_price
ratio ≤ 0.7 → Konfidenz 1.0   ("deutlich unter Markt")
ratio ≤ 0.85 → 0.6
ratio > 1.3 → NEGATIVES Signal, Score-Dämpfer
```

> *„24 € bei einem Markt-Tiefstpreis von 41 €."*

### S11 · `SCARCITY` — Gewicht 30 · ab M4

Aus `num_for_sale` derselben Abfrage.

```
num_for_sale ≤ 3   → Konfidenz 1.0
num_for_sale ≤ 10  → 0.5
num_for_sale > 30  → kein Signal (kommt wieder)
```

> *„Nur 2 Exemplare weltweit im Angebot."*

---

## 4. Score-Berechnung

```ts
const WEIGHTS = {
  WANTLIST_EXACT: 100, WANTLIST_PRESSING: 75, ARTIST_GAP: 70,
  CREDIT_GRAPH:    65, CATALOG_RUN:       60, ARTIST_KNOWN: 55,
  LABEL_AFFINITY:  45, FORMAT_UPGRADE:    40, PRICE_SIGNAL: 35,
  STYLE_ADJACENT:  30, SCARCITY:          30,
} as const

const SECONDARY = 0.3   // Gewicht der Nebengründe
const SCALE     = 115   // raw = 115  →  Score 100

function barryScore(signals: Signal[], ctx: Context): number {
  const vals = signals
    .map(x => WEIGHTS[x.type] * x.confidence * (ctx.userWeights[x.type] ?? 1))
    .sort((a, b) => b - a)

  if (vals.length === 0) return 0

  // 1. DER STÄRKSTE GRUND DOMINIERT, Nebengründe zählen gedämpft mit.
  //    Eine reine Summe würde Treffer mit vielen schwachen Signalen nach oben
  //    spülen; ein einzelner perfekter Grund soll aber schwerer wiegen als
  //    fünf mittelmäßige. Rechenbeispiel:
  //      1 × perfekt (100)          → raw = 100      → Score 87
  //      5 × mittelmäßig (je 30)    → raw = 30+36=66 → Score 57
  const [primary, ...rest] = vals
  const raw = primary + SECONDARY * rest.reduce((a, b) => a + b, 0)

  // 2. Lineare Skalierung mit Deckel. Kein Sättigungsterm nötig, weil
  //    Schritt 1 die Aufsummierung bereits begrenzt.
  let score = Math.min(100, (raw / SCALE) * 100)

  // 3. WEICHE Dämpfer. Alles Harte ist in Schritt 2 der Pipeline schon
  //    aussortiert – hier stehen nur Kriterien, die tatsächlich eintreten können.
  if (ctx.conditionBelowPreference) score *= 0.40   // unter pref_media_cond
  if (ctx.priceAboveTarget)         score *= 0.55   // über target_price, unter max_price
  if (ctx.priceSignalNegative)      score *= 0.75   // deutlich über Marktniveau
  if (ctx.alreadyInBasket)          score  = 0

  return Math.round(score)
}
```

**Kalibrierungspunkte** (nachrechenbar, gehören in den Golden-File-Test):

| Signalsatz | raw | Score | Band |
|---|---:|---:|---|
| Wantlist exakt allein | 100 | **87** | S |
| Wantlist exakt + Preis-Signal | 110,5 | **96** | S |
| Credit 1.0 + Serie 0.95 + Label 0.9 + Preis 1.0 | 104,8 | **91** | S |
| Diskografie-Lücke 0.8 + Serie 0.9 | 72,2 | **63** | B |
| Künstler bekannt + Label 0.8 | 65,8 | **57** | B |
| Künstler bekannt allein | 55 | **48** | C |
| Stil-Adjazenz allein | 30 | **26** | verworfen |

> ⚠️ **In M2 gibt es nur S1, S3 und S5.** Maximal erreichbar sind dort ~100 Punkte
> (Wantlist + Künstler + Label), realistisch liegen die meisten Treffer bei 45–65.
> Das ist korrekt und ehrlich: mit drei Signalen wissen wir weniger. `SCALE` darf
> **nicht** pro Meilenstein nachjustiert werden, sonst sind Scores über die Zeit
> nicht mehr vergleichbar – und der Golden-File-Test wertlos.

### Score-Bänder

| Band | Bereich | Label | Darstellung |
|---|---|---|---|
| S | 85–100 | **Side One, Track One** | Große Karte, Cover, volle Begründung |
| A | 70–84 | **Top Five** | Karte mit Cover |
| B | 50–69 | Solide | Kompakte Zeile |
| C | 30–49 | Randnotiz | Zeile, eingeklappt |
| — | < 30 | | wird gar nicht gespeichert |

---

## 5. Der Begründungssatz

**Keine LLM-Generierung.** Templates pro Signaltyp, gefüllt mit echten Belegen, kombiniert
nach Priorität. Gründe: deterministisch, sofort, kostenlos, ohne Halluzinationsrisiko –
und ein Barry, der jedes Mal denselben Satz für dieselbe Lage sagt, ist glaubwürdiger als
einer, der improvisiert.

```ts
const TEMPLATES = {
  ARTIST_GAP: (e) =>
    `Du hast ${e.owned} von ${e.total} ${e.label ? e.label + '-' : ''}Alben von ` +
    `${e.artist}${e.era ? ` aus ${e.era}` : ''}. Das hier ist die fehlende.`,

  CREDIT_GRAPH: (e) =>
    `${e.person} ${ROLE_DE[e.role]} – du hast ${e.owned} Platten von ihm im Regal, ` +
    `diese nicht.`,

  CATALOG_RUN: (e) =>
    `${e.label} ${e.catno}. In der ${e.prefix}-Reihe fehlen dir nur noch ` +
    `${e.gaps.slice(0, 3).join(', ')}.`,

  LABEL_AFFINITY: (e) =>
    `${e.label} – davon hast du ${e.owned}, ${e.lift.toFixed(0)}× mehr als der Schnitt.`,

  WANTLIST_EXACT: (e) =>
    `Steht seit ${e.monthsOnList} Monaten auf deiner Wantlist.`,

  WANTLIST_PRESSING: (e) =>
    `Nicht die Pressung von deiner Wantlist, aber dasselbe Album – ` +
    `${e.country}-Pressung von ${e.year}.`,

  ARTIST_KNOWN: (e) =>
    `Du hast ${e.owned} ${e.owned === 1 ? 'Platte' : 'Platten'} von ${e.artist} – diese nicht.`,
}

// Zusammenbau: stärkstes Signal als Hauptsatz,
// zweitstärkstes als Nebensatz, Preis-/Seltenheitssignal immer als Schlusssatz.
// Maximal 2 Sätze. Barry redet viel, aber nicht endlos.
```

**Beispiel-Output:**

> **91 · Side One, Track One**
> *Conny Plank am Pult, 1973 – du hast 9 seiner Produktionen, diese nicht. In der
> Brain-1000er-Reihe fehlen dir nur noch 1051 und 1060. VG+ für 24 € bei einem
> Markt-Tiefstpreis von 41 €.*

---

## 6. Warenkorb-Optimierung

### Grenzkosten-Kurve

```
Für Händler D mit Versandstaffel T und Korb der Größe n:
  versand_pro_stueck(n)     = T(n) / n
  grenzkosten(n → n+1)      = T(n+1) - T(n)
  ersparnis_pro_stueck(n+1) = T(n)/n - T(n+1)/(n+1)

UI: "Die 3. Platte senkt den Versand von 4,50 € auf 3,00 € pro Stück
     → hier sind die 12 besten Kandidaten bei diesem Händler."
     (Staffel 1 LP: 6 €, 2–3 LP: 9 €  →  T(2)/2 = 4,50 · T(3)/3 = 3,00)
```

### Optimierer

Kleines ganzzahliges Optimierungsproblem, kein Solver nötig:

```
Maximiere Σ score(i)
u.d.N.   Σ preis(i) + versand(|K|) ≤ budget
         |K| ≤ max_items
```

Bei ≤ 200 Kandidaten reicht Greedy nach `score / (preis + grenzversand)` plus lokale
Verbesserung (Swap-Nachbarschaft). Ergebnis in Millisekunden, verständlich erklärbar –
das ist wichtiger als das mathematische Optimum.

> ⚠️ **Kein Checkout.** Wir bauen den Korb, dann Deeplink auf die Discogs-Listings.
> Der Kauf passiert bei Discogs. Alles andere wäre ToS-Verstoß und strategisch dumm.

---

## 7. Kalibrierung

Ohne Rückkopplung ist der Barry Score geraten. Deshalb ab M3:

- Pro Treffer: 👍 interessant / 😐 egal / 👎 daneben / 🛒 gekauft
- Gespeichert **mit dem Signal-Snapshot** (`app.match_feedback.signals`)
- Ab ~200 Urteilen: Auswertung, welche Signale mit „interessant" korrelieren
- Zunächst **manuelles** Nachjustieren der Gewichte, kein ML
- Später: pro Nutzer individuelle Gewichte in `user_preference.signal_weights`

**Zielmetrik:** Precision@5 – wie viele der Top Five werden positiv bewertet.
Zielwert ≥ 0,6.

---

## 8. Testbarkeit

Die Engine ist eine **reine Funktion** – das ist Absicht:

```ts
scoreListing(listing, tasteProfile, preferences, horizonIndex) → Match | null
```

Keine I/O, kein IndexedDB, kein Netz. Läuft im Web Worker. Damit:

- **Golden-File-Tests**: eingefrorene Fixtures aus echten Inventaren, erwartete Scores
  im Snapshot. Jede Gewichtsänderung zeigt sofort ihren Effekt auf die gesamte Liste.
- **Property-Tests**: Score ist monoton in der Konfidenz; harte Filter sind absolut;
  Score liegt immer in [0,100].
- **Regressionskorpus**: Martins und Jens' echte Sammlungen gegen 3 eingefrorene
  Händlerinventare. Vor jedem Release durchlaufen lassen und die Top Five vergleichen.
- **Performance-Benchmark**: 20.000 synthetische Listings müssen unter **250 ms** bleiben.
  Bricht der Build, wenn überschritten (siehe `12-RESSOURCEN-BUDGET.md`).
