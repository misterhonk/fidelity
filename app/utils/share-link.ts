/**
 * The link a find list travels in (#249).
 *
 * The list sits in the `#` fragment — the one part of an address no browser
 * sends to a server — and the link hangs off the app root, not off the page it
 * was made on: /shop/shared is no route.
 */
export function sharedUrl(data: string, at: Location = location): string {
  return `${at.origin}${at.pathname.replace(/\/(shop|stack)\/?$/, '')}/shared#d=${data}`
}

/**
 * Hands the link over: the system share sheet where there is one, the
 * clipboard where there is not. Null when somebody closed the sheet or neither
 * worked — the link stays on screen to be taken by hand.
 */
export async function handOver(url: string): Promise<'sent' | 'copied' | null> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url })
      return 'sent'
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return null
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return null
  }
}
