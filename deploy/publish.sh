#!/bin/sh
# Eine neue Fassung ausliefern, ohne dass jemand eine halbe sieht.
#
# Aufruf auf dem Zielserver:
#
#   publish.sh <hochgeladenes-verzeichnis> <ziel-wurzel> [version]
#
# Der Docroot des Webservers zeigt dabei auf <ziel-wurzel>/current — einen
# Symlink, nicht ein Verzeichnis. Das ist der ganze Trick:
#
#   ziel-wurzel/
#     releases/2026-08-11-a1b2c3/    ← die neue Fassung, vollständig
#     releases/2026-08-10-9f8e7d/    ← die vorherige, für den Rückweg
#     current -> releases/2026-08-11-a1b2c3
#
# **Warum nicht einfach rsync in den Docroot.** Ein Build besteht aus einer
# `index.html`, die die Namen ihrer Skripte nennt, und aus Skripten, deren Namen
# einen Hash enthalten. Beim Kopieren gibt es unvermeidlich einen Moment, in dem
# die neue `index.html` schon da ist und die Datei, die sie nennt, noch nicht —
# oder umgekehrt. Wer in genau diesem Moment die Seite lädt, bekommt eine
# kaputte. Bei einem Verzeichnis mit zweihundert Dateien ist dieser Moment nicht
# theoretisch, er dauert Sekunden.
#
# Mit dem Symlink dauert der Wechsel so lange wie ein `mv`: entweder alt oder
# neu, nie dazwischen.
#
# POSIX sh, kein bash: das läuft auf einem Uberspace, einem Synology-NAS und
# einem Alpine-Container gleichermaßen.

set -eu

SOURCE="${1:?Verzeichnis mit der neuen Fassung fehlt}"
ROOT="${2:?Ziel-Wurzel fehlt}"
VERSION="${3:-$(date +%Y%m%d%H%M%S)}"

# Wie viele alte Fassungen liegen bleiben. Drei sind zwei Rückwege und der
# Beweis, dass es einen gibt — und bei ~1,5 MB je Fassung kein Thema.
KEEP="${KEEP:-3}"

[ -d "$SOURCE" ] || { echo "Es gibt kein Verzeichnis $SOURCE" >&2; exit 1; }
[ -f "$SOURCE/index.html" ] || { echo "In $SOURCE liegt keine index.html — das sieht nicht nach einem Build aus" >&2; exit 1; }
[ -f "$SOURCE/200.html" ] || { echo "In $SOURCE fehlt 200.html — ohne die scheitert jede Unterseite" >&2; exit 1; }

RELEASES="$ROOT/releases"
TARGET="$RELEASES/$VERSION"

mkdir -p "$RELEASES"

# Ein zweiter Lauf derselben Version soll nicht auf halbem Weg scheitern.
rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -R "$SOURCE/." "$TARGET/"

# Der Wechsel.
#
# Zwei Wege, und welcher genommen wird, entscheidet das System — gemessen, nicht
# geraten (2026-08-11):
#
#   mv -Tf   Wirklich atomar: ein einziger rename(2), es gibt keinen Zeitpunkt,
#            zu dem `current` auf nichts zeigt. Aber `-T` ist GNU. Auf BSD und
#            macOS gibt es die Option nicht.
#
#   ln -sfn  Löschen und neu anlegen. Dazwischen liegen Mikrosekunden, in denen
#            `current` fehlt — das ist im schlimmsten Fall ein 404, nie eine
#            halb ausgetauschte Seite. Funktioniert überall.
#
# Was hier **nicht** steht, weil es lautlos das Falsche tut: `mv -f` ohne `-T`
# auf einen bestehenden Symlink. Das folgt ihm und legt den neuen Link *in* das
# Verzeichnis, auf das er zeigt. Der Befehl meldet Erfolg, und `current` zeigt
# weiter auf die alte Fassung. Genau so ist es beim ersten Test passiert.
if ln -sfn "$TARGET" "$ROOT/.current.neu" 2>/dev/null &&
   mv -Tf "$ROOT/.current.neu" "$ROOT/current" 2>/dev/null; then
  :
else
  rm -f "$ROOT/.current.neu"
  ln -sfn "$TARGET" "$ROOT/current"
fi

echo "Ausgeliefert: $VERSION"

# Aufräumen, aber nie die Fassung, auf die gerade gezeigt wird.
CURRENT_NAME=$(basename "$(readlink "$ROOT/current")")
ls -1 "$RELEASES" | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do
  [ "$old" = "$CURRENT_NAME" ] && continue
  rm -rf "$RELEASES/$old"
  echo "  entfernt: $old"
done

exit 0
