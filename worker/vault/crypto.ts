/**
 * What leaves the device is a block nobody else can read.
 *
 * This is the whole answer to "is that allowed": the question of who may see
 * the data stops mattering when the answer is nobody. A hub behind a tunnel,
 * a folder Dropbox synchronises, a Drive somebody else administers — all of
 * them hold ciphertext, and the key never goes anywhere.
 *
 * AES-GCM, because it authenticates as well as encrypts: a block somebody
 * tampered with fails to open rather than opening into nonsense.
 */

/**
 * PBKDF2 rounds.
 *
 * OWASP puts 600.000 at SHA-256 for password storage. This is a passphrase
 * somebody types once per device, so the cost is paid once — and the thing it
 * protects is a whole collection's worth of habits.
 */
export const KDF_ITERATIONS = 600_000

const SALT_BYTES = 16
const IV_BYTES = 12

/** Bumped when the format changes, so an old block still says what it is. */
export const VAULT_VERSION = 1

export interface SealedVault {
  version: number
  /** Base64. New for every write — reusing one with AES-GCM is the classic hole. */
  iv: string
  /** Base64. Kept with the block so a second device needs only the passphrase. */
  salt: string
  cipher: string
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(data: unknown, passphrase: string): Promise<SealedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt)

  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plain as BufferSource,
  )

  return {
    version: VAULT_VERSION,
    iv: toBase64(iv),
    salt: toBase64(salt),
    cipher: toBase64(new Uint8Array(cipher)),
  }
}

/**
 * Opens a block, or refuses.
 *
 * A wrong passphrase is indistinguishable from a tampered block, and both
 * throw — which is correct: neither is a state to carry on from.
 */
export async function open<T>(sealed: SealedVault, passphrase: string): Promise<T> {
  if (sealed.version > VAULT_VERSION) {
    throw new Error('Diese Sicherung stammt aus einer neueren Version von Fidelity.')
  }

  const key = await deriveKey(passphrase, fromBase64(sealed.salt))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) as BufferSource },
    key,
    fromBase64(sealed.cipher) as BufferSource,
  )

  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/*
 * Chunked, because `String.fromCharCode(...bytes)` on a megabyte-sized horizon
 * overflows the argument stack — the same trap shared/wire.ts documents.
 */
const CHUNK = 0x8000

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(out)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
