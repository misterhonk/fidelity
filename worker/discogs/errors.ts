import type { WorkerError } from '#shared/protocol'

/**
 * Discogs is midway through a backend migration and answers errors in two
 * shapes. Both have to be understood, or a perfectly explanatory message turns
 * into "[object Object]" in the UI.
 *
 *   legacy    { "message": "Invalid sort: expected one of …" }
 *   migrated  { "detail": [ { "type": "literal_error", "loc": [...], … } ],
 *               "message": "…" }
 */
export class DiscogsError extends Error {
  readonly status: number
  readonly code: WorkerError['code']
  /** Field-level complaints from the FastAPI shape, flattened for display. */
  readonly details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.name = 'DiscogsError'
    this.status = status
    this.details = details
    this.code = codeFor(status)
  }
}

function codeFor(status: number): WorkerError['code'] {
  if (status === 429) return 'rate-limited'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 0) return 'offline'
  return undefined
}

interface FastApiDetail {
  msg?: unknown
  type?: unknown
  loc?: unknown
}

function describe(detail: FastApiDetail): string {
  const where = Array.isArray(detail.loc) ? detail.loc.join('.') : undefined
  const what = typeof detail.msg === 'string' ? detail.msg : String(detail.type ?? 'invalid')
  return where ? `${where}: ${what}` : what
}

/**
 * Turns whatever came back into a DiscogsError. Never throws itself — an
 * unparseable body must still produce a usable error.
 */
export function toDiscogsError(status: number, body: unknown): DiscogsError {
  if (typeof body !== 'object' || body === null) {
    return new DiscogsError(status, `Discogs antwortete mit HTTP ${status}.`)
  }

  const { message, detail } = body as { message?: unknown; detail?: unknown }
  const details = Array.isArray(detail) ? detail.map((entry) => describe(entry ?? {})) : []

  const text =
    typeof message === 'string' && message.length > 0
      ? message
      : (details[0] ?? `Discogs antwortete mit HTTP ${status}.`)

  return new DiscogsError(status, text, details)
}
