# 13 – Der Hub: optionales Server-Addon

> **Fidelity funktioniert vollständig ohne Hub.** Der Hub ist ein winziger,
> selbst hostbarer Dienst, der die Erfahrung anreichert – niemals eine Voraussetzung.
> Status: **geplant für M9**, aber die Nahtstellen entstehen bereits in M2/M5.

---

## 1. Das Prinzip

```
Kein Hub konfiguriert          Hub konfiguriert
─────────────────────          ─────────────────────────────────
App läuft vollständig    →     App läuft vollständig
Horizont: 13 Min Aufbau  →     Horizont: Sekunden (geteilter Cache)
Versandstaffeln aus JSON →     Versandstaffeln aus der Community
Watchlist beim Öffnen    →     Push, wenn sich was tut
Digs bleiben lokal       →     Digs zwischen deinen Geräten synchron
```

**Die Regel, die niemals gebrochen wird:** Kein Feature darf einen Hub *voraussetzen*.
Der Hub ist ein Beschleuniger, kein Fundament. Wer ihn abschaltet, verliert Komfort –
nie Funktionalität.

In den Einstellungen gibt es genau ein Feld:

```
Hub-URL (optional)   https://hub.mister-honk.de
                     [ Verbindung testen ]
```

Leer = alles lokal. Gesetzt = die App nutzt ihn, wo er hilft, und fällt bei jedem Fehler
still auf den lokalen Weg zurück.

---

## 2. Was der Hub kann – und was bewusst nicht

### ✅ Sinnvoll

| Funktion | Nutzen | Braucht Token? |
|---|---|---|
| **Horizont-Cache** | Wer Conny Plank schon expandiert hat, erspart allen anderen 11 Requests. Bei drei Nutzern schrumpft die Ersteinrichtung von 13 Min auf Sekunden | ❌ nein |
| **Versandstaffeln** | Einer trägt sie ein, alle haben sie. Ersetzt den Pull-Request-Weg | ❌ nein |
| **Änderungs-Wächter** | Pollt `num_for_sale` je beobachtetem Händler – **1 Request statt 100** – und schickt bei Veränderung einen Push | ❌ nein |
| **Web Push** | Der einzige Weg zu echten Benachrichtigungen. Braucht zwingend einen Application Server | ❌ nein |
| **Geräte-Sync** | Desktop und Handy teilen Wantlist-Notizen, Korb, Feedback | ❌ nein |
| **Dig teilen** | Dig hochladen, Link an Jens schicken | ❌ nein |

> **Der wichtigste Fund: Nichts davon braucht den Discogs-Token.**
> `GET /users/{username}` funktioniert **unauthentifiziert** (25 req/min). Der Wächter
> pollt nur `num_for_sale`, vergleicht mit dem letzten Wert und schickt bei Abweichung
> einen Push. Den eigentlichen Scan macht danach wieder der Client – mit seinem eigenen
> Rate-Limit-Budget.

### ❌ Bewusst nicht

| Nicht bauen | Warum |
|---|---|
| **Serverseitiges Scannen als Standard** | Der Hub hat *eine* IP. Alle Nutzer teilten sich wieder 60 req/min – genau die Grenze, die wir gerade losgeworden sind |
| **Discogs-Tokens speichern** | Ein Token gibt Vollzugriff inklusive Schreibrechten auf Sammlung, Wantlist und Bestellungen. Es gibt keine Scopes. Das gehört nicht auf einen fremden Rechner |
| **Nutzerkonten mit Passwort** | Braucht niemand. Zugang über ein geteiltes Hub-Secret reicht für einen Freundeskreis |
| **Der Hub als Discogs-Proxy** | Wäre ToS-grenzwertig („circumvent rate limits") und macht ihn zum Flaschenhals |

> ⚠️ **Optionale Ausnahme, explizit opt-in:** Wer *will*, kann seinen Token im Hub
> hinterlegen, damit dieser nachts vollständig scannt. Muss mit einer unmissverständlichen
> Warnung versehen sein und ist **niemals Default**. Bei einem Hub, den man selbst hostet
> und der nur Freunde bedient, ist das vertretbar – die Entscheidung trifft der Nutzer.

---

## 3. Die Nahtstellen im Client

**Das ist der Teil, der jetzt schon gebaut werden muss.** Drei Interfaces, hinter denen
später eine Hub-Implementierung stecken kann, ohne dass Matching-Engine oder UI etwas merken.

```ts
// shared/ports.ts — die einzigen Stellen, an denen ein Hub andocken kann

export interface HorizonSource {
  /** Kanten für eine Entität holen. Hub fragt zuerst, API ist der Fallback. */
  fetch(kind: 'artist' | 'label' | 'master', id: number): Promise<HorizonChunk | null>
  /** Nach eigener Expansion anbieten. No-op ohne Hub. */
  contribute?(chunk: HorizonChunk): Promise<void>
}

export interface ShippingProfileSource {
  get(dealer: string, toCountry: string): Promise<ShippingTier[] | null>
  contribute?(dealer: string, toCountry: string, tiers: ShippingTier[]): Promise<void>
}

export interface WatchService {
  /** Ohne Hub: Prüfung beim App-Start. Mit Hub: Push. */
  register(dealers: string[]): Promise<void>
  pending(): Promise<WatchAlert[]>
}
```

Implementierungen:

```
worker/horizon/source-api.ts    ← Standard: direkt gegen Discogs
worker/horizon/source-hub.ts    ← ab M9: erst Hub, dann API-Fallback

worker/shipping/source-bundled.ts   ← shipping-profiles.json aus dem Build
worker/shipping/source-hub.ts       ← ab M9

worker/watch/service-local.ts   ← Prüfung beim App-Start
worker/watch/service-hub.ts     ← ab M9: Push-Subscription
```

**Der Aufwand jetzt: drei Interfaces und eine Fallback-Kette.** Vielleicht eine Stunde.
Ohne sie wäre M9 ein Refactoring quer durch den Worker.

### Die Fallback-Kette

```ts
// Jede Hub-Abfrage ist optimistisch und scheitert lautlos.
// Ein kaputter oder abgeschalteter Hub darf die App NIE blockieren.
async function fetchHorizon(kind, id) {
  if (hubUrl) {
    try {
      const hit = await withTimeout(hub.horizon(kind, id), 2000)
      if (hit) return hit
    } catch { /* absichtlich still – wir fallen einfach zurück */ }
  }
  const fresh = await api.expandEntity(kind, id)
  void hub?.contribute(fresh)          // fire-and-forget
  return fresh
}
```

**Timeout 2 Sekunden, kein Retry.** Ein langsamer Hub ist schlimmer als kein Hub.

---

## 4. Der Hub selbst

Klein genug, um ihn an einem Nachmittag zu bauen und überall laufen zu lassen.

```
hub/
├── src/
│   ├── index.ts          Hono-App, ~8 Routen
│   ├── horizon.ts        get / put Kanten
│   ├── shipping.ts       get / put Versandstaffeln
│   ├── watch.ts          Subscriptions + Cron-Wächter
│   ├── push.ts           VAPID / web-push
│   └── db.ts             SQLite via better-sqlite3
├── Dockerfile
└── package.json
```

**Stack:** Node 22 + **Hono** + **SQLite**. Keine Migrations-Werkzeuge, kein ORM,
kein Redis. Ein Binary, eine Datei.

**Ressourcen:** ~60 MB RAM, ~50 MB Platte bei drei Nutzern. Läuft auf Uberspace
(supervisord + `uberspace web backend`), auf einem Homeserver hinter Traefik,
auf jedem VPS, oder als Cloudflare Worker + D1.

### API

```
GET  /v1/horizon/:kind/:id           → HorizonChunk | 404
PUT  /v1/horizon/:kind/:id           ← Chunk beisteuern
GET  /v1/shipping/:dealer/:country   → ShippingTier[] | 404
PUT  /v1/shipping/:dealer/:country   ← Staffel beisteuern
GET  /v1/covers?ids=1,2,3            → { covers: { releaseId: {thumbUrl, coverUrl} } }
PUT  /v1/covers                      ← { covers: [...] } beisteuern
POST /v1/watch/subscribe             ← Push-Subscription + Händlerliste
GET  /v1/watch/pending               → Änderungen seit dem letzten Abruf
POST /v1/digs                        ← Dig zum Teilen ablegen (TTL 6 h)
GET  /v1/digs/:id                    → geteilter Dig
GET  /v1/health                      → { ok, version, entities, users }
```

**Auth:** ein geteiltes Secret im `Authorization`-Header, beim Aufsetzen einmal erzeugt.
Für einen Freundeskreis völlig ausreichend. Keine Nutzerkonten, keine Passwörter,
keine Sessions.

### Cover — der billigste Gewinn im ganzen Addon

Der Inventar-Endpunkt liefert **überhaupt keine Bilder**: `release.thumbnail` ist leer, in
1.200 von 1.200 Zeilen über vier Läden (gemessen 2026-08-10, siehe `02-DISCOGS-API.md`).
Jedes Cover, das ein Client zeigt, kostet ihn also eine eigene Abfrage von
`/releases/{id}` — und die liefert für alle dieselbe Antwort, dauerhaft, weil ein Cover
sich nicht ändert. Genau der Fall, für den es diesen Hub gibt.

**Gebündelt, nicht einzeln.** Ein Bildschirm will rund ein Dutzend Cover auf einmal. Ein
Dutzend Rundreisen zu einem Raspberry Pi, jede mit eigenem Zwei-Sekunden-Limit, kostet
mehr als die Anfragen, die sie sparen sollen.

**Leere Paare werden absichtlich gespeichert.** „Discogs hat für dieses Release kein Bild"
ist genauso viel wert wie ein Bild und kostet dieselbe Anfrage, um es herauszufinden.

**Die Adressen werden an beiden Enden geprüft, und das ist keine Formalie.** Sie landen in
einem `<img src>` auf jedem Gerät, das denselben Hub benutzt — wer hier frei schreiben
dürfte, könnte alle diese Geräte beliebige Adressen laden lassen. Akzeptiert wird nur
`i.discogs.com` über HTTPS, und zwar **geparst statt gemustert**:

```
https://i.discogs.com.evil.test/x.jpeg      ← überlebt ein naives includes()
https://evil.test/?a=https://i.discogs.com  ← ebenso
```

Der Hub lehnt sie beim Einliefern ab, der Client lehnt sie beim Lesen noch einmal ab. Der
Hub ist genau die Komponente, gegen die `worker/hub/client.ts` geschrieben ist — eine alte
Version, eine falsch konfigurierte, oder jemand anderes' Hub. Keine der beiden Seiten
verlässt sich auf die andere.

### Der Wächter

```ts
// Cron, stündlich. Der einzige Hintergrundprozess im ganzen Projekt.
for (const dealer of watchedDealers) {
  const { num_for_sale } = await discogs.get(`/users/${dealer}`)   // ohne Token!
  if (num_for_sale !== lastSeen[dealer]) {
    await push(subscribersOf(dealer), {
      title: `${dealer} hat neue Platten`,
      body: `${num_for_sale - lastSeen[dealer]} neue Listings`,
    })
    lastSeen[dealer] = num_for_sale
  }
}
```

**Ein Request pro Händler und Stunde.** Bei 20 beobachteten Händlern sind das
20 von 25 unauthentifizierten Requests pro Minute – bequem im Rahmen. Der Vollscan
bleibt beim Client.

> ⚠️ **`num_for_sale` erkennt nur Nettoveränderungen.** Verkauft ein Händler 3 Platten
> und listet 3 neue, bleibt die Zahl gleich. Als Wecker reicht das trotzdem: Wer ein
> Sortiment aktiv pflegt, produziert ständig Bewegung. Und ein verpasster Alarm ist
> deutlich weniger schlimm als 100 Requests pro Händler und Stunde.

---

## 5. Datenschutz

Der Hub speichert bewusst fast nichts Persönliches:

| Was | Personenbezug | Anmerkung |
|---|---|---|
| Horizont-Kanten | ❌ keiner | Öffentliche Katalogfakten – wer hat was produziert |
| Versandstaffeln | ❌ keiner | Öffentliche Händlerkonditionen |
| Beobachtete Händlernamen | ⚠️ mittelbar | Verrät Sammelinteressen |
| Push-Subscription | ⚠️ ja | Endpoint-URL des Push-Dienstes |
| Geteilte Digs | ⚠️ ja | TTL 6 h, danach gelöscht (ohnehin ToS-Vorgabe) |
| **Discogs-Token** | 🔴 | **Wird nicht gespeichert** (außer explizit opt-in, s. §2) |

Wer den Hub für andere betreibt, braucht eine kurze Datenschutzerklärung. Wer ihn nur für
sich selbst laufen lässt, braucht gar nichts.

---

## 6. Zeitpunkt

**M9, nach `v1.0.0`.** Nicht vorher – aus zwei Gründen:

1. Erst wenn die App ohne Hub läuft, weiß man, was der Hub wirklich beitragen müsste.
   Vermutungen darüber sind fast immer falsch.
2. Der Client muss nachweislich ohne funktionieren. Baut man beides parallel,
   schleichen sich unweigerlich Abhängigkeiten ein.

**Was in M2/M5 vorbereitet wird:** die drei Interfaces aus §3 samt Fallback-Kette und
dem `hubUrl`-Feld in den Preferences. Mehr nicht.

**Auslöser, den Hub tatsächlich zu bauen:**

- Push wird spürbar vermisst
- Ein dritter oder vierter Nutzer kommt dazu und die 13-Minuten-Ersteinrichtung nervt
- Versandstaffeln per Pull Request zu pflegen wird lästig
- Du willst Digs zwischen Desktop und Handy synchron haben

Vorher: nicht bauen.


---

## Der Tresor – `PUT`/`GET /v1/vault/{id}`

Ein Block verschlüsselter Bytes pro Person, damit ihre eigenen Geräte einander finden.
Kein Cache und nichts Geteiltes: die anderen Routen beschleunigen alle, diese gehört
einem.

```
PUT /v1/vault/{id}   { version, iv, salt, cipher }   → { stored: true }
GET /v1/vault/{id}                                    → { sealed, updatedAt } | 404
```

**Die Kennung** wird aus der Discogs-User-ID abgeleitet (SHA-256, 16 Byte hex). Jedes
angemeldete Gerät kommt ohne Eingabe auf dieselbe, und der Betreiber eines geteilten Hubs
sieht undurchsichtige Kennungen statt einer Liste, wer ihn benutzt. Bewusst **nicht** aus
der Passphrase: eine geänderte Passphrase würde sonst alles Bisherige verwaisen lassen.

**Der Hub prüft die Hülle und sonst nichts** — vier Felder, sonst 400. Das hält die
Tabelle davon ab, ein Pastebin für jeden zu werden, der den Hub erreicht. Den Inhalt kann
er nicht prüfen und soll es nicht: er hat keinen Schlüssel.

**Grenze:** 32 MB je Block. Ein ganzer Horizont samt Merkliste passt mehrfach hinein, und
ein durchdrehender Client kann die Karte eines Raspberry Pi nicht über Nacht füllen.

**404 ist die normale erste Antwort.** Ein Gerät, das noch nie geschrieben hat, fragt ins
Leere — das ist kein Fehler und nichts, was einen Logeintrag verdient.
