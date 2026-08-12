# ADR-011: Fidelity schreibt zurück

**Status:** **Angenommen** · **Datum:** 2026-08-12

## Kontext

Bis zum 2026-08-12 hat Fidelity die Discogs-API ausschließlich **gelesen**. Das war keine
bewusste Entscheidung, sondern eine, die nie getroffen werden musste: ein Kaufberater
braucht die Sammlung, um zu rechnen, und niemand hatte gefragt, ob er sie auch ändern
können soll.

Gefragt wurde am 2026-08-12. Und beim Nachsehen zeigte sich, dass mehrere Dinge, die die
App ohnehin schon behauptet, ohne Schreibzugriff Halbwahrheiten sind:

- **„Gekauft"** war ein Merkzettel. Die Platte stand danach zu Hause im Regal und
  gleichzeitig im nächsten Dig wieder im Angebot, weil Discogs nichts davon wusste.
- **Die Bewertung** einer eigenen Platte war lesbar, aber nicht setzbar — obwohl der
  Moment, in dem man sie vergibt, genau der ist, in dem man die Platte in der Hand hält.
- **Der Zustand** ließ sich nirgends notieren. Wer im Laden eine VG+ statt einer NM
  mitnimmt, erinnert sich zwei Wochen später an „war glaub ich okay".

Die Frage war also nicht, ob Schreibzugriffe nützlich sind, sondern ob sie aus einer
**reinen Client-App** überhaupt möglich sind — und was sie an Regeln brechen.

## Die Messung, die das Vorhaben tragen musste

`POST /oauth/access_token` ist per CORS gesperrt (ADR-007, `docs/02` §1b). Wären
Sammlungs-Schreibzugriffe genauso gesperrt, bräuchte das Vorhaben ein Backend — und
Regel 1 verbietet eines. Deshalb stand vor jeder Zeile Code eine Messung, am 2026-08-11
aus dem Browser gegen `api.discogs.com`:

| Aufruf | Ergebnis | `Response.type` |
|---|---|---|
| `POST …/instances/{i}` (Bewertung) | **204** | `cors` |
| `DELETE …/instances/{i}` | **404** mit lesbarem Text | `cors` |
| `PUT /users/{u}/wants/{r}` | **201** | `cors` |
| `GET …/collection/fields` | **200** | `cors` |
| `GET …/collection/value` | **200** | `cors` |

**Der Preflight wird beantwortet.** Damit ist der Weg offen, ohne Regel 1 anzufassen.

## Entscheidung

Fidelity schreibt zurück — Bewertung, Zustandsfelder, Aufnehmen, Aussortieren, Wantlist —
unter fünf Bedingungen.

### 1. Jeder Schreibvorgang deklariert, ob er wiederholt werden darf

Die 429 kommt durch Cloudflare **ohne** CORS-Header, und eine 404 auf manchen Pfaden auch
(beides gemessen). Für JavaScript sieht beides gleich aus: ein abgelehntes `fetch()` ohne
Status. **„Hat geklappt, die Antwort kam nur nicht durch" und „ist nie angekommen" sind
dasselbe Ereignis.**

`WriteOptions.idempotent` ist deshalb ein **Pflichtargument**, keine Option mit Vorgabe.
Bewertung, Feldwert, `DELETE` und `PUT /wants` dürfen wiederholt werden.
`POST …/folders/{f}/releases/{r}` — Platte aufnehmen — darf es nicht: Discogs legt jedes
Mal eine neue Instanz an. Dort wird ab dem zweiten Versuch mit
`GET /users/{u}/collection/releases/{r}` **nachgesehen statt gesendet**, und ein
unlesbarer Nachschlag lässt den Auftrag in der Warteschlange, statt zu raten.

### 2. Alles geht durch die Outbox, nichts direkt

Ein Schreibvorgang landet sofort lokal und als Auftrag in `outbox`; der Keeper arbeitet
ihn im Hintergrund durch denselben Pacer und denselben Web Lock ab wie jeden Lesezugriff
(Regel 3). Drei Gründe:

- **Tempo.** Ein Slot ist 1.200 ms. Ein Stern, der danach aufleuchtet, ist keine Antwort
  auf eine Berührung mehr.
- **Keller.** Plattenläden haben keinen Empfang. Eine dort vergebene Bewertung wartet,
  statt verloren zu gehen.
- **Eine Stelle für Wiederholungen** statt fünf.

Aufträge sind nach ihrem **Ziel** benannt, nicht nach ihrem Zeitpunkt: dreimal Sterne
tippen kostet einen Request.

### 3. Was gezeigt wird und nie ankommt, wird zurückgenommen

Nach fünf Versuchen legt die Outbox den alten Wert zurück. Eine angezeigte Änderung, die
nie ankommt, ist schlimmer als eine abgelehnte: Regal und Discogs widersprechen sich, und
nichts auf dem Schirm sagt es. Deshalb trägt ein Löschauftrag die **ganze Zeile** mit sich
— Discogs kann nicht zurückgeben, was es nie gelöscht hat.

### 4. Hinaus vor herein

Die Outbox wird **vor** dem Sammlungs-Sync geleert. `syncCollection` schreibt Discogs'
Antwort über die gespiegelte Zeile; liefe der Sync zuerst, würde eine noch nicht gesendete
Bewertung durch die alte ersetzt.

### 5. Zwei Dinge, die nie schreiben

- **Der Demo-Modus.** Seine Platten werden mit `instanceId: 0` gebaut, und Null ist genau
  das, was der Schreibpfad ablehnt. Die Regel steckt in den Daten, nicht in einem Flag.
- **Löschen ohne Rückfrage.** Das Aussortieren aus der Sammlung ist der einzige
  destruktive Eingriff und fragt immer — mit einem zweiten, anderen Knopf, nicht mit
  einem `confirm()`, das man reflexhaft wegklickt.

## Konsequenzen

**Der Sammlungs-Sync musste die Eintrags-IDs mitführen.** Discogs adressiert beim
Schreiben eine *Instanz*, nicht ein Release. `instance_id` und `folder_id` kamen bei jedem
Sync mit und wurden verworfen. Sie werden jetzt gespeichert; Null heißt „nicht
beschreibbar" und nicht „Ordner null" — Ordner 0 ist Discogs' virtuelles „Alle" und als
Ziel ungültig.

**Und das kostete eine Migration.** Der Sammlungs-Sync ist ein Delta, das beim ersten
bekannten Datensatz anhält — bestehende Zeilen hätten ihre IDs also **nie** bekommen.
Nicht „noch nicht bewertbar", sondern nie. v5 räumt die Sammlung ab und erzwingt einen
vollen Durchlauf, nach demselben Handel wie v2 und v3: jede Zeile kommt aus der API
zurück, das kostet einen Durchlauf und sonst nichts.

**Die Zustandsfelder liegen außerhalb der Sammlungszeile.** Der Sync schreibt diese Zeile
komplett neu, und die Feldwerte kommen in **keiner** Liste von Discogs zurück (weder
Ordner 0 noch ein echter Ordner noch der Einzelabruf, gemessen). In der Sammlungszeile
wären sie beim nächsten Sync endgültig verloren.

**Der Sammlungswert reitet nur auf einem Durchlauf mit, der etwas gespeichert hat.** Ein
Delta über eine unveränderte Sammlung muss bei genau einem Request bleiben — das ist,
was den Keeper halbstündlich laufen lässt, ohne dass es jemand merkt.

## Alternativen, die verworfen wurden

**Direkt schreiben, ohne Outbox.** Einfacher, und in einem Plattenladen ohne Empfang
verliert es genau das, was man dort notiert hat.

**Optimistisch ohne Rücknahme.** Spart die halbe Maschinerie und produziert stille
Abweichungen zwischen Regal und Konto — die schlimmste Sorte Fehler, weil niemand sie
bemerkt.

**Auf die Antwort warten und erst dann anzeigen.** Ehrlich, und macht jede Berührung
1.200 ms lang. Die Outbox ist der Kompromiss, der beides hat: sofort sichtbar, und
nachweislich entweder angekommen oder zurückgenommen.
