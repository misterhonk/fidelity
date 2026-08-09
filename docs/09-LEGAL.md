# 09 – Recht, ToS & Compliance

> Kein Rechtsrat. Recherchierte Zusammenfassung mit Quellen – bei kommerzieller Nutzung
> anwaltlich prüfen lassen.

---

## 1. Discogs API Terms of Use – die harten Punkte

Quelle: [support.discogs.com – API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)

### 1.1 Die 6-Stunden-Regel

> „You may not display in any format or to any audience the Content if it is more than
> six (6) hours older than the information on Our online properties."

Plus: *„You may not cache or store the Content longer than is necessary to provide a
service to Your application's users."*

**Das ist eine Aktualitäts-, keine Cache-Dauer-Regel.** Wir dürfen keinen Inventar-Snapshot
von gestern anzeigen.

**Umsetzung:** `app.dig.expires_at = created_at + 6h`, hart im Datenmodell. Danach sperrt
die UI die Preis- und Zustandsdaten und bietet einen neuen Scan an. Unsere **abgeleiteten**
Daten (Scores, Signale, Händler-Fingerprint) sind keine Discogs-Content-Kopien und dürfen
bleiben.

### 1.2 Attribution – wörtlich vorgeschrieben

Zwei Hinweise sind Pflicht:

```
This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
```

und

```
Data provided by Discogs          ← als Hyperlink auf die entsprechende discogs.com-Seite,
                                     OHNE rel="nofollow"
```

**Umsetzung:** Footer-Komponente global; zusätzlich auf jeder `MatchCard` ein Deeplink zum
Discogs-Listing (der ist ohnehin das Kaufziel).

### 1.3 Restricted Data

Marketplace-Daten (Inventar, Preise, Verkaufshistorie) und Nutzerdaten (Profile, Bilder)
gelten als **Restricted Data**:

- ❌ nicht an Dritte weitergeben
- ❌ nicht kommerziell verwerten
- ❌ **nicht mit Werbe-/Marketingplattformen verwenden** → **keine Ad-Networks** auf Seiten
  mit Listings

### 1.4 Keine Gebühren

> Verboten: „Charging a fee to use or access any part of Your application that integrates
> with Our API or the Content if we provide that access to users free of charge, without
> Our express written permission."

**Konsequenz für dieses Projekt:** Fidelity ist **kostenlos**. Punkt.

> **Zur Einordnung:** Discogs Enhancer (3–10 €/Jahr, 10.000+ Nutzer) und Vizcogs
> (4 €/Monat) verlangen Geld und werden sichtbar toleriert. Die verteidigbare Lesart wäre:
> man bezahlt die *eigene Rechenleistung* (Gap-Analyse, Solver, Fingerprint), nicht den
> Zugang zu Discogs-Daten. **Wenn jemals Geld fließen soll: vorher schriftliche
> Genehmigung von Discogs einholen.** Billige Versicherung.

### 1.5 Kein Scraping

> „Use or attempt to use automated systems designed to access, analyze, or scrape Our
> online properties or applications, including Our API and/or the Content."

Das betrifft die HTML-Route `/sell/release/{id}`, die `discogs_alert`,
`discogs-market-monitor` und diverse Apify-Scraper nutzen.

**Fidelity scrapt nicht.** Der händlerzentrierte Ansatz läuft vollständig auf dem
dokumentierten `/users/{u}/inventory`-Endpunkt. Das ist nicht nur sauber, sondern auch
haltbarer – die Scraper brechen regelmäßig an Cloudflare.

### 1.6 Keine Traffic-Umleitung

> Verboten: „Using Our API or the Content with the intent to drive traffic to other
> non-Discogs websites or services."

→ **Keine eBay-/Amazon-Affiliate-Links**, keine Preisvergleiche zu anderen Marktplätzen.

### 1.7 Weiteres

- Rate-Limits nicht umgehen, insbesondere **nicht durch zusätzliche API-Keys**
- Discogs behält sich vor, **künftig für den API-Zugang Geld zu verlangen**
- Kein API-Zugang weiterverkaufen

### ✅ Kein Verbot eines konkurrierenden Marktplatzes

In den ToS steht **keine** ausdrückliche Klausel dagegen. Die nächstliegenden Schranken sind
die Traffic-Umleitung und die Restricted-Data-Regeln.

**Unsere Position ist strategisch stark:** Fidelity ist ein Kaufberater, der in einem
**Discogs-Checkout endet**. Er lenkt Traffic **zu** Discogs und erhöht den Warenkorbwert.
Das liegt exakt im Interesse von Discogs – ein gutes Argument, falls es je nötig wird.

---

## 2. CC0 – der Freibrief für Katalogdaten

[data.discogs.com](https://data.discogs.com/), wörtlich:

> „This data is made available under the **CC0 No Rights Reserved** license."

Für Releases, Artists, Labels, Masters aus den monatlichen Dumps gilt damit:

| | Live-API | CC0-Dumps |
|---|---|---|
| 6-Stunden-Regel | ✅ gilt | ❌ gilt nicht |
| Attributionspflicht | ✅ | ❌ |
| Speicherbegrenzung | ✅ | ❌ |
| Kommerzielle Nutzung | eingeschränkt | frei |
| Marktplatzdaten enthalten | ✅ | ❌ (gar nicht drin) |

> **Die daraus folgende Architekturregel steht in `01-ARCHITEKTUR.md` §1 und ist die
> wichtigste des Projekts:** Katalog aus Dumps, Marktplatz aus der Live-API, **niemals
> vermischen.** Nicht nur juristisch sauber, sondern auch technisch die einzig
> funktionierende Lösung (siehe Request-Budget).

---

## 3. DSGVO

Auch ein privates Freundes-Tool auf einer öffentlichen Domain verarbeitet personenbezogene
Daten.

### Was wir verarbeiten

| Datum | Rechtsgrundlage | Aufbewahrung |
|---|---|---|
| Discogs-User-ID, Username, Avatar | Art. 6(1)(b) – Vertragserfüllung | bis Kontolöschung |
| OAuth-Token (verschlüsselt) | Art. 6(1)(b) | bis Kontolöschung/Widerruf |
| Sammlung & Wantlist (gespiegelt) | Art. 6(1)(b) | 24-h-TTL, dann Refresh |
| Dig-Ergebnisse | Art. 6(1)(b) | 30 Tage, Marktdaten nach 6 h entkernt |
| Feedback-Urteile | Art. 6(1)(f) – Verbesserung | bis Kontolöschung |
| Server-Logs | Art. 6(1)(f) | 7 Tage |

### Pflichten

- [ ] **Datenschutzerklärung** – auch bei nicht-kommerziellem Betrieb
- [ ] **Impressum** (§ 5 DDG) – bei einer öffentlich erreichbaren Domain
- [ ] **Auskunft & Export** (Art. 15, 20) – JSON-Export in den Einstellungen
- [ ] **Löschung** (Art. 17) – „Konto löschen" entfernt alles, inkl. OAuth-Token-Widerruf
- [ ] **Verschlüsselung** (Art. 32) – `pgcrypto` für Tokens, TLS überall
- [ ] **Auftragsverarbeitung** – AV-Vertrag mit Uberspace; Sentry nur mit gesetzten
      `sendDefaultPii: false` und EU-Region
- [ ] **Datenminimierung** – wir speichern nur, was für Matching und Diff nötig ist

> **Kein Cookie-Banner nötig**, solange ausschließlich das technisch notwendige
> Session-Cookie gesetzt wird (§ 25 Abs. 2 TDDDG). Kein Analytics, kein Tracking – dann
> bleibt das so.

---

## 4. Barrierefreiheit (BFSG / EAA)

Seit **2025-06-28** in Kraft, erfasst den Privatsektor inkl. E-Commerce-Dienstleistungen.
Technischer Standard: **EN 301 549** (inkorporiert WCAG 2.x AA).

**Kleinstunternehmen-Ausnahme:** < 10 Beschäftigte **und** ≤ 2 Mio. € Umsatz →
von den Dienstleistungspflichten ausgenommen. Ein privates Freundes-Tool fällt klar darunter.

> **Trotzdem WCAG 2.2 AA von Tag 1.** Sobald das Ding je kommerziell wird oder in eine
> Firma wandert, verschwindet die Ausnahme – und Barrierefreiheit nachträglich in eine
> dichte Filter-/Tabellen-UI einzubauen ist deutlich teurer als sie gleich mitzubauen.

Details: `05-DESIGN-SYSTEM.md` §6.

---

## 5. Namensrecht

- **„Fidelity"** – generischer Begriff, unproblematisch. Vor einer Wortmarke DPMA/EUIPO
  recherchieren (es gibt Fidelity Investments – andere Nizza-Klasse, aber prüfen).
- **„High Fidelity"** – als Titel geschützt; **nicht** als Produktname verwenden.
- **„Championship Vinyl"** – fiktiver Ladenname aus einem geschützten Werk. Als
  **interner Screen-Name** unbedenklich, als **Produktname** unnötiges Risiko.
- **„Barry"** – Vorname, nicht schützbar. Als Feature-Persona völlig in Ordnung.
- **„Discogs"** ist eine Marke von Zink Media, LLC → nur beschreibend verwenden
  („für Discogs"), nie im Produktnamen, nie im Logo.

---

## 6. Compliance-Checkliste vor dem ersten öffentlichen Zugang

- [ ] Attributions-Strings wörtlich im Footer
- [ ] „Data provided by Discogs" verlinkt, **ohne** `nofollow`
- [ ] Deeplink zum Discogs-Listing auf jeder Karte
- [ ] `expires_at` erzwingt die 6-Stunden-Regel technisch
- [ ] Kein Scraping, keine undokumentierten Endpunkte (auch nicht `/marketplace/search`)
- [ ] Keine Werbung, keine Affiliate-Links, keine Gebühren
- [ ] Rate-Limit-Header respektiert, keine Key-Rotation zur Umgehung
- [ ] Impressum + Datenschutzerklärung online
- [ ] Datenexport und Kontolöschung funktionieren
- [ ] User-Agent identifiziert die App korrekt inkl. URL
- [ ] Marktplatzdaten werden nirgends weitergegeben oder exportiert
