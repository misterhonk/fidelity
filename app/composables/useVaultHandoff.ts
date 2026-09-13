import { readVaultFile } from '~/utils/vault-file'

/**
 * The vault as a file you carry yourself.
 *
 * `useVaultFile` keeps a `FileSystemFileHandle`, which is why the file has to
 * be chosen only once — and why WebKit has none of it. Safari has no File
 * System Access API, so on every browser on an iPhone, and in Safari on a Mac,
 * the one destination that would have used iCloud Drive is simply not offered
 * (`fileVaultAvailable`). Reported as "why is there no iCloud option?" — and
 * the honest answer is that it was never about iCloud.
 *
 * This is the same round without the handle: read a file somebody picked,
 * merge it, hand back a file to save. Two taps instead of none, and it works
 * in every browser there is — the download and `<input type="file">` are as
 * old as the web. Where the file is put is nobody's business: it is the same
 * ciphertext the automatic route writes, and the two are interchangeable.
 *
 * The passphrase and the merge stay in the worker, exactly as they do for the
 * automatic route. What crosses is a sealed block in each direction.
 */

/** The same name the picker suggests, so the two routes produce one file. */
export const VAULT_FILE_NAME = 'fidelity-tresor.json'

export function useVaultHandoff() {
  const { call } = useFidelityWorker()

  /**
   * One round: what the other device wrote, merged into this one.
   *
   * `null` for the file is the ordinary first run — the first device has
   * nothing to read and everything to write. An unreadable file is a different
   * matter and stops the round before the passphrase is even used, because
   * "I cannot read this" must never be carried out as "this is gone".
   */
  async function merge(passphrase: string, file: File | null) {
    const remote = file ? readVaultFile(await file.text()) : null
    return call('vault.merge', { passphrase, remote })
  }

  /**
   * Hands the sealed block to the browser as a download.
   *
   * `URL.createObjectURL` and a click, which is the one way to save a file
   * that works everywhere — iOS Safari included, where it lands in Files and
   * can be moved into iCloud Drive from there.
   */
  function save(sealed: unknown, name = VAULT_FILE_NAME): void {
    const blob = new Blob([JSON.stringify(sealed)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    try {
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.rel = 'noopener'
      link.click()
    } finally {
      // Freed on the next turn rather than at once: Safari has been measured
      // to abandon a download whose blob url was revoked in the same tick.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  return { merge, save }
}
