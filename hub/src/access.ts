import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto'

/**
 * Access keys — the hub's second door (docs/17 §3.2, §6.2).
 *
 * A key is a signed statement, not a row in a table: `fk1.<payload>.<sig>`,
 * where the payload is base64url JSON of `{ kid, sub, tier, iat, exp }` and
 * the signature is Ed25519 over the payload bytes. The hub verifies it with
 * the public key it was started with and needs no network and no database
 * of people to do so — it learns an opaque subject, a tier and two dates,
 * and nothing about who is on Discogs.
 *
 * Thirty-five days of validity, renewed by the access service while a plan
 * runs; cancelling means no renewal, and the key expires on its own.
 * Revocation is the small list for the exceptional case (chargeback,
 * abuse), keyed by `kid`, refreshed from the access service once an hour.
 *
 * Self-hosters never see any of this: a hub with a secret ignores keys, a
 * hub without a secret and without a public key is open, as today.
 */
export const KEY_PREFIX = 'fk1'
export const DEFAULT_VALID_DAYS = 35

export const TIERS = ['beta', 'seven', 'lp', 'double', 'first', 'test'] as const
export type Tier = (typeof TIERS)[number]

export interface KeyClaims {
  /** Key id, for the revocation list. */
  kid: string
  /** The payer, as an opaque id — never a Discogs name. */
  sub: string
  tier: Tier
  /** Seconds since the epoch, as JWTs do it. */
  iat: number
  exp: number
}

export type Verdict =
  | { ok: true; claims: KeyClaims }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'not-yet' | 'revoked' }

/* Ed25519 public keys travel as 32 raw bytes, base64url; Node wants SPKI DER. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

const b64url = {
  encode: (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64url'),
  decode: (text: string) => Buffer.from(text, 'base64url'),
}

export function publicKeyFrom(raw: string) {
  const bytes = b64url.decode(raw.trim())
  if (bytes.length !== 32) throw new Error('access: a public key is 32 bytes, base64url')
  return createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, bytes]),
    format: 'der',
    type: 'spki',
  })
}

/** A fresh pair: the public half for the hub's environment, the private half for the issuer. */
export function generateAccessKeyPair(): { publicKey: string; privateKeyPem: string } {
  const pair = generateKeyPairSync('ed25519')
  const spki = pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  return {
    publicKey: b64url.encode(spki.subarray(spki.length - 32)),
    privateKeyPem: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  }
}

export function parseKey(token: string): KeyClaims | null {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts[0] !== KEY_PREFIX) return null
  try {
    const claims = JSON.parse(b64url.decode(parts[1]!).toString('utf8')) as Partial<KeyClaims>
    if (
      typeof claims.kid !== 'string' ||
      !/^[a-f0-9]{8,32}$/.test(claims.kid) ||
      typeof claims.sub !== 'string' ||
      claims.sub.length === 0 ||
      claims.sub.length > 64 ||
      !TIERS.includes(claims.tier as Tier) ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp)
    ) {
      return null
    }
    return claims as KeyClaims
  } catch {
    return null
  }
}

export interface VerifyOptions {
  /** 32 raw bytes, base64url — what `generateAccessKeyPair` prints. */
  publicKey: string
  now?: () => number
  revoked?: ReadonlySet<string>
}

export function verifyKey(
  token: string,
  { publicKey, now = Date.now, revoked }: VerifyOptions,
): Verdict {
  const claims = parseKey(token)
  if (!claims) return { ok: false, reason: 'malformed' }
  const [, payload, signature] = token.trim().split('.') as [string, string, string]
  const sound = (() => {
    try {
      return verify(
        null,
        b64url.decode(payload),
        publicKeyFrom(publicKey),
        b64url.decode(signature),
      )
    } catch {
      return false
    }
  })()
  if (!sound) return { ok: false, reason: 'signature' }
  const seconds = Math.floor(now() / 1000)
  // A minute of slack for clocks; a key issued "in the future" is still a bug.
  if (claims.iat > seconds + 60) return { ok: false, reason: 'not-yet' }
  if (claims.exp <= seconds) return { ok: false, reason: 'expired' }
  if (revoked?.has(claims.kid)) return { ok: false, reason: 'revoked' }
  return { ok: true, claims }
}

export interface IssueOptions {
  privateKeyPem: string
  sub: string
  tier: Tier
  days?: number
  now?: () => number
  kid?: string
}

/** The issuer's half — the access service, or `scripts/access-keys.ts` for a beta key. */
export function issueKey({
  privateKeyPem,
  sub,
  tier,
  days = DEFAULT_VALID_DAYS,
  now = Date.now,
  kid,
}: IssueOptions): string {
  const iat = Math.floor(now() / 1000)
  const claims: KeyClaims = {
    kid: kid ?? Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex'),
    sub,
    tier,
    iat,
    exp: iat + days * 24 * 60 * 60,
  }
  const payload = b64url.encode(JSON.stringify(claims))
  const signature = sign(null, b64url.decode(payload), createPrivateKey(privateKeyPem))
  return `${KEY_PREFIX}.${payload}.${b64url.encode(signature)}`
}

/**
 * The revocation list: a few `kid`s from the access service, refreshed once
 * an hour, and what was known before if the service is down — a hub that
 * locks everybody out because one list did not load has the wrong default.
 */
export interface RevocationOptions {
  /** `HUB_ACCESS_URL`; the list is at `/v1/revoked` as `{ kids: [] }`. */
  url?: string | null
  /** Revoked by hand, comma-separated — the self-hoster's list. */
  fixed?: Iterable<string>
  fetchImpl?: typeof fetch
  ttlMs?: number
  now?: () => number
}

export function createRevocationList({
  url,
  fixed = [],
  fetchImpl = fetch,
  ttlMs = 60 * 60 * 1000,
  now = Date.now,
}: RevocationOptions) {
  const base = new Set(fixed)
  let fetched = new Set<string>()
  let fetchedAt = Number.NEGATIVE_INFINITY
  let inFlight: Promise<void> | null = null

  async function refresh(): Promise<void> {
    if (!url) return
    try {
      const response = await fetchImpl(`${url.replace(/\/+$/, '')}/v1/revoked`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) return
      const body = (await response.json()) as { kids?: unknown }
      if (Array.isArray(body.kids)) {
        fetched = new Set(body.kids.filter((kid): kid is string => typeof kid === 'string'))
        fetchedAt = now()
      }
    } catch {
      // The list from last time stands.
    }
  }

  return {
    async current(): Promise<ReadonlySet<string>> {
      if (url && now() - fetchedAt >= ttlMs) {
        inFlight ??= refresh().finally(() => (inFlight = null))
        await inFlight
      }
      return new Set([...base, ...fetched])
    },
  }
}

/**
 * A token bucket per key (docs/17 §3.2): the proxy limits per IP, and a key
 * shared across three devices behind three IPs still gets one ceiling.
 * 120 requests to start, 2 a second to refill — a horizon build spends far
 * fewer, and a script that does not gets 429 and a Retry-After.
 */
export function createKeyLimiter({ capacity = 120, perSecond = 2, now = Date.now } = {}) {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return {
    take(kid: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
      const at = now()
      const bucket = buckets.get(kid) ?? { tokens: capacity, at }
      bucket.tokens = Math.min(capacity, bucket.tokens + ((at - bucket.at) / 1000) * perSecond)
      bucket.at = at
      if (bucket.tokens < 1) {
        buckets.set(kid, bucket)
        return { ok: false, retryAfterSeconds: Math.ceil((1 - bucket.tokens) / perSecond) }
      }
      bucket.tokens -= 1
      buckets.set(kid, bucket)
      return { ok: true }
    },
  }
}
