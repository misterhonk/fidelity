# 00 – Produktkonzept

> **Status:** Entwurf v0.1 · **Stand:** 2026-08-09 · **Autor:** Martin + Claude

---

## 1. Die These

**Discogs ist eine Suchmaschine, kein Plattenladen.**

Discogs beantwortet perfekt die Frage *„Habt ihr Platte X?"*. Es beantwortet **nie** die Frage,
die man in einem guten Plattenladen stellt:

> *„Ich sammle Krautrock und Blue-Note-Jazz. Was habt ihr für mich?"*

Genau diese Lücke füllt dieses Projekt. Wir bauen nicht noch einen Marktplatz, sondern
**den Verkäufer hinter der Theke** – die Figur, die weiß, was du hast, was dir fehlt,
und warum die Platte in Fach C dich interessieren sollte.

### Der konkrete Schmerz

Ein Händler hat 20.000 Platten im Sortiment. Man kauft bei Discogs immer mehrere Platten
beim selben Händler, um Versand zu sparen. Also muss man sich durch 20.000 Einträge wühlen –
manuell, sortiert nach Künstlername, ohne jeden Bezug zur eigenen Sammlung.

Discogs' eigene Werkzeuge helfen nur teilweise:

| Discogs-Funktion | Was sie kann | Was fehlt |
|---|---|---|
| „Items I Want" (`/sell/mywants`) | Zeigt Händler mit den meisten Wantlist-Treffern | Nur **exakte Release-Version**, Top-5-Anzeige, tief vergraben |
| Wantlister (2024 zugekauft) | Echtzeit-Alerts, Filter, Churn-Erkennung | Nur Wantlist. Kennt deine **Sammlung** nicht |
| Empfehlungen | ~20 Vorschläge | Praktisch tot, nicht händlerbezogen |
| Preisvorschläge | Median/Lo/Hi | Nur für Verkäufer, ohne Versand |

**Der blinde Fleck:** Alle existierenden Werkzeuge starten bei der **Wantlist** – also bei
Platten, von denen du schon weißt, dass du sie willst. Keines startet bei der **Sammlung** –
also bei dem, was dein Geschmack über dich verrät.

---

## 2. Wettbewerbsanalyse

Ehrliche Einordnung (Stand August 2026, recherchiert):

```
                    PERSONALISIERT auf deine Sammlung
                              ▲
        recordsv.lt ●         │         ★ DIESES PROJEKT
     (nur Analyse,            │        (Vorläufer „crate_digger.php"
      kein Marktplatz)        │         von 2021 – tot seit Jahren)
                              │
  SAMMLUNGS- ─────────────────┼───────────────────── HÄNDLER-
    SEITE                     │                        SEITE
                              │
      Vizcogs ●               │         ● milkcrate.fm  (keine Personalisierung)
      Groovv  ●               │         ● Waxrunner     } Wantlist,
   Discogs Enhancer ●         │         ● Wantlister    } nicht Sammlung
                              ▼
                       NICHT personalisiert
```

### Relevante Player

| Tool | Was es macht | Lebt? | Was ihm fehlt |
|---|---|---|---|
| **Discogs Enhancer** (Browser-Ext.) | 60+ Features: Sortierung inkl. Versand, Währungsumrechnung, Sammlungs-Indikatoren | ✅ sehr aktiv, 10k+ User, 3–10 €/Jahr | Keine Empfehlungen, kein Inventar-Matching |
| **Waxrunner** | Constraint-Solver: beste Kombination Wantlist × Händler | ✅ (HN, Aug 2026) | **Nur Wantlist**, kein Geschmacksprofil |
| **milkcrate.fm** | Händler-Storefronts, „Crates", Genre-Bins | ✅ (HN, Jun 2026) | **Keine Personalisierung** |
| **recordsv.lt** | Pressing-Insights, Contributor-Netzwerke aus deiner Sammlung | ✅ (HN, Mär 2026) | **Kein Marktplatz-Bezug** – sagt nicht, was du kaufen sollst |
| **discogs_alert** (OSS) | Wantlist-Alerts | ✅ | Scraped die Website (ToS-Verstoß), nur Wantlist |
| **Discogs Wantlist Optimizer** | Händler-Ranking nach Wantlist-Overlap | ❌ **tot** – Domain 2026 an Glücksspiel-Spam verloren | Mahnmal: Hobbyprojekte sterben schnell |

### Der Präzedenzfall

Im Discogs-Forum (Thread #786216) beschrieb 2021 ein User namens *faraz12inch45rpm* exakt diese Idee:

> „It first scans your collection to find unique artist names. Then it checks the entire
> seller's inventory for those artists."

Lief unter einer nackten IP als `crate_digger.php`. **Ist heute tot.** Nie benannt, nie
gelauncht, nie vermarktet. Die Idee ist also validiert *und* das Feld ist frei.

### Risiko

Discogs hat **Wantlister im Juni 2024 zugekauft** (Stoat Labs). Das ist gleichzeitig
Validierung, Exit-Pfad und Klon-Risiko. Unsere Verteidigung: der Sammlungs-Geschmacksgraph
und der Credit-Graph sind aufwendig; die Wantlist-Schnittmenge ist trivial.

---

## 3. Namensgebung

Hommage an *High Fidelity* (Stephen Frears, 2000 / Nick Hornby, 1995).

### Empfehlung: **Fidelity**

Ein Wort. Drei Bedeutungsebenen:

1. **High Fidelity** – die Hommage, für Kenner sofort erkennbar
2. **Fidelity = Klangtreue** – Pressqualität, Original vs. Reissue
3. **Fidelity = Verlässlichkeit** – ehrliches Grading, vertrauenswürdige Händler

Markenrechtlich unproblematisch (generischer Begriff), gut aussprechbar auf Deutsch und
Englisch, Domain-Varianten realistisch (`fidelity.app` vermutlich vergeben →
`fidelity.fm`, `getfidelity.app`, `fidelity-vinyl.de`).

### Naming-System innerhalb der App

| Element | Name | Herkunft |
|---|---|---|
| Produkt | **Fidelity** | *High Fidelity* |
| Empfehlungs-Engine / Persona | **Barry** | Jack Blacks Barry Judd – der Typ, der alles kennt und ungefragt urteilt |
| Ein Händler-Scan | **Dig** („einen Dig starten") | Crate Digging |
| Bewertungs-Score 0–100 | **Barry Score** | s. o. |
| Die Top-Empfehlungen | **Top Five** | Der Running Gag des Films |
| Die absolute Nr. 1 im Dig | **Side One, Track One** | Rob Gordons Kategorie |
| Der Laden-/Dashboard-Screen | **Championship** | *Championship Vinyl* – als interner Screen-Name, nicht als Produktname |
| Händler-Steckbrief | **The Clerk's Take** | |

> ⚠️ **„Championship Vinyl" bewusst nicht als Produktname.** Fiktiver Firmenname aus einem
> urheberrechtlich geschützten Werk – als Produktmarke unnötiges Risiko. Als interner
> Screen-Name / Easter Egg völlig unbedenklich.

### Alternativen (falls „Fidelity" nicht zündet)

- **Top Five** – am unmittelbarsten Film-nah, beschreibt das Output-Format wörtlich
- **Deep Cut** – Sammler-Slang, gut merkbar
- **Sleeve** – minimalistisch, .app-Domain wahrscheinlicher frei
- **Barry** – frech, aber als Produktname zu eng an der Figur

---

## 4. Kernfunktion (MVP)

> **Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.**

```
   Discogs-Händlername
           │
           ▼
   ┌───────────────────┐     ┌──────────────────────┐
   │  Inventar-Scan    │◀───▶│  Deine Sammlung      │
   │  (bis 20.000      │     │  + Wantlist          │
   │   Listings)       │     │  (OAuth-Sync)        │
   └─────────┬─────────┘     └──────────────────────┘
             │
             ▼
   ┌───────────────────────────────────────┐
   │  Matching-Engine  →  Barry Score      │
   │  11 Signale, gewichtet, mit Begründung│
   └─────────┬─────────────────────────────┘
             ▼
   ┌───────────────────────────────────────┐
   │  Top Five · Volltrefferliste · Korb   │
   │  Händler-Steckbrief · Versandrechner  │
   └───────────────────────────────────────┘
```

---

## 5. Die Match-Signale

Jeder Treffer trägt einen oder mehrere **Signale**. Das ist das Herz des Produkts – und der
Grund, warum jede Empfehlung einen erklärenden Satz bekommt.

| # | Signal | Bedeutung | Kosten | Phase |
|---|---|---|---|---|
| 1 | `WANTLIST_EXACT` | Genau diese Release-ID steht auf deiner Wantlist | **gratis** | M2 |
| 2 | `WANTLIST_PRESSING` | Anderes Pressing eines Wantlist-Albums | Katalog-DB | M5 |
| 3 | `ARTIST_KNOWN` | Künstler in deiner Sammlung, dieses Release nicht | **gratis** | M2 |
| 4 | `ARTIST_GAP` | Diskografie-Lücke: du hast 4 von 6 | Katalog-DB | M5 |
| 5 | `LABEL_AFFINITY` | Label, das du überdurchschnittlich sammelst | **gratis** | M2 |
| 6 | `CATALOG_RUN` | Katalognummern-Serie (Blue Note 4000er, ECM 1000er, Brain/Ohr/Pilz) | Katalog-DB | M5 |
| 7 | `STYLE_ADJACENT` | Stil-Nachbarschaft zum Zentroid deiner Sammlung | **gratis** | M3 |
| 8 | `CREDIT_GRAPH` | Gleicher Produzent / Engineer / Studio / Sideman | Katalog-DB | M5 |
| 9 | `FORMAT_UPGRADE` | Du hast es auf CD – hier gibt's das Original-Vinyl | Katalog-DB | M5 |
| 10 | `PRICE_SIGNAL` | Deutlich unter dem Markt-Tiefstpreis | 1 API-Call | M4 |
| 11 | `SCARCITY` | Taucht selten im Marktplatz auf | 1 API-Call | M4 |

### Warum Signal 8 (`CREDIT_GRAPH`) das eigentliche Killer-Feature ist

Discogs' größter ungenutzter Schatz ist der **Credit-Graph**: jedes Release trägt
`extraartists` mit Rollen – Producer, Engineer, Mastered By, Recorded At. Praktisch **kein
Tool konsumiert diese Daten**.

Beispiel-Output:

> *„Du besitzt 9 Produktionen von Conny Plank. Dieser Händler hat 4 weitere, die du nicht
> hast – darunter zwei, nach denen du nie gesucht hättest."*

Das ist exakt das, was ein guter Verkäufer sagt. Und die Daten dafür sind **CC0-lizenziert**
(Discogs Data Dumps) – also dauerhaft, kostenlos und ohne Nutzungsbeschränkung nutzbar.

---

## 6. Der Barry Score

```
score = (stärkstes Signal + 0,3 × Summe der übrigen) / 115 × 100
```

Gedeckelt auf 0–100. Der stärkste Grund dominiert – fünf mittelmäßige Gründe schlagen
keinen perfekten. Vollständige Formel inkl. Kalibrierungstabelle in
`04-MATCHING-ENGINE.md` §4. **Immer** begleitet von einem generierten Begründungssatz:

> **91 · Side One, Track One**
> *„Conny-Plank-Produktion von 1973 auf Brain – du hast 9 seiner Produktionen und dir
> fehlen nur noch zwei aus der 1000er-Serie. VG+ für 24 € bei einem Markt-Tiefstpreis
> von 41 €."*

**Weiche Dämpfer** (multiplikativ). Hart gefiltert wird vorher – Format, Budget,
Versandherkunft und Händler-Rating tauchen hier bewusst *nicht* auf, sonst wäre der
Dämpfer toter Code (siehe `04-MATCHING-ENGINE.md` §2):
- Zustand unter deinem Wunschzustand → ×0.40
- Preis über deinem Wohlfühlpreis (aber im Budget) → ×0.55
- Deutlich über Marktniveau → ×0.75
- Bereits im Warenkorb → ×0

**Design-Prinzip:** Eine Empfehlung ohne Begründung ist Rauschen. Eine Empfehlung mit
Begründung ist ein Verkäufer. Der Begründungssatz ist **kein Nice-to-have**, sondern das
Produkt.

---

## 7. Versand-Optimierung („Der Korb")

Der am häufigsten genannte Schmerz überhaupt – und quantifizierbar in Euro.

> *„Die 3. Platte senkt den Versand von 4,50 € auf 3,00 € pro Stück. Hier sind die
> 12 besten Kandidaten bei diesem Händler in genau diesem Preisfenster."*

Discogs zeigt kombinierte Versandkosten **erst im Warenkorb**. Wir zeigen sie **vorher** –
als Kaufargument.

### ⚠️ Ehrliche Einschränkung

Das Feld `shipping_price` ist in der Inventory-API bei vielen Händlern **leer** – Discogs
berechnet Versand erst im Cart. Lösung:

1. **Händler-Versandprofil**: Nutzer trägt die Staffel einmal ein (1 LP: 6 €, 2–3 LP: 9 €, …)
2. Die App merkt sich das Profil **pro Händler global** – einmal von einem Nutzer gepflegt,
   profitieren alle (Crowdsourcing im Kleinen)
3. Heuristik-Parser über den Freitext in `seller.shipping`
4. Fallback: „Versand unbekannt – trag ihn ein und ich rechne"

Das wird als Limitation dokumentiert, nicht versteckt.

**Der Parser liest nach Zielland.** Ein realer Versandkasten ist selten eine Tabelle,
meistens sind es drei, gestapelt unter Überschriften: `Germany:`, `Europe:`, `Non-Europe:`.
Als eine Tabelle gelesen mischen sich die Sätze, und die billigste Zeile vom falschen
Kontinent gewinnt – genau so kam bei fatplastics ein Korb von zwei Platten auf 13 € statt
der echten 6 €.

Also: Überschriften, die einen Ort nennen, zerlegen den Text. Gelesen wird **nur der Block
für das eingestellte Zielland** – exakter Ländername, sonst Region (`Europe:` für ein
europäisches Ziel), sonst ein Sammelblock (`Rest of World:`). Nennt kein Block das Ziel,
gibt es **keine Staffel** statt einer aus der Nachbarschaft. Die Karte schreibt dazu, aus
welchem Abschnitt sie gelesen hat.

Überschriften, die keinen Ort nennen (`Porto:`, `Shipping address Terms:`), zerlegen nichts
– sonst zerfiele eine gut lesbare Tabelle in Stücke, die auf nichts passen.

---

## 8. Weitere Features (priorisiert)

### Phase 2 – Händler-Intelligenz

- **Händler-Fingerprint**: *„Sortiment kippt Richtung deutscher Krautrock 1970–77;
  62 % Brain/Ohr/Pilz; Medianjahr 1974; kaum Reissues."* Kostet einen Scan, sonst nichts.
- **Affinity-Score**: *„Deine Sammlung überlappt mit diesem Sortiment um Faktor 3,1 –
  einer deiner Top-5-Händler überhaupt."*
- **Händler-Watchlist**: Periodischer Rescan mit Diff. *„Vinyl-Tom hat 40 neue Listings,
  6 passen zu dir."* Kein bestehendes Tool beobachtet auf **Händler**-Ebene.
- **Preis-Positionierung**: *„Systematisch 15 % unter Median bei Jazz, 40 % drüber bei Soul."*

### Phase 3 – Pressing-Beratung

- **Original vs. Reissue** aus Matrix/Runout, Mastering-Stempel (RVG, Porky, RL),
  Presswerk, Land, Label-Variante
- **Fallen-Warnung**: *„Das ist eine japanische Pressung von 1983, kein 65er Original –
  der Preis suggeriert etwas anderes."*
- **Format-Upgrade-Pfade**

### Phase 4 – In-Store-Modus

- Du stehst im Laden, der Händler hat einen Discogs-Shop → PWA zeigt die Dig-Liste auf dem
  Handy, offline-fähig (viele Plattenläden sind Keller ohne Empfang)
- Plattenbörsen-Modus: mehrere Händler nacheinander

### Vorgemerkt

- **Hüllenzustand als Dämpfer.** Die Daten liegen schon da: `sleeve_condition` kommt aus
  dem Inventar, wird gespeichert und dem Matcher übergeben. Was fehlt, ist der Dämpfer —
  eine VG+-Platte in einer G-Hülle ist ein anderer Kauf, und Sammler wissen das.

  Stand bis zum 2026-08-11 als `prefSleeveCondition` in den Einstellungen, ohne dass es
  irgendetwas gelesen hätte, und ist dort entfernt worden. Ein Feld, das ein Feature
  verspricht, das es nicht gibt, ist schlechter als kein Feld. Wenn es kommt, dann auf dem
  vorgesehenen Weg: erst `docs/04-MATCHING-ENGINE.md`, dann gebaut — und mit einem
  erklärten Snapshot-Diff, denn es bewegt jede Punktzahl.

### Bewusst **nicht** gebaut

| Nicht bauen | Warum |
|---|---|
| Wantlist-Alerts | Discogs besitzt Wantlister – aussichtslos |
| Sammlungs-Katalogisierung | Ein Dutzend Apps, gelöstes Problem |
| Sammlungs-Visualisierung | Vizcogs, Groovv, Discogs Enhancer |
| Eigener Marktplatz / Checkout | ToS-Verstoß und strategisch dumm |
| Preis-Arbitrage zu eBay/Amazon | ToS verbietet Traffic-Umleitung |

---

## 9. Zielgruppe & Scope

**Phase 1 (jetzt):** Martin + Jens. Danach Freundeskreis. Kein Public Launch.

Konsequenzen:
- **Reine Client-PWA ohne Backend** (ADR-007). Jeder Nutzer bringt seinen eigenen
  Discogs Personal Access Token mit - und damit sein eigenes Rate-Limit-Budget
- Kein Multi-User-Datenmodell noetig, weil es keine gemeinsame Datenbank gibt.
  Weitergeben heisst: die URL schicken
- Keine Registrierung, keine Einladungscodes, keine Nutzerverwaltung
- Keine Monetarisierung (ToS-Konflikt, siehe `09-LEGAL.md`) - und ohne Server
  auch nichts zu finanzieren

---

## 10. Erfolgskriterien

| Kriterium | Zielwert |
|---|---|
| Zeit vom Händlernamen zur Fundliste | < 3 Minuten bei 10.000 Listings |
| Precision der Top Five | ≥ 3 von 5 Treffern werden als „interessant" markiert |
| Nutzung durch Jens ohne Erklärung | Erster Dig ohne Rückfrage erfolgreich |
| Gesparte Zeit vs. manuelles Durchklicken | Faktor > 50 |
| Ein Kauf, der ohne die App nicht passiert wäre | Der eigentliche Beweis |
