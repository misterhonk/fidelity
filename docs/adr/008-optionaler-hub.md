# ADR-008: Optionaler, selbst hostbarer Hub

**Status:** Vorgeschlagen (Umsetzung M9) · **Datum:** 2026-08-09

## Kontext

ADR-007 hat das Backend gestrichen. Drei Dinge gehen dadurch nicht mehr:
echte Push-Benachrichtigungen (brauchen zwingend einen Application Server),
Hintergrund-Watchlist (ein Browser scannt nicht, während er zu ist) und geteilte
Daten zwischen Nutzern (Horizont-Cache, Versandstaffeln).

Die Frage: Lässt sich das als optionales Addon nachrüsten, ohne die Client-Architektur
wieder aufzuweichen?

## Entscheidung

**Ja – als „Hub": ein winziger, selbst hostbarer Dienst, den man konfigurieren kann,
aber nicht muss.** Ein Feld in den Einstellungen, leer als Default.

Drei Regeln, die den Entwurf tragen:

1. **Kein Feature setzt einen Hub voraus.** Er beschleunigt, er ermöglicht nicht.
2. **Der Hub bekommt keinen Discogs-Token.** Alles, was er tut, geht unauthentifiziert
   oder ganz ohne Discogs.
3. **Der Hub scannt keine Inventare.** Er hat eine IP – alle Nutzer teilten sich wieder
   60 req/min. Er pollt nur `num_for_sale` (1 Request statt 100) und weckt den Client.

## Alternativen

**Gar kein Hub** – Push fehlt dauerhaft, jeder Nutzer baut seinen Horizont selbst
(13 Minuten). Vertretbar, aber unnötig, wenn ein 60-MB-Dienst das löst.

**Hub als Pflicht-Backend** – wäre der Rückfall auf den verworfenen Serverentwurf.

**Hub als Discogs-Proxy** – ToS-grenzwertig („circumvent rate limits"), macht ihn zum
Flaschenhals und wirft den größten Vorteil der Client-Architektur weg.

**Nur Cloudflare Worker** – bequem, aber Vendor-Lock-in. Hono + SQLite läuft überall,
auch auf Uberspace und dem Homeserver.

## Konsequenzen

**Leichter:** Push und Hintergrund-Wächter werden möglich. Der Horizont-Aufbau schrumpft
für den zweiten und jeden weiteren Nutzer von 13 Minuten auf Sekunden. Versandstaffeln
werden zu echtem Crowdsourcing statt Pull Requests.

**Schwerer:** Ein zweites Deployment-Artefakt, ein Cron, eine SQLite-Datei mit Backup.
Und die Versuchung, Features doch vom Hub abhängig zu machen – dagegen hilft nur
Disziplin und ein CI-Test, der die App mit leerer `hubUrl` durchspielt.

**Was jetzt schon getan werden muss:** Die drei Ports aus `13-HUB-ADDON.md` §3
(`HorizonSource`, `ShippingProfileSource`, `WatchService`) samt Fallback-Kette und
`hubUrl` in den Preferences. Kostet etwa eine Stunde. Ohne sie wäre M9 ein Refactoring
quer durch den gesamten Worker.

**Ausstiegspfad:** Hub-URL löschen. Die App läuft weiter, als hätte es ihn nie gegeben.


---

## Nachtrag 2026-08-10 – der Tresor

Diese ADR sagt an mehreren Stellen, der Hub halte **nichts Persönliches**. Der Tresor
scheint das zu brechen: er legt Sammlung, Merkliste, Korb, Händler und Horizont eines
Nutzers auf den Hub, damit dessen Geräte einander finden.

**Er bricht es nicht, weil der Hub nichts davon lesen kann.** Verschlüsselt wird auf dem
Gerät — AES-GCM, Schlüssel aus einer Passphrase über 600.000 PBKDF2-Runden. Was in der
Tabelle `vault` steht, sind vier Felder: `version`, `iv`, `salt`, `cipher`. Der Hub hat
keinen Schlüssel, keine Route die einen entgegennimmt, und nichts, was aus einem Block
wieder eine Sammlung macht. Ein Test hält das fest.

Damit bleibt die Aussage der ADR wahr, nur genauer formuliert: **der Hub hält nichts
Lesbares.** Für den Betreiber — meistens der Nutzer selbst, manchmal ein Freund mit
Server — ändert sich dadurch nichts an seinen Pflichten, weil er nichts hat, womit er
etwas anfangen könnte.

Was weiterhin **nicht** hineingeht, und das sind Tests, keine Absichtserklärungen:

- **Der Discogs-Token.** Ein Zugangsschlüssel auf drei Geräten ist dreimal so viel
  Angriffsfläche. Jedes Gerät meldet sich einmal selbst an (Regel 6).
- **Digs und Treffer.** Marktplatzdaten sind nach sechs Stunden zu löschen (Regel 4).
  Preise auf einen Server zu legen, um sie zurückzusynchronisieren, wäre genau das, was
  diese App zugesagt hat nicht zu tun.

**Ausstiegspfad, unverändert:** Ziel auf „Nur dieses Gerät" stellen. Nichts verlässt den
Browser, und der Block auf dem Hub wird nie wieder gelesen. Wer ihn loswerden will,
löscht die Zeile — mehr ist es nicht.
