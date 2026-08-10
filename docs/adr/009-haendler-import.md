# ADR-009 – Händler-Import: eine benannte Ausnahme von Regel 5

**Status:** akzeptiert · 2026-08-10
**Betrifft:** CLAUDE.md Regel 5, `worker/dealers/discover.ts`, `docs/02-DISCOGS-API.md`

---

## Kontext

Läden musste man von Hand eintippen. Wer sich vertippt – `430am-studio` statt
`430AM_Studio` – zahlt eine Abfrage für eine falsche Antwort.

Discogs weiß, mit wem man handelt. Zwei Quellen kommen infrage:

| Quelle | Endpunkt | Dokumentiert? | Was sie sagt |
|---|---|---|---|
| Bestellungen | `GET /marketplace/orders` | **ja** (Marketplace → Order → List Orders) | Wo du wirklich gekauft hast |
| Freunde | `GET /users/{username}/friends` | **nein** | Wen du dir gemerkt hast – oft Läden |

Am 2026-08-10 live geprüft: `/users/{username}/friends` antwortet mit Token **200**,
paginiert, CORS offen. Die vollständige Endpunktliste der Discogs-Dokumentation
(`discogs.com/developers`) enthält das Wort „friends" **nicht** – weder unter *User
Identity* noch sonstwo.

**Damit kollidiert die Freundesliste direkt mit Regel 5:** „Nur dokumentierte
API-Endpunkte."

## Entscheidung

**Bestellungen sind die Grundlage. Die Freundesliste ist eine Zusatzquelle, die pro Gerät
eingeschaltet wird und standardmäßig aus ist.**

Bedingungen, unter denen die Ausnahme gilt:

1. **Kein Feature hängt daran.** Fällt der Endpunkt weg, verliert der Import die Hälfte
   seiner Eingabe und sonst passiert nichts. Der Fehler wird geschluckt, nicht gemeldet –
   dasselbe Muster wie beim optionalen Hub (ADR-008).
2. **Standardmäßig aus.** `Preferences.importFriends` ist `false`. Regel 5 bleibt der
   Normalfall; die Ausnahme ist eine sichtbare Entscheidung in den Einstellungen.
3. **Die Herkunft steht dran.** Jede gefundene Zeile sagt „bestellt" oder „befreundet".
   Wer eine Liste bewerten soll, muss wissen, aus welcher Hälfte eine Zeile stammt.
4. **Nur Lesen, nur ein Aufruf, keine Schleife.** Eine Seite, 100 Einträge, danach eine
   Profilabfrage pro Kandidat, um Verkäufer von Nicht-Verkäufern zu trennen.

## Warum nicht einfach lassen

Die naheliegende Alternative – nur Bestellungen – ist sauber, aber bei einem Sammler, der
seine Läden über Discogs *merkt* statt über Discogs *bestellt*, findet sie nichts. Genau
dieser Fall war der Anlass.

## Warum nicht offensiv nutzen

Weil Regel 5 einen guten Grund hat: undokumentierte Endpunkte verschwinden ohne
Ankündigung. `/marketplace/search` ist Discogs-Nutzern genau so abhandengekommen. Wer
darauf baut, baut auf Sand – deshalb *Zusatz*, nie Fundament.

## Folgen

- `docs/02-DISCOGS-API.md` führt beide Endpunkte, den einen ausdrücklich als
  undokumentiert markiert.
- CLAUDE.md Regel 5 nennt diese eine Ausnahme beim Namen. Eine zweite braucht eine
  zweite ADR.
- Verschwindet der Endpunkt, ist nichts zu tun. Das ist der Test, ob die Bedingungen
  eingehalten wurden.
