# Privacy addendum for the access service — draft

> **Draft. Not legal advice. Review by a lawyer before going live.**
> Goes live with `fidelity-access` (#253), not before. It adds to the app's own notice
> (`app/pages/privacy.vue`), which already covers the app, the hub, the catalogue and that
> an access key travels; this one covers only what happens when somebody pays.
> **The German text is the legally relevant version**; the English one is a convenience
> translation and must say the same thing.
> The fields in the tables are the ones `docs/09-LEGAL.md` §3.1 names, and
> `tests/unit/privacy-promise.spec.ts` checks that both halves keep naming all of them.

---

## Deutsch

### Datenschutzhinweise zum Zugangsdienst

Stand: {{EFFECTIVE_DATE}}

#### Wer verantwortlich ist

{{NAME}}, {{STREET}}, {{POSTCODE_CITY}}, {{EMAIL}}. Fragen zu deinen Daten gehen an diese
Adresse. Einen Datenschutzbeauftragten gibt es nicht; dazu besteht keine Pflicht (§ 38 BDSG).
[verify]

#### Wer was weiß

Die Zahlung wickelt **{{MOR_LEGAL_NAME}}** („Lemon Squeezy") als Merchant of Record ab.
Lemon Squeezy ist Verkäufer und für Name, E-Mail-Adresse, Rechnungsanschrift und
Zahlungsdaten **selbst verantwortlich** (Art. 4 Nr. 7 DSGVO), nicht unser Auftragsverarbeiter.
Was Lemon Squeezy damit macht, steht in seiner Datenschutzerklärung ({{MOR_PRIVACY_URL}}).
Wir sehen weder deine Karte noch deine Anschrift.

Nach der Zahlung meldet Lemon Squeezy sie unserem Zugangsdienst. Diese Meldung ist eine
Übermittlung zwischen zwei Verantwortlichen und enthält nur, was der Dienst braucht.

#### Was der Zugangsdienst speichert

Eine Zeile je Stufe:

| Feld | Was es ist | Warum |
|---|---|---|
| `payer_id` – Zahler-ID | Die Referenz von Lemon Squeezy für deine Bestellung | Damit ein Schlüssel einer Stufe zugeordnet werden kann |
| `email_hash` – E-Mail-Hash | Ein Einweg-Hash deiner E-Mail-Adresse bei Lemon Squeezy, nie die Adresse selbst | Damit „Stufe verwalten" deine Zeile findet, ohne die Adresse zu speichern. Auch ein Hash ist ein personenbezogenes Datum |
| `tier` – Stufe | Welche Stufe | Der Schlüssel trägt sie |
| `valid_until` – Gültig bis | Wann die Stufe endet | Danach wird nicht mehr verlängert |
| `key_id` – Schlüssel-ID | Eine Kennung des aktuellen Schlüssels, nicht der Schlüssel selbst | Damit ein Schlüssel gesperrt werden kann |
| `revoked` – Gesperrt | Ja oder nein | Rückbuchung und Missbrauch |

Den Schlüssel selbst speichern wir nicht. Er steht für eine Stufe, nicht für ein
Discogs-Konto: Der Dienst kennt weder deinen Discogs-Namen noch deine Sammlung, und die App
sendet nichts davon hierher.

Auf dem Hub liegen außerdem deine **versiegelten Synchronisationsdaten** („Überall"). Wir
können sie nicht lesen; sie sind dem Schlüssel zugeordnet.

#### Rechtsgrundlagen

- **Vertrag** (Art. 6 Abs. 1 lit. b DSGVO): die Zeile, der Schlüssel, die
  Synchronisationsdaten.
- **Rechtliche Pflicht** (Art. 6 Abs. 1 lit. c DSGVO): nur, soweit uns Steuer- oder
  Handelsrecht verpflichtet, einen Beleg aufzubewahren, und für den Nachweis, dass wir eine
  Anfrage zu deinen Rechten beantwortet haben. [verify mit Steuerberatung: ob bei einem
  Merchant of Record überhaupt Belege je Bestellung bei uns liegen müssen]
- **Berechtigtes Interesse** (Art. 6 Abs. 1 lit. f DSGVO): Server-Protokolle, um Fehler und
  Angriffe zu finden; der Sperrvermerk bei Missbrauch.

#### Wer die Daten sonst sieht

- **Hetzner Online GmbH**, Gunzenhausen, Deutschland – betreibt den Server, auf dem Zugangsdienst,
  Hub und Katalog laufen. Auftragsverarbeiter nach Art. 28 DSGVO, mit Vertrag. Die Daten bleiben
  in der EU.
- **[Nur wenn genutzt:] Cloudflare, Inc.**, USA – leitet die Verbindungen zum Server weiter
  und sieht dabei IP-Adresse und Anfrage. Auftragsverarbeiter nach Art. 28 DSGVO, mit Vertrag.
  Die Übermittlung in die USA stützt sich auf das EU-US Data Privacy Framework.
- **Hub und Katalog** bekommen vom Zugangsdienst nur den öffentlichen Prüfschlüssel und die
  Liste gesperrter Schlüssel-IDs – nichts Persönliches.
- **Lemon Squeezy** bekommt von uns nichts zurück. [verify: `docs/17-ROADMAP-1.0.md` §6.2
  sagt, der Schlüssel geht mit der Quittung per Mail raus – läuft das über Lemon Squeezy,
  dann bekommt Lemon Squeezy den Schlüssel, und das gehört hierher]
- Sonst niemand. Kein Analytics, keine Werbung, keine fremden Skripte.

#### Protokolle

Der Webserver protokolliert Anfragen – Adresse, Zeitpunkt, Pfad – für {{LOG_RETENTION_DAYS}}
Tage. Zugangsschlüssel stehen nie in einem Pfad und werden nicht protokolliert.

#### Wie lange

- Deine Zeile wird 30 Tage nach Ende deiner Stufe gelöscht.
- Eine gesperrte Schlüssel-ID bleibt auf der Sperrliste, bis der Schlüssel ohnehin
  abgelaufen wäre.
- Die versiegelten Synchronisationsdaten löschen wir {{SYNC_GRACE_DAYS}} Tage nach Ablauf
  deines Schlüssels.
- Protokolle nach {{LOG_RETENTION_DAYS}} Tagen.

#### Verzeichnis der Verarbeitungstätigkeiten

Für den Zugangsdienst führen wir ein Verzeichnis nach Art. 30 DSGVO. Die Ausnahme für kleine
Betriebe (Art. 30 Abs. 5) greift nicht, weil die Verarbeitung nicht nur gelegentlich
erfolgt. Das Verzeichnis ist ein internes Dokument und nicht Teil dieser Hinweise.

#### Deine Rechte

Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitung
aus berechtigtem Interesse (Art. 21 DSGVO). Schreib dafür an die Adresse oben. Löschen wir
deine Zeile, verlängert sich dein Schlüssel nicht mehr; die App funktioniert ohne ihn weiter.

Du kannst dich bei einer Aufsichtsbehörde beschweren. Für uns zuständig ist
{{SUPERVISORY_AUTHORITY}}.

---

## English (convenience translation)

### Privacy notice for the access service

As of: {{EFFECTIVE_DATE}}

#### Who is responsible

{{NAME}}, {{STREET}}, {{POSTCODE_CITY}}, {{EMAIL}}. Questions about your data go to that
address. There is no data protection officer; none is required (§ 38 BDSG). [verify]

#### Who knows what

**{{MOR_LEGAL_NAME}}** ("Lemon Squeezy") handles the payment as merchant of record. Lemon
Squeezy is the seller and **an independent controller** (Art. 4(7) GDPR) for your name,
email address, billing address and payment details — not our processor. What it does with
them is in its privacy notice ({{MOR_PRIVACY_URL}}). We see neither your card nor your
address.

After the payment, Lemon Squeezy tells our access service about it. That message is a
transfer between two controllers and carries only what the service needs.

#### What the access service stores

One row per tier:

| Field | What it is | Why |
|---|---|---|
| `payer_id` | Lemon Squeezy's reference for your order | To know which tier a key belongs to |
| `email_hash` | A one-way hash of the email you used at Lemon Squeezy, never the address itself | So "manage your tier" can find your row without storing your address. A hash is still personal data |
| `tier` | Which tier | The key carries it |
| `valid_until` | When the tier ends | Renewal stops then |
| `key_id` | An identifier of the current key, not the key itself | So a key can be revoked |
| `revoked` | Yes or no | Chargebacks and abuse |

We do not store the key itself. It stands for a tier, not for a Discogs account: the service
knows neither your Discogs name nor your collection, and the app sends none of that here.

The hub also holds your **sealed sync data** ("Everywhere"). We cannot read it; it is tied
to the key.

#### Legal bases

- **Contract** (Art. 6(1)(b) GDPR): the row, the key, the sync data.
- **Legal obligation** (Art. 6(1)(c) GDPR): only where tax or commercial law makes us keep a
  record, and for proof that we answered a request about your rights. [verify with the tax
  adviser: whether, with a merchant of record, any per-order record has to be kept by us at
  all]
- **Legitimate interest** (Art. 6(1)(f) GDPR): server logs, to find faults and attacks; the
  revoked flag on abuse.

#### Who else sees the data

- **Hetzner Online GmbH**, Gunzenhausen, Germany — runs the server for the access service,
  hub and catalogue. Processor under Art. 28 GDPR, under contract. The data stays in the EU.
- **[Only if used:] Cloudflare, Inc.**, USA — forwards connections to the server and sees
  the IP address and the request on the way. Processor under Art. 28 GDPR, under contract.
  The transfer to the US relies on the EU–US Data Privacy Framework.
- **Hub and catalogue** get only the public verification key and the list of revoked key ids
  from the access service — nothing personal.
- **Lemon Squeezy** gets nothing back from us. [verify: `docs/17-ROADMAP-1.0.md` §6.2 says
  the key is mailed with the receipt — if that runs through Lemon Squeezy, Lemon Squeezy
  receives the key, and that belongs here]
- Nobody else. No analytics, no advertising, no third-party scripts.

#### Logs

The web server logs requests — address, time, path — for {{LOG_RETENTION_DAYS}} days. Access
keys are never in a path and are not logged.

#### How long

- Your row is deleted 30 days after your tier ends.
- A revoked key id stays on the revocation list until the key would have expired anyway.
- Sealed sync data is deleted {{SYNC_GRACE_DAYS}} days after your key expires.
- Logs after {{LOG_RETENTION_DAYS}} days.

#### Record of processing activities

We keep a record under Art. 30 GDPR for the access service. The small-business exemption
(Art. 30(5)) does not apply because the processing is not occasional. The record is an
internal document and not part of this notice.

#### Your rights

You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17),
restriction (Art. 18), data portability (Art. 20) and to object to processing based on
legitimate interest (Art. 21 GDPR). Write to the address above. If we delete your row, your
key stops renewing; the app keeps working without it.

You may complain to a supervisory authority. The one responsible for us is
{{SUPERVISORY_AUTHORITY}}.
