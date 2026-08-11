import { openFidelityDb } from '~~/db/open'
import { useMessages } from '~/composables/useMessages'

/**
 * The vault as a file somebody else's client synchronises.
 *
 * You pick a file once — inside iCloud Drive, Dropbox, Google Drive, a network
 * share, wherever — and their own desktop client carries it between machines.
 * Fidelity never talks to any of them, registers with none of them, and needs
 * no account anywhere. What it writes is ciphertext, so the folder could be
 * public and it would still be nobody's business.
 *
 * This lives on the main thread and not in the worker, and that is not
 * arbitrary: `showSaveFilePicker` needs a user gesture, and a worker has none.
 * The handle it returns survives structured clone, so IndexedDB keeps it and
 * the file is chosen once rather than every time.
 *
 * The passphrase and the merge stay in the worker. What crosses between them
 * is a sealed block in each direction.
 */

/** WebKit has none of this, which is every browser on an iPhone. */
export function fileVaultAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

/** Narrowed once, so the rest reads as if the API were simply there. */
function picker(): NonNullable<Window['showSaveFilePicker']> {
  const fn = window.showSaveFilePicker
  if (!fn) throw new Error(useMessages().value.error.noFilePicker)
  return fn.bind(window)
}

async function storedHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openFidelityDb()
  const row = await db.get('meta', 'vaultFile')
  return (row?.value as FileSystemFileHandle | undefined) ?? null
}

/**
 * Permission does not always survive a restart, and only a click can restore
 * it — which is why every call here happens from a handler, never on load.
 */
async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const options = { mode: 'readwrite' } as const
  if ((await handle.queryPermission?.(options)) === 'granted') return true
  return (await handle.requestPermission?.(options)) === 'granted'
}

export function useVaultFile() {
  const { call } = useFidelityWorker()

  /** Asks for the file once and remembers it. */
  async function choose(): Promise<string> {
    const handle = await picker()({
      suggestedName: 'fidelity-tresor.json',
      types: [
        {
          description: 'Fidelity-Tresor',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })

    const db = await openFidelityDb()
    await db.put('meta', { key: 'vaultFile', value: handle })
    return handle.name
  }

  async function chosenName(): Promise<string | null> {
    return (await storedHandle())?.name ?? null
  }

  /**
   * One round: read the file, hand it to the worker, write back what comes out.
   *
   * A file that does not exist yet, or is empty, is the normal first run — not
   * an error. A file with something unreadable in it is a different matter and
   * stops the round, because writing over it would turn "I cannot read this"
   * into "this is gone".
   */
  async function sync(passphrase: string) {
    const handle = await storedHandle()
    if (!handle) throw new Error(useMessages().value.error.noFileChosen)

    if (!(await ensurePermission(handle))) {
      throw new Error('Der Browser hat den Zugriff auf die Datei nicht erlaubt.')
    }

    const file = await handle.getFile()
    const remote = readVaultFile(file.size > 0 ? await file.text() : '')

    const report = await call('vault.merge', { passphrase, remote })

    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(report.sealed))
    await writable.close()

    return report
  }

  return { available: fileVaultAvailable, choose, chosenName, sync }
}
