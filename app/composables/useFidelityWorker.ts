import {
  isWorkerOutbound,
  type ParamsOf,
  type ProgressOf,
  type RequestKind,
  type ResultOf,
  type WorkerError,
} from '#shared/protocol'

export class WorkerRequestError extends Error {
  readonly code: WorkerError['code']

  constructor(error: WorkerError) {
    super(error.message)
    this.name = 'WorkerRequestError'
    this.code = error.code
  }
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  onProgress?: (progress: unknown) => void
}

let worker: Worker | undefined
const pending = new Map<string, Pending>()

function ensureWorker(): Worker {
  if (worker) return worker

  // Vite turns this into its own chunk. The specifier has to be a literal
  // `new URL(..., import.meta.url)` — an alias here would not be analysable.
  worker = new Worker(new URL('../../worker/index.ts', import.meta.url), { type: 'module' })

  worker.addEventListener('message', (event: MessageEvent) => {
    const message: unknown = event.data
    if (!isWorkerOutbound(message)) return

    const entry = pending.get(message.id)
    if (!entry) return

    if (message.type === 'progress') {
      entry.onProgress?.(message.progress)
      return
    }

    pending.delete(message.id)
    if (message.type === 'error') {
      entry.reject(new WorkerRequestError(message.error))
    } else {
      entry.resolve(message.result)
    }
  })

  worker.addEventListener('error', (event) => {
    // The worker died. Nothing in flight can still be answered.
    for (const [, entry] of pending) {
      entry.reject(new WorkerRequestError({ message: event.message || 'worker crashed' }))
    }
    pending.clear()
  })

  return worker
}

export interface RequestOptions<K extends RequestKind> {
  onProgress?: (progress: ProgressOf<K>) => void
  signal?: AbortSignal
}

/**
 * Sends one request to the worker and resolves with its result. Progress
 * arrives through `onProgress` — a dig runs for minutes and has to report
 * while it runs, not only when it is done.
 */
export function callWorker<K extends RequestKind>(
  kind: K,
  params: ParamsOf<K>,
  options: RequestOptions<K> = {},
): Promise<ResultOf<K>> {
  const instance = ensureWorker()
  const id = crypto.randomUUID()

  return new Promise<ResultOf<K>>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      onProgress: options.onProgress as ((progress: unknown) => void) | undefined,
    })

    options.signal?.addEventListener(
      'abort',
      () => instance.postMessage({ id, kind: '$cancel' }),
      { once: true },
    )

    instance.postMessage({ id, kind, params })
  })
}

/** Drops the worker and fails everything still in flight. Used on sign-out. */
export function terminateWorker(): void {
  worker?.terminate()
  worker = undefined
  for (const [, entry] of pending) {
    entry.reject(new WorkerRequestError({ message: 'worker terminated', code: 'cancelled' }))
  }
  pending.clear()
}

export function useFidelityWorker() {
  return { call: callWorker, terminate: terminateWorker }
}
