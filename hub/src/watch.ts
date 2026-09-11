import type { DatabaseSync } from 'node:sqlite'

import webpush from 'web-push'

/**
 * The watcher — the one job a hub has to run for.
 *
 * Everything else here is a cache: you can switch it off and the app notices
 * nothing but longer waits. The watcher is different. It is the only reason to
 * operate a process at all — and it is worth it:
 *
 *   Without a hub, every device asks every watched shop itself. A hundred
 *   people watching the same shop are a hundred queries for the same number.
 *   With a hub it is **one**.
 *
 * **No token, anywhere.** `GET /users/{name}` hands out `num_for_sale` without
 * authentication (measured 2026-08-11). So the hub has no reason ever to see a
 * token, and nowhere it could accept one.
 *
 * **And no scanning.** One query per shop per hour is not an inventory — the
 * rule forbidding inventory scans on the hub is aimed at the two hundred
 * pages, not at the one number. The difference is the whole design: a scan
 * belongs on the user's device, because their IP has its own budget; a shared
 * number belongs here, because it is the same for everybody.
 */

/**
 * The gap between two Discogs queries, with no credentials.
 *
 * Unauthenticated, Discogs allows 25 requests per minute per IP — and the hub
 * *is* one IP, for all of its users together. 2,400 ms leaves it plenty of
 * room and is still fast enough: a hundred watched shops are four minutes,
 * once an hour.
 */
export const POLL_SPACING_MS = 2400

/**
 * And with credentials.
 *
 * The consumer key and secret of a registered Discogs application raise the
 * limit to 60 per minute. That is **not signing in as a person**: the hub sees
 * nothing it did not see before, it only tells Discogs which application is
 * knocking. A personal token has no business here — the hub is a shared
 * service, and its queries would then be one single human's.
 *
 * Entering none costs nothing but speed, which nobody needs here anyway: 60
 * shops become 72 seconds instead of 144, inside a ten-minute window. It only
 * gets tight past a few hundred shops.
 */
export const POLL_SPACING_IDENTIFIED_MS = 1200

/** How old a reading may be before it is looked up again. */
export const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * How many shops one pass touches at most.
 *
 * A ceiling, not a target. It stops a hub with a thousand watched shops from
 * querying for three quarters of an hour straight and responding to nothing
 * else while it does.
 */
export const MAX_PER_ROUND = 60

/**
 * Who is knocking.
 *
 * Discogs answers a request with no User-Agent with a 403 — measured
 * 2026-08-13, against the real endpoint. Node's `fetch` sends `node` of its
 * own accord, which gets through today; but "node" is exactly the kind of
 * meaningless identifier a provider eventually shuts out, and from now on the
 * watcher runs around the clock.
 *
 * This would not work in a browser: `fetch()` may not set the User-Agent there
 * (CLAUDE.md). Node runs here, so it works here — which is why it belongs
 * here.
 */
export const USER_AGENT = 'FidelityHub/1.0 +https://github.com/misterhonk/fidelity'

export interface WatchDeps {
  db: DatabaseSync
  /**
   * Who the push service should write to when something goes wrong.
   *
   * VAPID requires a `mailto:` or a URL. It goes to Google, Mozilla and Apple,
   * not to Discogs, and tells them only who runs this hub.
   */
  subject?: string
  /**
   * The Discogs application this hub presents itself as — if there is one.
   *
   * Optional, and it stays that way. Without it the hub queries
   * unauthenticated and more slowly; nothing else changes.
   */
  identity?: { key: string; secret: string } | null
  /** Injectable, so that tests need neither the network nor the wait. */
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
  /** Recipients the push service has reported as permanently gone. */
  dropped: number
  /**
   * Deliveries that failed without the device being declared dead.
   *
   * Until 2026-08-13 this number did not exist, and the `catch` below did
   * **nothing** but clean up — no counter, no log. A device nothing ever got
   * through to therefore looked exactly like a device not watching the shop at
   * all: `notified` simply came out quieter. That same gap stood, on the same
   * day, between "it rang" and "I saw nothing".
   */
  failed: number
}

/**
 * The VAPID keys, generated once and then forever.
 *
 * The public half sits inside every subscription ever handed out. A new key
 * invalidates all of them — which is why they live in the database beside the
 * data and not in an environment variable that could be set differently at the
 * next `docker compose up`.
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
 * One pass: look at what has moved, and tell the people who wanted to know.
 *
 * Deliberately in sequence, with a pause between. Concurrently it would be
 * faster and would break the limit it is meant to keep — and break it for
 * every user of this hub at once.
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
   * VAPID is set up here, not at the caller.
   *
   * `web-push` refuses to send without keys, and a caller who forgets notices
   * only the first time there is genuinely something to report — possibly days
   * later. Anyone passing their own `send` (the tests) does not need this and
   * does not get it.
   */
  let send = deps.send
  if (!send) {
    const keys = vapidKeys(db)
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
    send = (subscription, payload) => webpush.sendNotification(subscription, payload)
  }

  /*
   * The credentials go in a header, not in the address.
   *
   * `key=`/`secret=` as query parameters is documented by Discogs too and
   * would be shorter — but a secret in a URL lands in every access log between
   * here and Discogs.
   */
  const headers: Record<string, string> = { 'user-agent': USER_AGENT }
  if (identity) {
    headers.authorization = `Discogs key=${identity.key}, secret=${identity.secret}`
  }
  const spacing = identity ? POLL_SPACING_IDENTIFIED_MS : POLL_SPACING_MS

  const result: RoundResult = { checked: 0, changed: 0, notified: 0, dropped: 0, failed: 0 }
  const cutoff = now() - STALE_AFTER_MS

  /*
   * Only shops somebody is actually watching — and the longest unlooked-at
   * first. That way everyone gets a turn, even when one round does not stretch
   * to all of them.
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
      // Discogs is gone, slow, or has had enough. The next pass tries again;
      // one missed shop is not a fault.
      continue
    }

    result.checked += 1
    db.prepare(
      `INSERT INTO watch_state (dealer, num_for_sale, checked_at) VALUES (?, ?, ?)
       ON CONFLICT(dealer) DO UPDATE SET num_for_sale = excluded.num_for_sale,
                                          checked_at = excluded.checked_at`,
    ).run(entry.dealer, numForSale, now())

    /*
     * Upwards only, and only where there was something to compare against.
     *
     * The very first time, the hub knows nothing — the number is a baseline
     * then, not news. And a shop that sells five records moves downwards;
     * nobody wants to hear about that.
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
       * 404 and 410 mean: this device is gone. Clean up, or the hub carries
       * addresses forever that nobody collects from — and each one costs a
       * failed delivery on every pass.
       *
       * Everything else is temporary: the push service has hiccups, the device
       * is off. Again next time.
       */
      const status = (error as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM watchers WHERE endpoint = ?').run(target.endpoint)
        db.prepare('DELETE FROM watches WHERE endpoint = ?').run(target.endpoint)
        ctx.result.dropped += 1
        continue
      }

      /*
       * And everything else is counted and said out loud.
       *
       * The service rather than the address: the latter is a key — whoever has
       * it may send to this device — and has no business in a log. The host
       * says which device is silent, and that is the whole of what was being
       * asked.
       */
      ctx.result.failed += 1
      const where = URL.parse(target.endpoint)?.host ?? 'unbekannt'

      console.warn(`[watch] Zustellung an ${where} gescheitert (${status ?? 'ohne Status'})`)
    }
  }

  return sent
}
