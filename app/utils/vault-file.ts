import { useMessages } from '~/composables/useMessages'
/**
 * What a file has to say before anything is written over it.
 *
 * The failure this exists to prevent: a file that cannot be read is not an
 * empty file. Treating it as one would turn "I cannot read this" into "this is
 * gone" — and the thing being overwritten is the only copy of somebody's
 * shortlist that another device has.
 *
 * Empty is different and is the normal first run: a file just created by the
 * picker has nothing in it, and that is not an error.
 */
export function readVaultFile(text: string): unknown | null {
  if (text.trim().length === 0) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(useMessages().value.error.fileUnreadable)
  }

  // The envelope, checked before the passphrase is even asked for. Somebody
  // who picked the wrong file should hear that, not "wrong passphrase".
  const sealed = parsed as Record<string, unknown> | null
  const looksSealed =
    sealed !== null &&
    typeof sealed === 'object' &&
    typeof sealed.version === 'number' &&
    typeof sealed.iv === 'string' &&
    typeof sealed.salt === 'string' &&
    typeof sealed.cipher === 'string'

  if (!looksSealed) throw new Error('Diese Datei ist kein Fidelity-Tresor.')
  return parsed
}
