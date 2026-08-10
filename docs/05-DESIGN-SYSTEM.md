# 05 – Design-System & UI/UX

> Zielbild: **Ein guter Plattenladen im Jahr 2026.** Warm, dicht, kompetent.
> Nicht Retro-Kitsch, nicht Neon-Cyberpunk, nicht Enterprise-Dashboard.

---

## 1. Haltung

| Prinzip | Konkret |
|---|---|
| **Cover first** | Plattencover sind das Interface. Das UI ist der Rahmen, nicht der Star. |
| **Dark first** | Plattenläden sind dunkel, und Cover-Art leuchtet auf dunklem Grund. Light Mode existiert, ist aber die zweite Wahl. |
| **Dichte ist ein Feature** | Sammler wollen viel sehen. Dichte-Umschalter statt Kompromiss. |
| **Jede Zahl erklärt sich** | Ein Score ohne Begründung ist eine Beleidigung. |
| **Ehrlichkeit über Vollständigkeit** | „18.400 von 43.234 gescannt (42 %)" statt so zu tun, als wäre alles drin. |
| **Warten ist Suchen** | Nie ein Spinner. Immer echte Zahlen und einströmende Treffer. |

---

## 2. Design Tokens

Format: **DTCG 2025.10** (der W3C-Standard ist seit Oktober 2025 stabil) →
Style Dictionary → CSS Custom Properties → Tailwind `@theme`.

```
tokens/
├── core.json        # Rohwerte: Farbrampen, Spacing, Radii, Schrift
├── semantic.json    # Rollen: surface, text, border, accent, signal-*
└── component.json   # Komponentenspezifisch
```

**Alle Farben in OKLCH.** Perzeptuell gleichmäßige Helligkeit heißt: die Signalfarben
wirken alle gleich schwer – keine sieht dominanter aus als die andere.

### 2.1 Neutrale Rampe – „Karton"

Warmes Neutral (Hue 70, minimale Chroma). Papier, Pappe, Innenhüllen.

```css
--fid-n-50:  oklch(0.980 0.004 70);
--fid-n-100: oklch(0.955 0.006 70);
--fid-n-200: oklch(0.900 0.008 70);
--fid-n-300: oklch(0.820 0.009 70);
--fid-n-400: oklch(0.680 0.010 70);
--fid-n-500: oklch(0.560 0.011 70);
--fid-n-600: oklch(0.450 0.012 70);
--fid-n-700: oklch(0.340 0.012 70);
--fid-n-800: oklch(0.245 0.011 70);
--fid-n-900: oklch(0.180 0.010 70);
--fid-n-950: oklch(0.135 0.009 70);
--fid-n-990: oklch(0.105 0.008 70);   /* App-Hintergrund dark */
```

### 2.2 Akzent – „Shellac"

Warmes Bernstein-Orange. Label-Druckfarbe, Röhrenverstärker, Neonschild im Ladenfenster.

```css
--fid-accent-400: oklch(0.800 0.140 62);
--fid-accent-500: oklch(0.740 0.165 58);   /* Primär */
--fid-accent-600: oklch(0.660 0.170 54);
--fid-accent-700: oklch(0.560 0.150 52);
```

### 2.3 Signalfarben – eine je Match-Typ

Zehn Farben für elf Signale: S1 und S2 (Wantlist exakt / anderes Pressing) teilen sich eine.
Alle in einem engen Helligkeitsband (L 0.70–0.78) und mit ähnlicher Chroma (C 0.11–0.18) –
dadurch wirkt keine Signalfarbe schwerer als die anderen.

```css
--fid-sig-wantlist:  oklch(0.72 0.170 350);  /* Magenta  – Wantlist exakt/Pressing */
--fid-sig-gap:       oklch(0.78 0.150  85);  /* Gold     – Diskografie-Lücke       */
--fid-sig-credit:    oklch(0.75 0.120 190);  /* Türkis   – Credit-Graph            */
--fid-sig-artist:    oklch(0.70 0.140 250);  /* Blau     – Künstler bekannt        */
--fid-sig-label:     oklch(0.70 0.160 300);  /* Violett  – Label-Affinität         */
--fid-sig-catalog:   oklch(0.74 0.150 150);  /* Grün     – Katalog-Serie           */
--fid-sig-style:     oklch(0.76 0.110 210);  /* Cyan     – Stil-Adjazenz           */
--fid-sig-price:     oklch(0.78 0.160 130);  /* Limette  – Preis-Signal            */
--fid-sig-scarcity:  oklch(0.70 0.180  28);  /* Rotorange– Seltenheit              */
--fid-sig-upgrade:   oklch(0.74 0.130 170);  /* Mint     – Format-Upgrade          */
```

`contrast-color()` (Baseline 2026) für die Chip-Schrift – so bleibt der Kontrast korrekt,
ohne pro Farbe eine Vordergrundfarbe zu pflegen.

### 2.4 Semantische Rollen mit `light-dark()`

```css
:root {
  color-scheme: light dark;

  --fid-bg:            light-dark(var(--fid-n-50),  var(--fid-n-990));
  --fid-surface:       light-dark(#fff,             var(--fid-n-950));
  --fid-surface-raised:light-dark(var(--fid-n-50),  var(--fid-n-900));
  --fid-border:        light-dark(var(--fid-n-200), var(--fid-n-800));
  --fid-text:          light-dark(var(--fid-n-900), var(--fid-n-100));
  --fid-text-muted:    light-dark(var(--fid-n-600), var(--fid-n-400));
  --fid-accent:        light-dark(var(--fid-accent-600), var(--fid-accent-500));
}
```

Eine Deklaration pro Token statt eines doppelten `.dark`-Blocks. Nutzer-Override in
`localStorage`, **vor dem ersten Paint angewendet** (Inline-Script im `<head>`), sonst blitzt es.

### 2.5 Typografie

| Rolle | Schrift | Warum |
|---|---|---|
| UI + Fließtext | **Inter Variable** (oder Geist Sans) | Neutral, exzellente Lesbarkeit in kleinen Größen |
| Katalognummern, Matrix/Runout, Preise | **Geist Mono** / JetBrains Mono | Katalognummern sind Codes, keine Prosa |
| Score-Zahl, Hero | Inter Variable, `wght 700`, `opsz` groß | |

```css
/* Fluide Skala – clamp() mit rem-Anteil, damit Browser-Zoom funktioniert (WCAG 1.4.4) */
--fid-text-xs:   clamp(0.75rem,  0.72rem + 0.15vw, 0.8125rem);
--fid-text-sm:   clamp(0.875rem, 0.84rem + 0.18vw, 0.9375rem);
--fid-text-base: clamp(1rem,     0.96rem + 0.20vw, 1.0625rem);
--fid-text-lg:   clamp(1.125rem, 1.06rem + 0.32vw, 1.25rem);
--fid-text-xl:   clamp(1.375rem, 1.24rem + 0.65vw, 1.75rem);
--fid-text-2xl:  clamp(1.75rem,  1.50rem + 1.25vw, 2.5rem);
```

> ⚠️ **Nie `vw` allein für `font-size`.** Bricht Browser-Zoom, verletzt WCAG 1.4.4.
> Immer ein `rem`-Term im `clamp()`.

**Tabellenziffern sind Pflicht** bei Preisen, Jahren, Katalognummern und Scores:

```css
.fid-num { font-variant-numeric: tabular-nums; }
/* Tailwind 4: font-features-["tnum"] */
```

### 2.6 Raster, Radien, Schatten

```css
--fid-space: 4px;                      /* alles ist ein Vielfaches */
--fid-radius-sm: 6px;
--fid-radius-md: 10px;
--fid-radius-lg: 16px;
--fid-radius-cover: 2px;               /* Cover sind fast eckig – wie echte Hüllen */

/* Erhebung im Dark Mode über Helligkeit, nicht über Schlagschatten */
--fid-elev-1: 0 1px 2px oklch(0 0 0 / 0.28);
--fid-elev-2: 0 4px 14px oklch(0 0 0 / 0.34);
```

---

## 3. Kernkomponenten

### 3.1 `MatchCard` – die wichtigste Komponente der App

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────┐  Neu! – Neu! 2                          ╭──────╮  │
│ │        │  Brain · BRAIN 1028 · DE · 1973         │  91  │  │
│ │ Cover  │                                          │Side 1│  │
│ │ 96×96  │  ◆ Credit  ◆ Katalog-Serie  ◆ Preis     ╰──────╯  │
│ │        │                                                    │
│ └────────┘  Conny Plank am Pult – du hast 9 seiner            │
│             Produktionen, diese nicht. In der 1000er-Reihe    │
│             fehlen dir nur noch 1051 und 1060.                │
│                                                                │
│  VG+/VG+   24,00 €  (Markt ab 41 €)     [+ Korb]  [Discogs ↗] │
└──────────────────────────────────────────────────────────────┘
```

Regeln:

- **Container Queries**, nicht Viewport-Breakpoints. Dieselbe Karte funktioniert im
  3-Spalten-Grid und in einem 320px-Drawer, ohne Varianten-Komponenten.
- Score als Ring mit Bandfarbe; die Zahl ist tabellarisch gesetzt.
- Signal-Chips als `<button>`, klickbar → filtert die Liste auf dieses Signal.
- Der Begründungssatz ist **niemals** truncated. Er ist das Produkt.
- Cover: `loading="lazy"`, `decoding="async"`, feste Aspect-Ratio 1:1, Skeleton in
  Neutral-800, **direkt vom Browser von `i.discogs.com`** (nie serverseitig – separates
  Cloudflare-Rate-Limit).

### 3.2 `ScanProgress`

Kein Spinner. Nie.

```
┌───────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  8.400 / 20.000    │
│ Seite 84 · noch ca. 2:10 · 47 Treffer bisher              │
│ ⓘ Händler hat 43.234 Listings – die API gibt max. 20.000  │
│                                     frei. [Was heißt das?] │
└───────────────────────────────────────────────────────────┘
```

Nach NN/g: unter 1 s gar nichts, 1–3 s Skeleton, über 3 s **determinierter Fortschritt mit
echten Zahlen und Abbrechen-Option**. Ein Zwei-Minuten-Spinner ist nutzerfeindlich.

Der ⓘ-Hinweis zur 10k-Grenze ist kein Kleingedrucktes, sondern ein Vertrauenssignal.

### 3.3 `SignalChip`

```html
<button class="fid-chip" data-signal="credit">
  <span class="fid-chip__dot"></span> Credit-Graph
  <span class="fid-chip__n fid-num">9</span>
</button>
```

Hintergrund: Signalfarbe bei 12 % Deckkraft, Rand bei 40 %, Text `contrast-color()`.
Mindestgröße 24×24 px (WCAG 2.2 SC 2.5.8).

### 3.4 `CatalogRunGrid`

Die Katalogserie als Raster. Der Dopamin-Loop.

```
Brain 1000er-Reihe                              9 von 12
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│1001│1002│1004│1005│1010│1021│1031│1042│1051│1055│1060│1071│
│ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │ ★  │ ●  │ ○  │ ●  │ ○  │ ●  │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
 ● besitzt    ★ hier kaufbar    ○ fehlt
```

### 3.5 `ShippingLadder`

```
Versand zu dir (DE)              aktuell 2 Platten · 9,00 € gesamt · 4,50 €/Stk
 1 ▏ 6,00 €    6,00 €/Stk
 2 ▓ 9,00 €    4,50 €/Stk   ← du bist hier
 3 ▓ 9,00 €    3,00 €/Stk   ← +1 Platte spart 1,50 €/Stk   [Kandidaten zeigen]
 4 ▓ 12,00 €   3,00 €/Stk
```

### 3.6 Weitere

| Komponente | Zweck |
|---|---|
| `CommandPalette` (⌘K) | Sucht **Daten**, nicht nur Navigation: Künstler, Labels, Händler, gespeicherte Digs. Nuxt UI 4 bringt `UCommandPalette` mit. |
| `DealerFingerprint` | Stacked Bars für Label-/Stil-/Dekaden-Verteilung + Affinity-Zahl |
| `FilterRail` | Desktop: Sticky-Sidebar. Mobil: Bottom Sheet (Reka `Drawer`). |
| `DensityToggle` | comfortable 52 px / compact 34 px Zeilenhöhe |
| `EmptyState` | Nicht „keine Ergebnisse", sondern „Bei diesem Händler nichts für dich – aber [Name] hat 12 Treffer" |

---

## 4. Interaktionsmuster

| Muster | Umsetzung |
|---|---|
| **Virtualisierung** | Ab ~200 Zeilen `@tanstack/vue-virtual`. Sammlungen haben 5.000+ Einträge. |
| **View Transitions** | Same-document, für Karte → Detail-Sheet. Cross-document noch nicht (Interop-2026-Baustelle). |
| **Optimistic UI** | Nur für Korb, Wantlist-Add, Feedback. **Nicht** für alles mit Geld oder echter Fehlerrate. |
| **Worker-Fortschritt** | `postMessage` aus dem Web Worker. Kein Polling, kein SSE - es gibt keinen Server. |
| **URL ist der State** | Filter, Sortierung, Dichte in Query-Params. Digs liegen lokal - zum Teilen gibt es JSON-Export. |
| **`scrollbar-gutter: stable`** | Auf allen Listen-Panes. Kein Layout-Sprung beim Filtern. |
| **Skeletons** | Nur mit exakt den Maßen des echten Inhalts, sonst tauscht man Spinner gegen CLS. |

---

## 5. Motion

- 150–250 ms für UI-Feedback, 300–400 ms für Layout-/Seitenwechsel
- **Spring statt Ease** bei allem, was der Nutzer direkt manipuliert
- Bewegung dient Orientierung und Kausalität, nicht Dekoration
- `motion-v` 2.3 als Bibliothek

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

> ⚠️ `prefers-reduced-motion` heißt **reduzieren, nicht abschalten**. Opacity-Crossfades und
> sofortige Zustandswechsel bleiben – Parallax, große Translationen, Scale und
> scroll-getriebene Effekte fliegen raus.

---

## 6. Barrierefreiheit

**Ziel: WCAG 2.2 Level AA.** Das ist der operative Standard – WCAG 3.0 ist laut W3C-Entwurf
vom März 2026 „an incomplete draft" und noch Jahre entfernt.

> ⚠️ **Rechtlicher Kontext DE/EU:** Der European Accessibility Act und das deutsche **BFSG**
> sind seit **2025-06-28** in Kraft und erfassen den Privatsektor, ausdrücklich inklusive
> E-Commerce-Dienstleistungen. Technischer Standard: **EN 301 549**, das WCAG 2.x AA
> inkorporiert.
> **Kleinstunternehmen-Ausnahme:** < 10 Beschäftigte **und** ≤ 2 Mio. € Umsatz →
> von den BFSG-Dienstleistungspflichten ausgenommen. Ein privates Freundes-Tool fällt
> klar darunter. **Trotzdem von Tag 1 auf AA bauen** – Barrierefreiheit nachträglich in
> eine dichte Filter-/Tabellen-UI zu bekommen ist brutal.

> **`.fid-action` ist Pflicht** auf jedem Bedienelement, das wie ein Textlink aussieht
> und wie ein Knopf funktioniert – „Noch da?", „Korb leeren", „raus", „Zurück". Eine Zeile
> 14-px-Text wird 21 px hoch: sieht richtig aus, verfehlt die Grenze um drei. axe hat für
> Target Size **keine Regel**, und das Auge hat kein Lineal – deshalb misst
> `tests/e2e/smoke.spec.ts` jeden Screen bei 375 px nach.
>
> Links **mitten im Fließtext** sind laut Kriterium ausgenommen und bekommen die Klasse
> nicht; `inline-flex` würde dort die Grundlinie verschieben. Ein Ankreuzfeld in seinem
> eigenen `<label>` ist so groß wie das Label – das Label *ist* das Ziel.

### WCAG-2.2-Kriterien, die genau diese App treffen

| SC | Kriterium | Wo es beißt |
|---|---|---|
| 2.4.11 | Focus Not Obscured | **Sticky Filterleiste** verdeckt fokussierte Zeilen → `scroll-margin-top` |
| 2.5.8 | Target Size 24×24 | Signal-Chips, Zeilenaktionen im Compact-Modus, **Textlinks, die Aktionen sind** |
| 2.5.7 | Dragging Movements | Falls Korb-Sortierung per Drag → Tastatur-Alternative Pflicht |
| 3.2.6 | Consistent Help | Hilfe-Einstiegspunkt an jeder Stelle gleich |
| 3.3.7 | Redundant Entry | Händlername nicht zweimal eintippen lassen |

### Umsetzung

- Score-Ring: `role="img"` + `aria-label="Barry Score 91 von 100 – Side One, Track One"`
- Signalfarben **nie als einziger Bedeutungsträger** – immer Label dazu (SC 1.4.1)
- Scan-Fortschritt in `aria-live="polite"`, gedrosselt auf max. 1 Ansage/10 s
- Virtualisierte Listen: `aria-rowcount`/`aria-rowindex`, damit Screenreader die
  Gesamtmenge kennen
- Fokusfalle im Detail-Sheet, `Escape` schließt, Fokus kehrt zur Karte zurück
- Kontrast: alle Text-auf-Signalfarbe-Paare über `contrast-color()` oder händisch geprüft
- **Automatisiert:** `@axe-core/playwright` in der E2E-Suite. **Manuell:** ein
  Tastatur-Durchlauf und ein VoiceOver-Durchlauf pro Release. Automatik findet ~30–40 %.

---

## 7. PWA

| Aspekt | Stand August 2026 |
|---|---|
| **iOS-Installation** | Safari 26 hat **alle Installability-Anforderungen abgeschafft** – jede Website öffnet als Web-App vom Home-Bildschirm. Aber: **kein `beforeinstallprompt` auf iOS.** Manueller Coach-Mark „Teilen → Zum Home-Bildschirm" nötig. |
| **Push** | **Gibt es nicht.** Web Push braucht einen Application Server, den wir bewusst nicht haben (ADR-007). Ersatz: Pruefung beim App-Start, Badge-API, Banner mit den Neuigkeiten seit dem letzten Besuch. |
| **Background Sync** | ⚠️ **Chromium-only, nicht Baseline** (Safari: nein). **Keinen Flow darauf bauen.** Eigene IndexedDB-Outbox, geleert bei `online`/`visibilitychange`. |
| **Speicher-Eviction** | WebKit räumt Site-Daten nach ~7 Tagen Inaktivität ab – **installierte Home-Screen-Apps sind ausgenommen.** Noch ein Grund, auf Installation zu drängen. |

**Offline-Strategie**

| Daten | Strategie |
|---|---|
| App-Shell | Precache (`generateSW`) |
| Sammlung/Wantlist | IndexedDB - ohnehin der einzige Speicherort, offline ist der Normalfall |
| Dig-Ergebnisse | IndexedDB, **mit sichtbarem Zeitstempel** („Stand 09:14") |
| Cover | CacheStorage, stale-while-revalidate, LRU-Deckel ~200 MB |
| Preise | Network-first. Still veraltende Preise sind schlimmer als ein ehrliches Label. |

**Ist eine PWA ein Ersatz für eine native App?** Für genau diese App: ja, bequem. Es ist
eine vernetzte, listenlastige Datenbrowsing-App – der Archetyp, den das Web am besten kann.
Reale verbleibende Lücken: schlechterer Install-Funnel auf iOS, kein App-Store, kein
Background Sync, kein NFC auf iOS. Nichts davon ist für Fidelity blockierend.

---

## 8. Screens (v1)

| # | Screen | Kern |
|---|---|---|
| 1 | **Championship** (Dashboard) | Sammlungs-Snapshot, gespeicherte Händler mit Affinity, letzte Digs, Watchlist-Neuigkeiten |
| 2 | **Neuer Dig** | Händler-Eingabe + Vorabprüfung („43.234 Listings – wir schaffen 20.000") |
| 3 | **Dig läuft** | Fortschritt mit echten Zahlen, erste Treffer strömen ein |
| 4 | **Dig-Ergebnis** | Top Five oben, dann Volltrefferliste, Filterleiste, Signal-Chips |
| 5 | **Release-Detail** (Sheet) | Alle Signale, Katalogserie-Raster, Preisvergleich, Pressing-Info |
| 6 | **Der Korb** | Versandstaffel, Grenzkosten, Kandidatenvorschläge, Deeplinks zu Discogs |
| 7 | **The Clerk's Take** | Händler-Steckbrief: Fingerprint, Affinity, Preispositionierung |
| 8 | **Deine Landkarte** | Sammlungsprofil: Labels, Dekaden, Stile, Lücken |
| 9 | **In-Store** (nur mobil) | Große Touch-Targets, offline, Dig-Liste nach Score, **Sammlung + Wantlist durchsuchbar** („Habe ich die schon?“) |
| 10 | **Einstellungen** | Konto, Sammlung, Horizont, Credits, Hub, Datenexport – alles, was man einmal einrichtet |

### Navigation (ergänzt nach M9)

Fünf Bereiche, in der Reihenfolge, in der man sich durch sie bewegt:
**Start · Graben · Korb · Sammlung · Läden**, dazu ein Zahnrad für die
Einstellungen. Auf dem Desktop eine Leiste oben, auf dem Handy eine feste
Leiste unten in Daumenreichweite.

> **Warum überhaupt:** Bis M9 lagen die Sprungmarken als Buttons *innerhalb*
> des Sync-Panels und das Dashboard trug neun gleichgewichtige Panels — von
> „letzter Dig" bis „alles löschen". Ein Bildschirm, auf dem alles gleich
> dringend aussieht, beantwortet die Frage „was jetzt?" nicht.
>
> **In-Store ist bewusst kein Reiter.** Das ist ein *Modus*, in den man mit
> einer Platte in der Hand geht, kein Bereich zum Blättern — erreichbar von der
> Startseite und aus dem Dig-Ergebnis, also dort, wo diese Entscheidung fällt.
