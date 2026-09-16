/**
 * Where a picture may come from.
 *
 * Every cover and every shop sign this app draws is an `<img src>` that the
 * browser fetches on sight. A URL that arrived from the hub, from a peer, or
 * from Discogs' own answer is data until it has been checked — a tracking
 * pixel on a foreign host, or a parser exploit, is one string away. Only
 * `https://i.discogs.com` passes; the empty string means "no picture" and
 * passes too. `https://i.discogs.com.evil.test` and
 * `https://evil.test/?a=https://i.discogs.com` both survive a naive
 * `includes`, which is why this parses.
 */
export function isDiscogsImage(url: string): boolean {
  if (url === '') return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'i.discogs.com'
  } catch {
    return false
  }
}

/** The URL if it is a Discogs image, else nothing — for a schema boundary. */
export function discogsImageOrNone(url: string | undefined): string {
  return url !== undefined && isDiscogsImage(url) ? url : ''
}
