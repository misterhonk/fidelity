/**
 * Ein Händler, aus dem was jemand gerade in der Zwischenablage hat.
 *
 * The field asked for a username, which is the one form of a shop's identity
 * nobody is holding. You get to a shop by *being on its page* — so what is in
 * the clipboard is an address, and retyping the name out of it (getting the
 * underscore wrong, dropping the dot) was work the app was making somebody do.
 *
 * Every shape Discogs hands out leads to the same name:
 *
 *   discogs.com/user/430AM_Studio                      ← the canonical one
 *   discogs.com/seller/schoenwettermusik/profile
 *   discogs.com/seller/schoenwettermusik/mp?sort=listed
 *   www.discogs.com/de/seller/spirax.records/profile   ← locale segment
 *   discogs.com/sell/list?user=fatplastics             ← the name is a query
 *
 * The first is the `uri` the API itself reports for a user — verified against
 * three live profiles on 2026-08-10, including one whose name carries a dot.
 * The rest are the marketplace pages somebody is more likely to be standing on
 * when they copy an address; those are read from the site, not from the API,
 * so a new shape is possible and costs nothing but a fallthrough to "das ist
 * kein Händler".
 *
 * A listing address (`/sell/item/12345`) is deliberately *not* handled. The
 * seller is not in it — resolving one costs a request, and a field that
 * sometimes spends the rate limit on a keystroke is a field nobody can predict.
 */

/**
 * Was Discogs als Benutzernamen zulässt.
 *
 * Letters, digits, dot, underscore, hyphen — `spirax.records` and
 * `430AM_Studio` are both real shops. Deliberately not anchored to a length:
 * the app finds out whether the name exists by asking, and a client-side guess
 * about somebody else's username is a guess that will eventually be wrong.
 */
const USERNAME = /^[A-Za-z0-9._-]+$/

/**
 * Die Adresse einer Händler- oder Nutzerseite.
 *
 * The optional segment before `seller` is Discogs' locale prefix (`/de/`,
 * `/es/`, `/pt_BR/`) — a link copied from a translated page carries it, and
 * without this the whole address would fall through as "not a username" and
 * fail with a message about the wrong thing.
 */
const PROFILE_URL =
  /discogs\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?(?:seller|user)\/([^/?#]+)/i

/** The listing form, where the name rides in a query parameter instead. */
const SELL_LIST_URL =
  /discogs\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?sell\/list\?[^#]*\buser=([^&#]+)/i

/**
 * Der Händlername, oder null wenn daraus keiner zu machen ist.
 *
 * Returning null rather than the raw input, so the caller can say "das ist
 * kein Händler" instead of sending a URL to Discogs as if it were a name and
 * reporting whatever comes back.
 */
export function dealerFromInput(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  const fromUrl = trimmed.match(PROFILE_URL) ?? trimmed.match(SELL_LIST_URL)
  if (fromUrl?.[1]) {
    /*
     * Decoded, because a name with a dot or a hyphen survives a copy intact
     * but anything Discogs percent-encoded would otherwise reach the API
     * doubly encoded — `encodeURIComponent` runs again at the call site.
     */
    let name: string
    try {
      name = decodeURIComponent(fromUrl[1])
    } catch {
      // A stray percent sign is not an encoding. Take it as it stands.
      name = fromUrl[1]
    }
    return USERNAME.test(name) ? name : null
  }

  // Not an address at all: then it has to be a name already.
  if (trimmed.includes('/') || trimmed.includes(' ')) return null
  return USERNAME.test(trimmed) ? trimmed : null
}
