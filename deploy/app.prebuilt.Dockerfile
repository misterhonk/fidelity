# Fidelity, die App — aus einem bereits gebauten Verzeichnis.
#
# Das Gegenstück zu app.Dockerfile, und es gibt beide aus einem Grund:
#
#   app.Dockerfile           baut alles selbst. Ein Befehl, kein Node nötig —
#                            das, was jemand lokal will (`docker compose build`).
#
#   app.prebuilt.Dockerfile  erwartet .output/public von außen. Das, was die
#                            CI will.
#
# **Warum die CI das anders macht.** Was der Nuxt-Build auswirft, sind statische
# Dateien — auf arm64 exakt dieselben wie auf amd64. Ihn für beide
# Architekturen unter Emulation laufen zu lassen, heißt also: dieselbe Arbeit
# zweimal, davon einmal um ein Vielfaches langsamer, für ein identisches
# Ergebnis.
#
# Und es ging dabei nicht nur um Zeit. Der emulierte Lauf **scheiterte**:
# @nuxt/fonts holt die Schriften zur Bauzeit von fonts.googleapis.com, und
# unter QEMU lief diese Anfrage in einen Timeout (gemessen 2026-08-11). Ein
# Build, der von einem fremden Server abhängt, ist ohnehin einer, der eines
# Tages ohne eigenes Zutun rot wird.
#
# Einmal nativ bauen, das Ergebnis in beide Images legen: schneller, robuster,
# und die beiden Architekturen unterscheiden sich nur noch in der nginx-Schicht,
# die sie tatsächlich brauchen.

FROM nginx:1.29-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY .output/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
