/**
 * Logging with a redaction list, because of CLAUDE.md rule 6: the Personal
 * Access Token never leaves IndexedDB. Not into a log, not into a URL, not
 * into an error report.
 *
 * Two layers, deliberately belt and braces:
 *
 *   1. A pattern for the shape a token takes in transit (`Discogs token=…`),
 *      which catches it even in strings we never saw before.
 *   2. The literal secret, registered the moment it is read out of IndexedDB.
 *      A token pasted into a search field and echoed back in an error message
 *      matches no pattern, but it does match itself.
 */
const PATTERNS: RegExp[] = [/Discogs token=\S+/gi, /token=[A-Za-z0-9_-]{8,}/gi]

const secrets = new Set<string>()

/** Registers a literal value that must never appear in output. */
export function registerSecret(secret: string | null | undefined): void {
  // Short strings would redact half the log; a Discogs PAT is 40 characters.
  if (secret && secret.length >= 8) secrets.add(secret)
}

export function forgetSecrets(): void {
  secrets.clear()
}

export function redactString(value: string): string {
  let out = value
  for (const secret of secrets) out = out.split(secret).join('[redacted]')
  for (const pattern of PATTERNS) out = out.replace(pattern, '[redacted]')
  return out
}

/** Deep-redacts anything on its way to the console. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value)
  if (typeof value !== 'object' || value === null) return value

  if (seen.has(value)) return '[circular]'
  seen.add(value)

  if (value instanceof Error) {
    const clone = new Error(redactString(value.message))
    clone.name = value.name
    clone.stack = value.stack ? redactString(value.stack) : undefined
    return clone
  }

  if (Array.isArray(value)) return value.map((entry) => redact(entry, seen))

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redact(entry, seen)]),
  )
}

function emit(level: 'debug' | 'info' | 'warn' | 'error', args: unknown[]): void {
  console[level](...args.map((arg) => redact(arg)))
}

export const log = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
}
