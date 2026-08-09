/**
 * Worker entry point. Owns the message loop and nothing else — the work lives
 * in worker/discogs, worker/match and worker/horizon, and each of them is
 * reachable only through a handler registered here.
 *
 * The main thread never computes (CLAUDE.md). It renders and takes input.
 */
import type { RequestKind, WorkerInbound, WorkerOutbound } from '#shared/protocol'

import { handlers } from './handlers'

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

async function dispatch(id: string, kind: RequestKind, params: unknown) {
  const controller = new AbortController()
  inFlight.set(id, controller)

  try {
    const handler = handlers[kind] as (
      params: unknown,
      ctx: { report: (progress: unknown) => void; signal: AbortSignal },
    ) => Promise<unknown>

    const result = await handler(params, {
      report: (progress) => send({ id, type: 'progress', progress }),
      signal: controller.signal,
    })

    send({ id, type: 'result', result })
  } catch (error) {
    send({
      id,
      type: 'error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: controller.signal.aborted ? 'cancelled' : undefined,
      },
    })
  } finally {
    inFlight.delete(id)
  }
}

scope.addEventListener('message', (event: MessageEvent) => {
  const message: unknown = event.data
  if (!isWorkerInbound(message)) return

  if (message.kind === '$cancel') {
    inFlight.get(message.id)?.abort()
    return
  }

  void dispatch(message.id, message.kind, message.params)
})
