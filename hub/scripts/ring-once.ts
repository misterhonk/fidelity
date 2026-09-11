/**
 * Making the watcher ring once, without waiting for a dealer.
 *
 * A real pass reports only when a shop has grown since the last look. That is
 * exactly right and makes the chain untestable: after a deployment you want to
 * know whether VAPID, subscription, delivery and the service worker still work
 * together — not wait three days for somebody to take records in.
 *
 * So the last known number is lowered and a pass is started. The watcher then
 * sees real growth, works it out from a real Discogs answer and sends a real
 * notification — only the memory is a lie, not the path. Afterwards the true
 * number is back: the pass writes it itself, so the intervention heals.
 *
 * Invocation (on the server, beside the running hub):
 *
 *   node scripts/ring-once.ts [by-how-much]
 *
 * **Nothing** is subscribed and nothing invented: if there is no watched shop
 * and no recipient, the script says so and stops. A bell with no ear would
 * prove nothing.
 */
/* eslint-disable no-console -- A command-line tool: its output *is* the
   result, and the no-console rule is written for browser code. */
import { openHubDb } from '../src/db.ts'
import { watchRound } from '../src/watch.ts'

const by = Number(process.argv[2] ?? 5)
const dbPath = process.env.HUB_DB ?? './hub.sqlite'
const db = openHubDb(dbPath)

const key = process.env.HUB_DISCOGS_KEY
const secret = process.env.HUB_DISCOGS_SECRET
const identity = key && secret ? { key, secret } : null
/*
 * The same sender details as the service. They go to Google, Mozilla and
 * Apple; a different one here would make a delivery fail that works in real
 * operation — and so turn the test into a liar.
 */
const subject = process.env.HUB_VAPID_SUBJECT ?? 'mailto:hub@fidelity.invalid'

const watchers = (db.prepare('SELECT COUNT(*) AS n FROM watchers').get() as { n: number }).n
const watched = db.prepare('SELECT DISTINCT dealer FROM watches').all() as { dealer: string }[]

/*
 * Who is actually subscribed.
 *
 * Without these lines a pass reporting `notified: 1` with two recipients
 * cannot be read: did the second device not watch the shop, or did the
 * delivery stay silent? The address gives away the service — and with it the
 * device — without having to land in the log: it is a key, and whoever has it
 * may send to that device.
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
 * With no baseline, fetch one first.
 *
 * The first look at a shop deliberately reports nothing — otherwise anybody
 * taking on a new shop would immediately be told about two thousand "new"
 * records. Here that means: let one pass run empty.
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
  // `checked_at = 0` lifts the hourly bar; without it this pass would not look
  // at all.
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
