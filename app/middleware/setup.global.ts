/**
 * Ohne Token gehört niemand auf einen Bildschirm voller Daten.
 *
 * Die Umleitung stand bis zum 2026-08-14 allein im `onMounted` der Startseite.
 * Wer `/shelf` per Lesezeichen aufrief, wer die App auf `/dealers` geschlossen
 * und wieder geöffnet hatte, oder wer einem Link folgte, landete auf einer
 * fertigen Seite mit „No records here yet. Fetch the collection in the
 * settings." — einer Aussage über die Sammlung, wo eine über den Zustand der
 * App hingehört. Es liegt nicht daran, dass nichts da ist, sondern daran, dass
 * niemand eingerichtet ist.
 *
 * Eine Middleware und keine Wiederholung des `onMounted` auf jeder Seite: es
 * gibt zwölf davon, und die dreizehnte vergisst es.
 */

/**
 * Wohin man auch ohne Token darf.
 *
 * `/settings` ist die wichtigste Ausnahme und keine Nachlässigkeit: **dort wird
 * der Token eingetragen.** Wer diesen Zweig aussperrt, sperrt den Weg hinein
 * aus — und zwar genau für die Leute, die ihn brauchen.
 *
 * Datenschutz und Impressum sind Pflichttexte; sie hinter eine Anmeldung zu
 * stellen wäre absurd.
 *
 * `/demo` stand hier bis zum 2026-09-10 mit dem Zusatz, es zeige erfundene
 * Daten und sei der Grund, warum jemand sich überhaupt einrichtet. Diese
 * Adresse gibt es nicht — es gibt keine `app/pages/demo.vue`, und diese Zeile
 * war der einzige Ort im ganzen Repository, der sie erwähnte. Die Demo ist
 * `DemoDig.vue` und steht auf `/welcome`, also ohnehin schon offen. Eine
 * Ausnahme für eine 404 nimmt niemand wahr, aber ihr Kommentar behauptet einen
 * Bildschirm, den man dann sucht.
 */
/*
 * `/shared` ist die zweite wichtige Ausnahme, und aus dem gegenteiligen
 * Grund: dort landet jemand, der Fidelity **nicht** hat. Ein geteilter Link,
 * der zur Einrichtung umleitet, ist die schlechteste Art, eine App
 * vorzustellen — und der Bildschirm braucht nichts von dem, was die
 * Einrichtung besorgt: keine Sammlung, keinen Token, keinen Hub. Alles, was
 * er zeigt, steht im Link.
 */
const OPEN = ['/welcome', '/settings', '/privacy', '/legal', '/shared']

export default defineNuxtRouteMiddleware(async (to) => {
  /*
   * Nur im Browser.
   *
   * `ssr: false` heißt, dass hier ohnehin kein Server rendert — aber die
   * Middleware läuft beim Erzeugen der statischen Seiten mit, und dort gibt es
   * weder IndexedDB noch einen Worker, den man fragen könnte.
   */
  if (import.meta.server) return

  if (OPEN.some((path) => to.path === path || to.path.startsWith(`${path}/`))) return

  const { identity, ready, load } = useIdentity()
  if (!ready.value) await load()
  if (identity.value) return

  /*
   * Woher man kam, mitgeben.
   *
   * Die Einrichtung endet sonst immer auf der Startseite, und wer eigentlich
   * seinen Korb sehen wollte, sucht ihn danach von Hand. Kostet nichts und
   * macht aus einer Unterbrechung einen Umweg.
   */
  return navigateTo({
    path: '/welcome',
    query: to.fullPath === '/' ? {} : { next: to.fullPath },
  })
})
