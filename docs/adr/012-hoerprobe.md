# ADR-012 – Hörprobe: eine benannte Ausnahme vom Datenschutzversprechen

**Status:** Akzeptiert
**Datum:** 2026-09-10

## Kontext

Der Stapel (M15) soll eine Hörprobe zeigen. Die Daten dafür liegen bereits da:
**am 2026-09-10 gemessen** liefert `GET /releases/{id}` ein Feld `videos[]` mit `uri`,
`title` und `duration` — bei Release 1 vierzehn Einträge. Der Nachschlag über die
Top-Treffer holt genau diesen Endpunkt ohnehin (`worker/dig/enrich.ts`), die Adressen
kämen also ohne einen zusätzlichen Request mit, genau wie die Pressing-Felder.

Stichprobe über sieben Releases: fünf hatten Videos (14, 17, 9, 1, 1), zwei keine. Bei
sieben Stück ist das ein Anhaltspunkt und keine Quote.

**Discogs hat keine andere Tonquelle.** `videos[]` sind YouTube-Adressen, und es gibt
keinen zweiten Weg — keine Vorschau-Schnipsel, keine Audiodateien, nichts. Wer eine
Hörprobe will, holt sie bei Google oder gar nicht.

Und dagegen steht ein Satz, den die App wörtlich verspricht (`app/i18n/legal.ts`):

> „Fidelity hat keinen Server. Es gibt keine Stelle, an der deine Daten verarbeitet werden
> könnten – alles liegt in der Datenbank deines Browsers und verlässt dieses Gerät nicht."

**Was ein Embed daran tatsächlich bricht, und was nicht.** Es lädt keine Sammlung
irgendwohin hoch — Regal, Wantlist, Token und Treffer bleiben, wo sie sind. Was Google
erfährt, ist die IP-Adresse und welches Video, also welche Platte, gerade angesehen wird.
Das ist weniger, als der Satz befürchten lässt, und mehr als null. Der Satz stimmt danach
nicht mehr ohne Zusatz, und **ein Versprechen, das nur fast stimmt, ist gebrochen.**

## Entscheidung

**Die Hörprobe ist erlaubt, standardmäßig aus, und nimmt vorher keinen Kontakt auf.**

Bedingungen, unter denen die Ausnahme gilt — dieselbe Form wie ADR-009:

1. **Kein Feature hängt daran.** Der Stapel funktioniert ohne Ton vollständig. Fällt
   YouTube weg, ändert sich ein Knopf und sonst nichts.
2. **Standardmäßig aus.** Ein Schalter pro Gerät, in den Einstellungen, mit einem Satz,
   der sagt, was passiert — nicht mit dem Wort „Datenschutz" und einem Haken.
3. **Kein Byte an Google, bevor jemand es will.** Der `<iframe>` entsteht **erst beim
   ersten bewussten Tippen**, nicht beim Zeichnen einer Karte. Wer den Schalter nie
   umlegt, hat auch nie eine Verbindung zu Google aufgebaut — das ist der Unterschied
   zwischen einer Ausnahme und einer Hintertür.
4. **Danach ein Spieler, der mitwandert.** Nach dem ersten Tippen bleibt eine
   Player-Instanz stehen und bekommt je Karte ein `loadVideoById()`. Das ist zugleich der
   einzige Weg, der überhaupt funktioniert: Browser verlangen für Ton eine Geste, und
   diese eine Geste trägt dann durch den Stapel. Ein Autoplay auf Karte eins gibt es
   nicht, in keinem Browser, und keine Zeile Code ändert das.
5. **`youtube-nocookie.com`**, und dazu die Wahrheit: das verhindert Cookies vor dem
   Abspielen, nicht die Anfrage selbst. Die IP sieht Google trotzdem.
6. **Die Datenschutzseite bekommt einen eigenen Absatz.** Das Versprechen wird geändert,
   nicht still gebrochen. Der Absatz nennt beim Namen, wer was erfährt.
7. **Eigener Chunk.** Wer den Stapel nie öffnet, zahlt nichts dafür (Regel 7).
8. **Der Ton hängt an der Platte, nicht am Stück.** `videos[]` gehört zum Release; bei
   einer Compilation ist das erste Video nicht zwingend das, was auf dem Cover steht. Der
   Bildschirm nennt den Titel, den er spielt, statt so zu tun, als wäre es *die* Platte.

## Alternativen

**Gar kein Ton.** Sauber und das Versprechen bleibt unangetastet. Verworfen, weil eine
Hörprobe bei einer Platte, die man nicht kennt, den Unterschied zwischen „sieht
interessant aus" und „die will ich" ausmacht — und weil die Daten ohne Zusatzkosten schon
da sind. Eine Grenze zu ziehen, die niemandem nützt, ist keine Vorsicht.

**Nur hinausverlinken.** Kein Embed, kein Google auf unserer Seite; der Nutzer geht
selbst hin. Ehrlich, und im Wischstapel unbenutzbar: wer für jede Hörprobe die App
verlässt, wischt nicht mehr. Bleibt als das, was ohne den Schalter passiert.

**Ton selbst ausliefern.** Rechtlich unmöglich und technisch nicht vorhanden. Steht hier
nur, damit niemand es ein zweites Mal erwägt.

## Folgen

**Leichter:** Der Stapel bekommt das, was ihn von einer Bildergalerie unterscheidet.
Kostet keinen zusätzlichen Discogs-Request, weil die Adressen im Nachschlag mitkommen.

**Schwerer:** Die Datenschutzseite ist ab jetzt nicht mehr in einem Satz zu sagen. Das ist
der eigentliche Preis, und er wird bewusst bezahlt.

**Ausstieg:** Schalter aus — und es gibt keinen Kontakt zu Google, nicht weniger, sondern
keinen. Ganz zurückbauen heißt: einen Chunk löschen, einen Absatz aus der
Datenschutzseite streichen, `videos[]` aus dem Schema nehmen. Nichts davon berührt die
Daten, die jemand schon hat.
