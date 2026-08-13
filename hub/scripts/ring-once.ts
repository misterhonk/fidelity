/**
 * Den Wächter einmal klingeln lassen, ohne auf einen Händler zu warten.
 *
 * Ein echter Durchgang meldet nur, wenn ein Laden seit dem letzten Blick
 * gewachsen ist. Das ist genau richtig und macht die Kette unprüfbar: nach
 * einer Auslieferung will man wissen, ob VAPID, Anmeldung, Zustellung und der
 * Service Worker zusammen noch funktionieren — und nicht drei Tage warten, bis
 * jemand Platten einliefert.
 *
 * Also wird die letzte bekannte Zahl abgesenkt und ein Durchgang angestoßen.
 * Der Wächter sieht daraufhin echtes Wachstum, rechnet es aus einer echten
 * Discogs-Antwort aus und verschickt eine echte Benachrichtigung — gelogen ist
 * nur die Erinnerung, nicht der Weg. Danach steht die wahre Zahl wieder da:
 * der Durchgang schreibt sie selbst zurück, der Eingriff heilt sich also.
 *
 * Aufruf (auf dem Server, neben dem laufenden Hub):
 *
 *   node scripts/ring-once.ts [um-wie-viel]
 *
 * Es wird **nichts** angemeldet und nichts erfunden: gibt es keinen
 * beobachteten Laden und keinen Empfänger, sagt das Skript das und hört auf.
 * Ein Klingeln ohne Ohr wäre kein Beweis.
 */
/* eslint-disable no-console -- Ein Werkzeug für die Kommandozeile: seine
   Ausgabe *ist* das Ergebnis, und die no-console-Regel ist für Browsercode
   geschrieben. */
import { openHubDb } from '../src/db.ts'
import { watchRound } from '../src/watch.ts'

const by = Number(process.argv[2] ?? 5)
const dbPath = process.env.HUB_DB ?? './hub.sqlite'
const db = openHubDb(dbPath)

const key = process.env.HUB_DISCOGS_KEY
const secret = process.env.HUB_DISCOGS_SECRET
const identity = key && secret ? { key, secret } : null
/*
 * Dieselbe Absenderangabe wie der Dienst. Sie geht an Google, Mozilla und
 * Apple; eine andere hier würde eine Zustellung scheitern lassen, die im
 * echten Betrieb funktioniert — und den Test damit zum Lügner machen.
 */
const subject = process.env.HUB_VAPID_SUBJECT ?? 'mailto:hub@fidelity.invalid'

const watchers = (db.prepare('SELECT COUNT(*) AS n FROM watchers').get() as { n: number }).n
const watched = db.prepare('SELECT DISTINCT dealer FROM watches').all() as { dealer: string }[]

/*
 * Wer da eigentlich angemeldet ist.
 *
 * Ohne diese Zeilen ist ein Durchgang mit `notified: 1` bei zwei Empfängern
 * nicht zu deuten: hat das zweite Gerät den Laden nicht beobachtet, oder hat
 * die Zustellung geschwiegen? Die Adresse verrät den Dienst — und damit das
 * Gerät —, ohne dass sie im Protokoll landen muss: sie ist ein Schlüssel, wer
 * sie hat, darf diesem Gerät schicken.
 */
const rows = db
  .prepare(
    `SELECT w.endpoint AS endpoint, w.created_at AS created_at,
            (SELECT GROUP_CONCAT(dealer) FROM watches WHERE endpoint = w.endpoint) AS dealers
       FROM watchers w ORDER BY w.created_at`,
  )
  .all() as { endpoint: string; created_at: number; dealers: string | null }[]

console.log(`${watchers} Empfänger, ${watched.length} beobachtete Läden`)
for (const row of rows) {
  const host = URL.parse(row.endpoint)?.host ?? 'unbekannt'
  const service = host.includes('apple')
    ? 'Safari/iOS'
    : host.includes('google')
      ? 'Chrome'
      : host
  const when = new Date(row.created_at).toISOString().slice(0, 16).replace('T', ' ')
  console.log(`  ${service.padEnd(12)} seit ${when}  →  ${row.dealers ?? 'nichts beobachtet'}`)
}

if (watchers === 0 || watched.length === 0) {
  console.log('Nichts zu tun — erst in der App einen Laden beobachten.')
  process.exit(0)
}

/*
 * Ohne Grundlinie zuerst eine holen.
 *
 * Der erste Blick auf einen Laden meldet absichtlich nichts — sonst bekäme
 * jeder, der einen Laden neu aufnimmt, sofort eine Meldung über zweitausend
 * "neue" Platten. Hier heißt das: einmal leer laufen lassen.
 */
const known = db.prepare('SELECT dealer, num_for_sale FROM watch_state').all() as {
  dealer: string
  num_for_sale: number
}[]

if (known.length === 0) {
  console.log('Noch keine Grundlinie — hole eine.')
  console.log(await watchRound({ db, identity, subject }))
}

const states = db.prepare('SELECT dealer, num_for_sale FROM watch_state').all() as {
  dealer: string
  num_for_sale: number
}[]

for (const row of states) {
  // `checked_at = 0` hebt die Stundensperre auf, sonst sieht dieser Durchgang
  // gar nicht erst nach.
  db.prepare('UPDATE watch_state SET num_for_sale = ?, checked_at = 0 WHERE dealer = ?').run(
    Math.max(0, row.num_for_sale - by),
    row.dealer,
  )
  console.log(
    `${row.dealer}: erinnere mich an ${Math.max(0, row.num_for_sale - by)} statt ${row.num_for_sale}`,
  )
}

const result = await watchRound({ db, identity, subject })
console.log(result)

if (result.notified === 0) {
  console.log('Niemand benachrichtigt — das ist der Fehlschlag, nicht das Ergebnis.')
  process.exit(1)
}
