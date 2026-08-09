# ADR-006: Händlerzentriert statt wantlistzentriert

**Status:** Akzeptiert · **Datum:** 2026-08-09

## Kontext

Jedes existierende Tool (Waxrunner, Wantlister, discogs_alert, discogs-market-monitor)
startet bei der **Wantlist** und sucht sie über alle Händler. Das ist der offensichtliche
Ansatz.

## Entscheidung

Wir starten beim **Händler** und der **Sammlung**, nicht bei der Wantlist.

## Die zwei Gründe

### 1. Technisch: Es gibt keinen Listings-by-Release-Endpunkt

„Wer verkauft Release X?" ist über die API **nicht beantwortbar**:

- `GET /marketplace/listings?release_id=…` → 405
- `GET /marketplace/search?release_id=…` → 401, undokumentiert, nicht supported

**Deshalb scrapen alle wantlistzentrierten Tools die Website** – mit
TLS-Fingerprint-Spoofing gegen Cloudflare. Das ist ein ToS-Verstoß und bricht regelmäßig.

`GET /users/{username}/inventory` ist dagegen **vollständig dokumentiert und öffentlich**.
Unser Ansatz läuft auf dem supported Pfad. Das ist ein struktureller Haltbarkeitsvorteil.

### 2. Produktlich: Die Wantlist ist die falsche Frage

Eine Wantlist enthält, was du schon weißt. Ein guter Verkäufer sagt dir, was du **noch
nicht** weißt. Der ganze Wert liegt in dem, was die Sammlung über den Geschmack verrät –
und nichts davon steht in der Wantlist.

## Konsequenzen

**Leichter:** ToS-sauber, robust gegen Cloudflare, und das Produkt landet in einer
Positionierung, die gerade leer steht (siehe Wettbewerbsmatrix in `00-KONZEPT.md`).

**Schwerer:** Der Nutzer muss einen Händler benennen. Es gibt kein „such alles ab".
**Mitigation:** Händlervorschläge aus Discogs' eigener `/sell/mywants`-Übersicht, aus
bereits gescannten Händlern mit hoher Affinity, und aus den Händlern, bei denen der Nutzer
schon gekauft hat.

**Bewusst nicht gebaut:** Multi-Händler-Suche über den gesamten Marktplatz. Ginge nur
über Scraping. Kommt nicht in Frage.
