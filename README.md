# Fidelity

> Der Verkäufer hinter der Theke — für Discogs.

Discogs ist eine Suchmaschine, kein Plattenladen. Es beantwortet *„Habt ihr Platte X?"*
perfekt und *„Was hättet ihr für mich?"* überhaupt nicht.

**Fidelity** liest das Sortiment eines Discogs-Händlers, gleicht es gegen deine Sammlung
und deine Wantlist ab und liefert eine bewertete Fundliste — **mit einem Satz Begründung
pro Treffer.**

```
Du: "fatplastics"
Fidelity, zwei Minuten später:

  74 · Top Five
  Hemmann + Kaden – Guten Tag EP · Freude Am Tanzen FAT 016 · 12", EP · 2003 · 5,00 €
  Wighnomy Brothers hat hier mitgewirkt – du hast 3 Platten von ihm.
  Außerdem: Label Freude Am Tanzen, Katalogserie FAT.
```

**Eine reine Browser-App. Kein Backend, keine Datenbank, keine Betriebskosten.**
Alles liegt auf deinem Gerät.

---

## Was es kann

**Graben.** Händlernamen oder den Link seiner Discogs-Seite eingeben. Fidelity liest sein
Sortiment und bewertet jede Platte gegen deinen Geschmack. Elf Signale, ein Punktwert von
0 bis 100, ein Begründungssatz. Für sehr große Läden gibt es einen Tiefenscan über
dreizehn Sortierungen, und für Läden, die du schon kennst, „nur das Neue" seit dem letzten
Besuch.

**Verstehen, warum.** Jeder Treffer sagt, welche Signale gefeuert haben und woran das lag:
Künstler in deiner Sammlung, Wunsch auf deiner Wantlist, ein Label, dem du folgst, eine
Lücke in einer Katalogserie, jemand, der auf deinen Lieblingsplatten im Kleingedruckten
steht. Nichts davon ist eine Blackbox.

**Der Korb.** Einer je Händler, denn Porto fällt pro Sendung an. Versandstaffel, Grenzkosten
je weiterer Platte, und die Frage „was ginge für 50 €?" mit einer Antwort.

**Deine Sammlung.** Regal, Landkarte und Wantlist. Die Landkarte zeigt, wo deine Sammlung
dicht ist und wo Lücken sind — nach Label, Jahrzehnt, Stil.

**Im Laden.** Mit der Platte in der Hand: „Habe ich die schon?" Beantwortet aus dem Gerät,
ohne Empfang. Plattenläden sind Keller.

**Läden.** Was ein Händler wirklich führt, wie gut er zu dir passt, und ob sein Sortiment
sich seit deinem letzten Besuch bewegt hat.

**Ohne Anmeldung ausprobieren.** Die Startseite führt es an einer Platte vor, ohne Token,
ohne Konto. Echte Maschinerie, keine Attrappe.

---

## Loslegen

Ein **Personal Access Token** von
[discogs.com/settings/developers](https://www.discogs.com/settings/developers) ist alles,
was du brauchst. Er bleibt auf deinem Gerät.

### Lokal laufen lassen

```bash
pnpm install
pnpm dev
```

Öffnet `http://localhost:3000`. Kein Docker, keine Datenbank, kein Seed.

### Selbst hosten

Der Build erzeugt statische Dateien. Es gibt nichts zu betreiben:

```bash
pnpm build
```

Danach liegt alles unter `.output/public/` — kopieren, wohin es soll:

```bash
rsync -av --delete .output/public/ dein-server:/pfad/zum/docroot/
```

Das läuft auf jedem Webspace, auf Cloudflare Pages, auf GitHub Pages, auf einem
Raspberry Pi mit nginx. Details und Alternativen:
[`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) und
[`docs/10-DEPLOYMENT-ALTERNATIVEN.md`](docs/10-DEPLOYMENT-ALTERNATIVEN.md).

> **Ein Hinweis zu HTTPS:** Wenn du die App über `https://` ausspielst, kann sie einen
> Hub auf `http://localhost` nur in Chrome erreichen — Safari verweigert das (gemessen
> 2026-08-10, siehe unten). Wer den Hub benutzt, gibt ihm besser eine eigene
> HTTPS-Adresse.

### Der Hub — optional

Ein kleiner Dienst, den du selbst betreiben kannst. Er merkt sich, was für alle gleich
ist: was Fidelity über Künstler und Labels herausgefunden hat, Versandkosten pro Händler,
Plattencover. Dann muss das nicht jedes Gerät für sich holen, und wer denselben Hub
benutzt, arbeitet den anderen zu.

```bash
cd hub && docker compose up -d
```

**Kein Feature hängt daran.** Ohne Hub funktioniert alles genauso, es dauert nur beim
ersten Mal länger. Er sieht deinen Discogs-Token nie — es gibt keine Stelle, an der er ihn
annehmen könnte. [`docs/13-HUB-ADDON.md`](docs/13-HUB-ADDON.md),
[ADR-008](docs/adr/008-optionaler-hub.md).

---

## Auch brauchbar als …

**Offline-Nachschlagewerk.** Einmal synchronisieren, dann liegt deine Sammlung im Gerät.
Der Bildschirm „Im Laden" beantwortet „habe ich die schon?" ohne Netz — dafür braucht es
nie einen Dig.

**Landkarte deiner Sammlung.** Wo sie dicht ist, wo Lücken sind, welche Labels du
tatsächlich kaufst statt nur zu glauben, dass du sie kaufst. Kostet keine einzige Anfrage,
sobald die Sammlung einmal da ist.

**Vorführung ohne Konto.** Die Startseite läuft ohne Token. Wer wissen will, was die App
tut, braucht dafür nichts herzugeben.

**Gemeinsamer Hub für eine Gruppe.** Plattenclub, WG, Freundeskreis: ein Hub auf einem
Rechner, und die Arbeit, die einer investiert, kommt allen zugute. Persönliches liegt
nicht darin — außer dem verschlüsselten Block, mit dem deine eigenen Geräte sich finden,
und den der Hub nicht lesen kann.

**Datenausgang.** Jeder Dig lässt sich als Datei ausgeben, die Sammlung ebenso. Preise und
Zustände bleiben draußen; die dürfen nicht weitergegeben werden.

---

## Wie es funktioniert

Der ganze Entwurf hängt an fünf gemessenen Tatsachen — nicht an Vermutungen. Alle live
gegen `api.discogs.com` geprüft, mit Datum.

1. **Discogs erlaubt CORS** (`access-control-allow-origin: *`, `authorization` erlaubt).
   Deshalb braucht diese App kein Backend. *(2026-08-09)*

2. **Das Limit von 60 Anfragen pro Minute gilt pro IP** — und im Browser ist das die IP
   des Nutzers. Dreißig Nutzer sind dreißig Budgets statt einem. Die härteste
   Skalierungsgrenze eines Serverentwurfs fällt damit weg. *(2026-08-09)*

3. **Die Rate-Limit-Header stehen nicht in `expose-headers`, und die 429 kommt ohne
   CORS-Header.** JavaScript sieht also weder, wie viel Budget übrig ist, noch dass es
   überschritten wurde — nur ein abgelehntes `fetch()`. Also blind fahren: 1.200 ms mit
   Token, 2.400 ms ohne, genau eine Anfrage gleichzeitig, über alle Tabs hinweg.
   *(2026-08-10)*

4. **`/artists/{id}/releases` liefert ein `role`-Feld** (`Producer`, `Remix`, `Engineer`).
   Conny Planks komplettes Werk sind 1.095 Einträge in 11 Anfragen. Deshalb braucht diese
   App den 10,4-GB-Katalogdump nicht. *(2026-08-09)*

5. **Der Inventar-Endpunkt liefert überhaupt keine Bilder.** `release.thumbnail` ist leer,
   in 1.200 von 1.200 Zeilen über vier Läden — während dieselben Releases einzeln
   abgefragt 1 bis 29 Bilder haben. Cover kommen deshalb aus einer eigenen Ablage: gratis
   aus der Sammlung, sonst einzeln und nur für das, was auf dem Schirm ist. *(2026-08-10)*

Die Regeln, die daraus folgen, stehen in [`CLAUDE.md`](CLAUDE.md) — kurz genug, um sie zu
lesen, bevor man etwas ändert.

### Aufbau

```
app/       Nuxt: Seiten, Komponenten, Composables. Nur Darstellung.
worker/    Web Worker: Scannen, Matching, Scoring, Horizont. Hier wird gerechnet.
db/        IndexedDB-Schema und Zugriff.
shared/    Typen und das Protokoll zwischen Main-Thread und Worker.
hub/       Der optionale Dienst. Eigenes Paket, eigene Tests.
docs/      Konzept, Architektur, gemessene API-Fakten, ADRs.
```

Der Main-Thread rechnet nicht. Alles, was Zeit kostet, läuft im Worker — sonst ruckelt
eine Liste mit zwanzigtausend Einträgen beim Scrollen.

```
Framework  Nuxt 4.5 (ssr: false, statisch) · Vue 3.5 · TypeScript strict
Speicher   IndexedDB via idb · Horizont als Int32Array
Auth       Discogs Personal Access Token, nur lokal
UI         Tailwind CSS 4 · OKLCH-Tokens (DTCG) · eigene Glyphen
PWA        Offline, installierbar
Test       Vitest · Playwright inkl. WebKit · axe-core · size-limit
Hub        Node ≥ 22.5 · Hono · node:sqlite — keine nativen Abhängigkeiten
Backend    keins
```

---

## Mitarbeiten

[`CONTRIBUTING.md`](CONTRIBUTING.md) erklärt die Werkzeuge, die Testpflichten und die
Regeln, die nicht verhandelbar sind.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`docs/00-KONZEPT.md`](docs/00-KONZEPT.md) | Vision, Namensgebung, Wettbewerb, Backlog |
| [`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) | Systemdesign, Discogs-Client, Horizont |
| [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md) | API-Referenz, gemessene Limits, CORS, Fallen |
| [`docs/03-DATENMODELL.md`](docs/03-DATENMODELL.md) | IndexedDB-Stores, TypedArray-Packung |
| [`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) | Die elf Signale, Barry Score, Begründungen |
| [`docs/05-DESIGN-SYSTEM.md`](docs/05-DESIGN-SYSTEM.md) | Tokens, Komponenten, Barrierefreiheit, PWA |
| [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md) | M0–M9 mit Definition of Done |
| [`docs/07-DEV-PIPELINE.md`](docs/07-DEV-PIPELINE.md) | CI, Conventional Commits, release-please |
| [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) | Statisches Hosting — ein rsync |
| [`docs/09-LEGAL.md`](docs/09-LEGAL.md) | Discogs-Bedingungen, DSGVO, BFSG |
| [`docs/10-DEPLOYMENT-ALTERNATIVEN.md`](docs/10-DEPLOYMENT-ALTERNATIVEN.md) | Wo es sonst laufen kann |
| [`docs/11-KATALOG-STRATEGIE.md`](docs/11-KATALOG-STRATEGIE.md) | Warum kein 10,4-GB-Dump nötig ist |
| [`docs/12-RESSOURCEN-BUDGET.md`](docs/12-RESSOURCEN-BUDGET.md) | Bundle, Speicher, Rechenzeit, Anfragen |
| [`docs/13-HUB-ADDON.md`](docs/13-HUB-ADDON.md) | Das optionale Server-Addon |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records, auch die verworfenen |

---

Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs und wird
von Discogs weder unterstützt noch empfohlen.

This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
