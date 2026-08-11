# ADR-010: Englisch als Grundsprache, Deutsch als Übersetzung

**Status:** **Angenommen** · **Datum:** 2026-08-11 · **Ersetzt:** die Sprachregel in
`CLAUDE.md` („Nutzersichtbare Texte und Projektdokumentation: Deutsch")

## Kontext

Fidelity ist seit dem 2026-08-11 ein öffentliches Repository unter AGPL-3.0. Damit
verschiebt sich eine Annahme, die vorher unauffällig war: dass der einzige Mensch, der
diesen Quelltext liest, Deutsch spricht.

Der Code war nie das Problem — Bezeichner, Kommentare und Commits sind seit dem ersten Tag
englisch, und eine Stichprobe über `worker/` findet null deutsche Bezeichner. Deutsch sind
drei andere Dinge:

1. **Die Oberfläche.** 36 Dateien, rund 1.300 Textstellen.
2. **Die Adressen.** 14 von 21 Routen: `/korb`, `/regal`, `/haendler`, `/landkarte`,
   `/einstellungen/…`.
3. **Die Unterlagen.** `docs/` vollständig, dazu README und CONTRIBUTING.

Für jemanden, der beitragen möchte und kein Deutsch spricht, ist das keine Hürde, sondern
eine geschlossene Tür. Er kann den Code lesen und trotzdem nicht herausfinden, was ein
Bildschirm verspricht, wohin eine Route gehört oder warum eine Entscheidung so fiel.

Eine deutschsprachige Oberfläche war außerdem nie eine Produktentscheidung. Sie war die
Muttersprache des Autors, und niemand hat je entschieden, dass sie es bleiben soll.

## Entscheidung

**Englisch ist die Grundsprache des Projekts.** Deutsch ist eine Übersetzung.

- **Oberfläche:** Englisch ist die Vorgabe. Deutsch wird angeboten und automatisch
  gewählt, wenn das Gerät es verlangt (`navigator.language`). Weitere Sprachen können
  dazukommen, ohne dass sich am Aufbau etwas ändert.
- **Adressen:** englisch. `/basket` statt `/korb`, `/shelf` statt `/regal`.
- **Unterlagen und Kommentare:** englisch, ausnahmslos. Auch die Kommentare, die zwischen
  dem 2026-08-10 und dem 2026-08-11 auf Deutsch entstanden sind — das war eine Abweichung
  von der bestehenden Regel und wird zurückgenommen.

**Keine Sprach-Präfixe in den Adressen.** Kein `/de/basket`. Die Sprache ist eine
Einstellung des Nutzers, keine Eigenschaft der Adresse. Präfixe würden jede bestehende
Adresse brechen, den Precache des Service Workers verdoppeln und aus jedem Lesezeichen eine
Sprachfestlegung machen.

**Kein i18n-Paket.** Nachrichtendateien als einfache Objekte, ein Composable, und die
aktive Sprache wird nachgeladen. Begründung unten.

**Nachtrag vom 2026-08-11: die Texte werden nach Bereichen geteilt.** Es gibt eine
Schale (`app/i18n/en.ts`, `de.ts`) mit dem, was auf jedem Bildschirm steht — Navigation,
Zeitangaben, wiederkehrende Sätze — und je einen Bereich (`app/i18n/settings.ts` und
weitere) mit dem Rest.

Der Grund ist gemessen: nachdem Navigation und Einstellungen umgestellt waren, lag der
erste Paint bei 116,9 von 120 kB, und davon waren 4,9 kB Text — bei geschätzt einem Viertel
der Oberfläche. Das Ganze in einer Datei wäre am Budget zerbrochen, und zwar zu Recht: die
Formulierung der Tresor-Auswahl gehört nicht in den ersten Bildschirm.

**In den Bereichsdateien stehen beide Sprachen zusammen**, anders als in der Schale. Für die
Schale lohnt der getrennte Chunk, weil sie auf jedem Bildschirm liegt. Für einen Bereich
nicht: die Datei wird einmal geholt, wenn jemand den Bereich zum ersten Mal öffnet, und
zwei Kilobyte zu verdoppeln ist billiger als die Maschinerie, die ein zweiter dynamischer
Import je Bereich bräuchte — ein `await` in jeder Seite, ein zweiter Ladeweg und ein Flackern,
das man falsch machen kann.

Ergebnis: erster Paint 113,8 kB — unter dem Stand vor der Umstellung.

## Begründung

**Warum kein `@nuxtjs/i18n`.** Das Bundle-Budget für den ersten sinnvollen Paint sind
120 kB gzip (Regel 7, `docs/12-RESSOURCEN-BUDGET.md`), und der Stand ist 113,2 kB —
6,8 kB Luft. `@nuxtjs/i18n` bringt vue-i18n mit und sprengt das. Was diese App von einer
i18n-Bibliothek tatsächlich braucht, ist ein Nachschlagen in einem Objekt und eine
Pluralform; das sind wenige Dutzend Zeilen.

**Warum Nachladen statt Einbetten.** Beide Sprachen im Bundle hieße, dass jeder Nutzer die
Sprache mitlädt, die er nicht liest. Nachgeladen kostet der erste Paint eine Sprache — und
die zweite Sprache kostet niemanden etwas, der sie nicht wählt.

**Warum die Adressen mitziehen.** Eine englische Oberfläche unter `/korb` ist ein halbes
Versprechen. Adressen sind das, was jemand im Browser sieht, teilt und in ein Lesezeichen
legt; sie gehören zur Oberfläche und nicht zum Innenleben.

## Folgen

**Alte Adressen müssen weiterleiten.** Es gibt Lesezeichen, installierte PWAs mit
`start_url: '/'` und einen Service Worker mit einem Precache, der die alten Pfade kennt.
Jede umbenannte Route bekommt eine dauerhafte Weiterleitung von ihrem alten Namen.

**Die Übersetzung ist keine Maschinenarbeit.** Die deutschen Texte sind an vielen Stellen
bewusst formuliert — „Side One, Track One", „Habe ich die schon?", die Begründungssätze der
Matching-Engine. Sie werden auf Englisch neu geschrieben, nicht übersetzt. Das ist der
Grund, warum diese Umstellung Sitzungen und nicht Stunden dauert.

**Die Begründungssätze der Engine sind der heikelste Teil.** Sie entstehen zur Laufzeit aus
Signalen (`worker/match/reason.ts`) und sind durch den Golden-File-Test festgenagelt. Eine
zweite Sprache dort heißt: der Satzbau wird zu Daten, und der Snapshot ändert sich
vollständig. Dieser Schritt bekommt einen eigenen PR und eine eigene Erklärung des Diffs.

**`docs/` bleibt vorerst deutsch.** Die Unterlagen sind der größte Brocken und der am
wenigsten dringende: wer beitragen will, braucht zuerst eine englische Oberfläche und
englische Adressen. Die Übersetzung der Unterlagen folgt, und bis dahin sagt der README es
offen.

## Verworfene Alternativen

**Deutsch behalten und eine englische Übersetzung anbieten.** Das ist dieselbe Arbeit mit
umgekehrtem Vorzeichen und lässt die Grundsprache dort, wo sie niemandem außer dem Autor
nützt. Die Vorgabe entscheidet, wen das Projekt einlädt.

**Nur die Oberfläche, Adressen deutsch lassen.** Billiger, und es bleibt ein Projekt, das
auf halbem Weg stehen bleibt. `/haendler` ist für jemanden ohne Deutsch nicht einmal
aussprechbar.

**Sprach-Präfixe (`/de/…`, `/en/…`).** Der übliche Weg bei serverseitigem Rendering und
hier falsch: es gibt keinen Server, jede Route existiert doppelt im Precache, und ein
geteilter Link legt beim Empfänger die Sprache fest statt seiner eigenen.
