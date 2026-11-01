/**
 * Whether the hub may start with the doors it was given.
 *
 * Until 2026-10-21 a hub with no secret and no access key ran open and said
 * so in one line of its log. `deploy/compose.cloud.yml` passes an empty
 * `HUB_SECRET` by default, Caddy publishes `/hub/*` on 443, and an operator
 * who forgot the one line in `.env` had a hub anybody on the internet could
 * fill, poison or point at the network behind it. Now an open hub is a
 * choice somebody writes down: `HUB_OPEN=1`.
 *
 * An empty `HUB_SECRET` is no secret. `?? null` let the empty string through
 * as one, which the middleware then read as "no door" — the same open hub,
 * by a different road.
 *
 * A short secret is no secret either (#206): the secret opens every route,
 * so a word a person chose is a word a script can try. 32 characters is the
 * floor; `openssl rand -base64 32` prints 44.
 */
export const MIN_SECRET_LENGTH = 32

export function hubDoors(env: Record<string, string | undefined>): {
  secret: string | null
  open: boolean
  refusal: string | null
} {
  const secret = env.HUB_SECRET?.trim() || null
  const hasKey = Boolean(env.HUB_ACCESS_PUBLIC_KEY?.trim())
  const open = !secret && !hasKey
  const allowed = env.HUB_OPEN === '1'
  return {
    secret,
    open,
    refusal:
      secret && secret.length < MIN_SECRET_LENGTH
        ? `HUB_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. ` +
          'Make one with: openssl rand -base64 32'
        : open && !allowed
          ? 'No door: set HUB_SECRET (or HUB_ACCESS_PUBLIC_KEY). ' +
            'To run an open hub on purpose, inside a home network only, set HUB_OPEN=1.'
          : null,
  }
}
