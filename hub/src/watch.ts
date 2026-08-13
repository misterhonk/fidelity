import type { DatabaseSync } from 'node:sqlite'

import webpush from 'web-push'

/**
 * Der Wächter — die eine Aufgabe, für die ein Hub laufen muss.
 *
 * Alles andere hier ist ein Cache: man kann ihn abschalten, und die App merkt
 * nichts davon außer längeren Wartezeiten. Der Wächter ist anders. Er ist der
 * einzige Grund, überhaupt einen Prozess zu betreiben — und er ist es wert:
 *
 *   Ohne Hub fragt jedes Gerät jeden beobachteten Laden selbst ab. Hundert
 *   Leute, die denselben Laden beobachten, sind hundert Abfragen für dieselbe
 *   Zahl. Mit Hub ist es **eine**.
 *
 * **Kein Token, nirgends.** `GET /users/{name}` gibt `num_for_sale` ohne
 * Anmeldung heraus (gemessen 2026-08-11). Der Hub hat also keinen Grund, je
 * einen Token zu sehen, und keine Stelle, an der er einen annehmen könnte.
 *
 * **Und kein Scan.** Eine Abfrage je Laden und Stunde ist keine Inventur — die
 * Regel, die Inventar-Scans auf dem Hub verbietet, zielt auf die zweihundert
 * Seiten, nicht auf die eine Zahl. Der Unterschied ist der ganze Entwurf: ein
 * Scan gehört auf das Gerät des Nutzers, weil dessen IP sein eigenes Budget
 * hat; eine geteilte Zahl gehört hierher, weil sie für alle dieselbe ist.
 */

/**
 * Abstand zwischen zwei Discogs-Abfragen, ohne Kennung.
 *
 * Unangemeldet erlaubt Discogs 25 Anfragen pro Minute pro IP — und der Hub
 * *ist* eine IP, für alle seine Nutzer zusammen. 2.400 ms lassen ihm reichlich
 * Luft und machen ihn trotzdem schnell genug: hundert beobachtete Läden sind
 * vier Minuten, einmal pro Stunde.
 */
export const POLL_SPACING_MS = 2400

/**
 * Und mit Kennung.
 *
 * Consumer-Key und -Secret einer registrierten Discogs-Anwendung heben das
 * Limit auf 60 pro Minute. Das ist **keine Anmeldung als Person**: der Hub
 * sieht damit nichts, was er vorher nicht sah, er sagt Discogs nur, welche
 * Anwendung anklopft. Ein persönlicher Token hat hier nichts zu suchen — der
 * Hub ist ein geteilter Dienst, und dessen Abfragen wären dann die eines
 * einzelnen Menschen.
 *
 * Wer keine hinterlegt, verliert nichts als Tempo, das hier ohnehin niemand
 * braucht: 60 Läden sind so 72 statt 144 Sekunden, in einem Fenster von zehn
 * Minuten. Eng wird es erst jenseits von ein paar hundert Läden.
 */
export const POLL_SPACING_IDENTIFIED_MS = 1200

/** Wie alt ein Stand sein darf, bevor neu nachgesehen wird. */
export const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * Wie viele Läden ein Durchgang höchstens anfasst.
 *
 * Eine Obergrenze, keine Zielgröße. Sie verhindert, dass ein Hub mit
 * tausend beobachteten Läden eine Dreiviertelstunde am Stück abfragt und in
 * dieser Zeit auf nichts anderes reagiert.
 */
export const MAX_PER_ROUND = 60

/**
 * Wer da klopft.
 *
 * Discogs beantwortet eine Anfrage ohne User-Agent mit 403 — gemessen am
 * 2026-08-13, gegen den echten Endpunkt. Nodes `fetch` schickt von sich aus
 * `node`, und damit kommt man heute durch; aber „node" ist genau die Art
 * nichtssagender Kennung, die ein Anbieter irgendwann aussperrt, und der
 * Wächter läuft ab jetzt rund um die Uhr.
 *
 * Im Browser ginge das nicht: `fetch()` darf den User-Agent dort nicht setzen
 * (CLAUDE.md). Hier läuft Node, hier geht es — also gehört es hierhin.
 */
export const USER_AGENT = 'FidelityHub/1.0 +https://github.com/misterhonk/fidelity'

export interface WatchDeps {
  db: DatabaseSync
  /**
   * Wen der Push-Dienst anschreiben soll, wenn etwas schiefgeht.
   *
   * VAPID verlangt eine `mailto:` oder eine URL. Sie geht an Google, Mozilla
   * und Apple, nicht an Discogs, und sagt denen nur, wer diesen Hub betreibt.
   */
  subject?: string
  /**
   * Die Discogs-Anwendung, als die dieser Hub auftritt — falls es eine gibt.
   *
   * Optional und bleibt es. Fehlt sie, fragt der Hub unangemeldet und
   * langsamer; nichts sonst ändert sich.
   */
  identity?: { key: string; secret: string } | null
  /** Injizierbar, damit Tests weder Netz noch Wartezeit brauchen. */
  fetchImpl?: typeof fetch
  send?: (
    subscription: webpush.PushSubscription,
    payload: string,
  ) => Promise<{ statusCode: number }>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface RoundResult {
  checked: number
  changed: number
  notified: number
  /** Empfänger, die der Push-Dienst als endgültig weg gemeldet hat. */
  dropped: number
  /**
   * Zustellungen, die scheiterten, ohne dass das Gerät für tot erklärt wurde.
   *
   * Bis zum 2026-08-13 gab es diese Zahl nicht, und der `catch` darunter tat
   * außer beim Aufräumen **nichts** — kein Zähler, kein Protokoll. Ein Gerät,
   * an das dauerhaft nichts durchkam, sah damit exakt aus wie ein Gerät, das
   * den Laden gar nicht beobachtet: `notified` fiel nur leiser aus. Genau
   * diese Lücke stand am selben Tag zwischen "es hat geklingelt" und "ich habe
   * nichts gesehen".
   */
  failed: number
}

/**
 * Die VAPID-Schlüssel, einmal erzeugt und dann für immer.
 *
 * Der öffentliche Teil steckt in jeder Subscription, die je vergeben wurde.
 * Ein neuer Schlüssel macht sie alle ungültig — deshalb liegen sie in der
 * Datenbank neben den Daten und nicht in einer Umgebungsvariable, die beim
 * nächsten `docker compose up` anders gesetzt sein könnte.
 */
export function vapidKeys(db: DatabaseSync): { publicKey: string; privateKey: string } {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'vapid'").get() as
    { value: string } | undefined

  if (row) return JSON.parse(row.value) as { publicKey: string; privateKey: string }

  const generated = webpush.generateVAPIDKeys()
  db.prepare("INSERT INTO meta (key, value) VALUES ('vapid', ?)").run(JSON.stringify(generated))
  return generated
}

/**
 * Ein Durchgang: nachsehen, was sich bewegt hat, und die Bescheid sagen, die
 * es wissen wollten.
 *
 * Läuft bewusst der Reihe nach und mit Pause dazwischen. Nebenläufig wäre er
 * schneller und würde das Limit reißen, das er einhalten soll — und zwar für
 * alle Nutzer dieses Hubs gleichzeitig.
 */
export async function watchRound(deps: WatchDeps): Promise<RoundResult> {
  const {
    db,
    identity = null,
    fetchImpl = globalThis.fetch.bind(globalThis),
    subject = 'mailto:hub@fidelity.invalid',
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = deps

  /*
   * VAPID wird hier eingerichtet, nicht beim Aufrufer.
   *
   * `web-push` verweigert den Versand ohne Schlüssel, und ein Aufrufer, der
   * das vergisst, merkt es erst, wenn zum ersten Mal wirklich etwas zu melden
   * wäre — also womöglich Tage später. Wer einen eigenen `send` mitgibt (die
   * Tests), braucht das nicht und bekommt es auch nicht.
   */
  let send = deps.send
  if (!send) {
    const keys = vapidKeys(db)
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
    send = (subscription, payload) => webpush.sendNotification(subscription, payload)
  }

  /*
   * Die Kennung geht in einen Kopf, nicht in die Adresse.
   *
   * `key=`/`secret=` als Abfrageparameter ist bei Discogs ebenfalls
   * dokumentiert und wäre kürzer — aber ein Geheimnis in einer URL landet in
   * jedem Zugriffsprotokoll, das zwischen hier und Discogs steht.
   */
  const headers: Record<string, string> = { 'user-agent': USER_AGENT }
  if (identity) {
    headers.authorization = `Discogs key=${identity.key}, secret=${identity.secret}`
  }
  const spacing = identity ? POLL_SPACING_IDENTIFIED_MS : POLL_SPACING_MS

  const result: RoundResult = { checked: 0, changed: 0, notified: 0, dropped: 0, failed: 0 }
  const cutoff = now() - STALE_AFTER_MS

  /*
   * Nur Läden, die auch jemand beobachtet — und die längste Zeit nicht
   * angesehenen zuerst. So kommt jeder dran, auch wenn eine Runde nicht für
   * alle reicht.
   */
  const due = db
    .prepare(
      `SELECT w.dealer AS dealer, s.num_for_sale AS known, s.checked_at AS checked_at
         FROM (SELECT DISTINCT dealer FROM watches) w
         LEFT JOIN watch_state s ON s.dealer = w.dealer
        WHERE s.checked_at IS NULL OR s.checked_at < ?
        ORDER BY COALESCE(s.checked_at, 0) ASC
        LIMIT ?`,
    )
    .all(cutoff, MAX_PER_ROUND) as { dealer: string; known: number | null }[]

  for (const [index, entry] of due.entries()) {
    if (index > 0) await sleep(spacing)

    let numForSale: number
    try {
      const response = await fetchImpl(
        `https://api.discogs.com/users/${encodeURIComponent(entry.dealer)}`,
        { headers },
      )
      if (!response.ok) continue
      const body = (await response.json()) as { num_for_sale?: number }
      if (typeof body.num_for_sale !== 'number') continue
      numForSale = body.num_for_sale
    } catch {
      // Discogs ist weg, langsam oder hat genug. Der nächste Durchgang
      // versucht es wieder; ein verpasster Laden ist keine Störung.
      continue
    }

    result.checked += 1
    db.prepare(
      `INSERT INTO watch_state (dealer, num_for_sale, checked_at) VALUES (?, ?, ?)
       ON CONFLICT(dealer) DO UPDATE SET num_for_sale = excluded.num_for_sale,
                                          checked_at = excluded.checked_at`,
    ).run(entry.dealer, numForSale, now())

    /*
     * Nur nach oben, und nur wenn es einen Vergleichswert gab.
     *
     * Beim allerersten Mal weiß der Hub nichts — dann ist die Zahl eine
     * Grundlinie und keine Nachricht. Und ein Laden, der fünf Platten verkauft,
     * bewegt sich nach unten; darüber will niemand etwas hören.
     */
    const before = entry.known
    if (before === null || numForSale <= before) continue

    const added = numForSale - before
    result.changed += 1
    result.notified += await notify(db, entry.dealer, added, { send, now, result })
  }

  return result
}

async function notify(
  db: DatabaseSync,
  dealer: string,
  added: number,
  ctx: {
    send: NonNullable<WatchDeps['send']>
    now: () => number
    result: RoundResult
  },
): Promise<number> {
  const targets = db
    .prepare(
      `SELECT w.endpoint AS endpoint, w.p256dh AS p256dh, w.auth AS auth
         FROM watchers w JOIN watches x ON x.endpoint = w.endpoint
        WHERE x.dealer = ?`,
    )
    .all(dealer) as { endpoint: string; p256dh: string; auth: string }[]

  const payload = JSON.stringify({ dealer, newListings: added, seenAt: ctx.now() })
  let sent = 0

  for (const target of targets) {
    try {
      await ctx.send(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
      )
      sent += 1
    } catch (error) {
      /*
       * 404 und 410 heißen: dieses Gerät gibt es nicht mehr. Aufräumen, sonst
       * schleppt der Hub für immer Adressen mit, die niemand mehr abholt —
       * und jede kostet in jedem Durchgang eine Zustellung, die scheitert.
       *
       * Alles andere ist vorübergehend: der Push-Dienst hat Schluckauf, das
       * Gerät ist aus. Beim nächsten Mal wieder.
       */
      const status = (error as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM watchers WHERE endpoint = ?').run(target.endpoint)
        db.prepare('DELETE FROM watches WHERE endpoint = ?').run(target.endpoint)
        ctx.result.dropped += 1
        continue
      }

      /*
       * Und alles andere wird gezählt und gesagt.
       *
       * Der Dienst statt der Adresse: letztere ist ein Schlüssel — wer sie
       * hat, darf diesem Gerät schicken — und hat in einem Protokoll nichts
       * verloren. Der Host verrät, welches Gerät schweigt, und das ist die
       * ganze gesuchte Auskunft.
       */
      ctx.result.failed += 1
      const where = URL.parse(target.endpoint)?.host ?? 'unbekannt'

      console.warn(`[watch] Zustellung an ${where} gescheitert (${status ?? 'ohne Status'})`)
    }
  }

  return sent
}
