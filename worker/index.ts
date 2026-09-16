/**
 * Worker entry point. Owns the message loop and nothing else — the work lives
 * in worker/discogs, worker/match and worker/horizon, and each of them is
 * reachable only through a handler registered here.
 *
 * The main thread never computes (CLAUDE.md). It renders and takes input.
 */
import type { RequestKind, WorkerError, WorkerInbound, WorkerOutbound } from '#shared/protocol'

import { trackForeground } from './busy'
import { handlers } from './handlers'
import { redactString } from './log'

const scope = self as unknown as DedicatedWorkerGlobalScope

/** Derived from the handler map, so it can never drift out of sync with it. */
const KINDS = new Set<string>([...Object.keys(handlers), '$cancel'])

/** One AbortController per in-flight request, so $cancel can reach it. */
const inFlight = new Map<string, AbortController>()

/**
 * A worker receives messages from anything on the page, browser extensions and
 * dev tooling included. Whatever is not recognisably ours gets dropped rather
 * than dispatched.
 */
function isWorkerInbound(value: unknown): value is WorkerInbound {
  if (typeof value !== 'object' || value === null) return false
  const message = value as { id?: unknown; kind?: unknown }
  return (
    typeof message.id === 'string' &&
    typeof message.kind === 'string' &&
    KINDS.has(message.kind)
  )
}

function send(message: WorkerOutbound) {
  scope.postMessage(message)
}

/** The last few hundred ids answered — enough to catch a re-delivery, small enough to forget. */
const answered = new Set<string>()
function remember(id: string) {
  answered.add(id)
  if (answered.size > 500) {
    const oldest = answered.values().next().value
    if (oldest !== undefined) answered.delete(oldest)
  }
}

async function dispatch(id: string, kind: RequestKind, params: unknown) {
  const controller = new AbortController()
  inFlight.set(id, controller)

  try {
    const handler = handlers[kind] as (
      params: unknown,
      ctx: { report: (progress: unknown) => void; signal: AbortSignal },
    ) => Promise<unknown>

    const run = () =>
      handler(params, {
        report: (progress) => send({ id, type: 'progress', progress }),
        signal: controller.signal,
      })

    /*
     * Everything except the keeper counts as foreground.
     *
     * The keeper stands aside for anything somebody asked for (worker/busy.ts);
     * counting its own tick as foreground would make it stand aside for itself
     * and never run at all.
     */
    const result = kind === 'keeper.tick' ? await run() : await trackForeground(run)

    send({ id, type: 'result', result })
  } catch (error) {
    send({
      id,
      type: 'error',
      error: {
        // Through the same redaction the log uses: a message that ever carried
        // the token or a header would otherwise reach ErrorNote unfiltered.
        message: redactString(error instanceof Error ? error.message : String(error)),
        code: codeOf(error, controller.signal.aborted),
        // The only number a failure carries. It is the hub's own status, and
        // the sentence for it names it.
        status: (error as { status?: number } | null)?.status,
        dealer: (error as { dealer?: string } | null)?.dealer,
      },
    })
  } finally {
    inFlight.delete(id)
  }
}

/**
 * Which of the known failures this was.
 *
 * Errors do not survive `postMessage` — only their message does — so the code
 * has to be lifted out here or the main thread sees an anonymous string. It
 * used to set only 'cancelled', which meant "Token abgelaufen" and "429"
 * arrived as raw text and the interface had nothing to explain.
 *
 * Cancellation wins over everything: a request aborted mid-flight often fails
 * with a network error on the way out, and reporting that as "offline" would
 * be a lie about a button somebody pressed on purpose.
 */
function codeOf(error: unknown, aborted: boolean): WorkerError['code'] {
  if (aborted) return 'cancelled'

  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code !== 'cancelled'
    ? (code as WorkerError['code'])
    : undefined
}

/*
 * Listen once, even when this module runs twice.
 *
 * Measured on 2026-09-12 in WebKit: Rollup hoists the code that every lazy
 * chunk shares — `openFidelityDb`, the log, the pacer — into this entry
 * chunk, so a lazy chunk imports it back from `./index-….js`. Chromium finds
 * the worker's own script in its module map and hands out the same
 * instance; WebKit evaluates the entry a second time, and a second copy of
 * this listener came to life beside the first. Every message then ran
 * twice: one `places.create` wrote two rooms called "Living room". The
 * flag on the global is what a module map is for the browser that has none
 * here — the second evaluation still serves its exports, it just does not
 * listen.
 */
const listening = scope as unknown as { __fidelityListening?: true }
if (!listening.__fidelityListening) {
  listening.__fidelityListening = true
  scope.addEventListener('message', onMessage)
}

function onMessage(event: MessageEvent) {
  const message: unknown = event.data
  if (!isWorkerInbound(message)) return

  if (message.kind === '$cancel') {
    inFlight.get(message.id)?.abort()
    return
  }

  /*
   * Once per id, whatever the browser does.
   *
   * Measured on 2026-09-12 in WebKit: one `postMessage` from the page
   * arrived here twice, same id, a millisecond apart — `places.create` ran
   * twice and wrote two rooms named "Living room". Every idempotent handler
   * (a put, a read) had been hiding it; the first non-idempotent one showed
   * it. The bridge on the other side drops the second answer anyway, so the
   * only trace was the duplicate row. Ids are random per call; a second
   * arrival of the same one can only be a re-delivery, and is ignored.
   */
  if (inFlight.has(message.id) || answered.has(message.id)) return
  remember(message.id)

  void dispatch(message.id, message.kind, message.params)
}
