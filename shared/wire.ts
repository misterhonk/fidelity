import type { HorizonChunk, HorizonKind } from './types'

/**
 * How a horizon chunk crosses a network.
 *
 * The chunk is parallel TypedArrays — that is the whole reason 200.000 release
 * ids cost 800 KB instead of 9 MB (docs/03 §4) — and JSON has no way to carry
 * them. `JSON.stringify(new Int32Array([1,2]))` produces `{"0":1,"1":2}`, an
 * object keyed by index, which is both wrong on the way back and larger than
 * the array it replaced.
 *
 * So the arrays travel as base64 of their bytes. About a third larger than raw
 * over the wire and roughly a third the size of a JSON number list, with the
 * types preserved exactly.
 *
 * This lives in `shared/` because the hub and the client both have to agree on
 * it, and a format that exists twice is a format that will drift.
 */

export const WIRE_VERSION = 1

export interface WireChunk {
  version: number
  key: string
  kind: HorizonKind
  entityId: number
  name: string
  fetchedAt: number
  complete: boolean
  requests: number
  catalogueSize?: number
  catnoPrefix?: string
  /** base64 of the Int32Array bytes. */
  releaseIds: string
  roles: string
  years: string
  catnoNums?: string
}

function toBase64(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let binary = ''
  // Chunked, because String.fromCharCode(...spread) blows the call stack
  // somewhere around a hundred thousand arguments — and 200.000 ids is more.
  const STEP = 0x8000
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeChunk(chunk: HorizonChunk): WireChunk {
  return {
    version: WIRE_VERSION,
    key: chunk.key,
    kind: chunk.kind,
    entityId: chunk.entityId,
    name: chunk.name,
    fetchedAt: chunk.fetchedAt,
    complete: chunk.complete,
    requests: chunk.requests,
    ...(chunk.catalogueSize === undefined ? {} : { catalogueSize: chunk.catalogueSize }),
    ...(chunk.catnoPrefix === undefined ? {} : { catnoPrefix: chunk.catnoPrefix }),
    releaseIds: toBase64(chunk.releaseIds),
    roles: toBase64(chunk.roles),
    years: toBase64(chunk.years),
    ...(chunk.catnoNums === undefined ? {} : { catnoNums: toBase64(chunk.catnoNums) }),
  }
}

/**
 * Rebuilds a chunk from the wire.
 *
 * Copies rather than views the decoded bytes: `new Int32Array(buffer)` over a
 * base64 result would throw the moment the length is not a multiple of four,
 * and a truncated body should produce a rejected chunk, not a crash. The
 * lengths are checked by the caller's schema; this only has to be safe.
 */
export function decodeChunk(wire: WireChunk): HorizonChunk {
  const ids = fromBase64(wire.releaseIds)
  const roles = fromBase64(wire.roles)
  const years = fromBase64(wire.years)

  const chunk: HorizonChunk = {
    key: wire.key,
    kind: wire.kind,
    entityId: wire.entityId,
    name: wire.name,
    fetchedAt: wire.fetchedAt,
    complete: wire.complete,
    requests: wire.requests,
    releaseIds: new Int32Array(ids.buffer, ids.byteOffset, ids.byteLength >> 2),
    roles: new Uint8Array(roles),
    years: new Int16Array(years.buffer, years.byteOffset, years.byteLength >> 1),
  }

  if (wire.catalogueSize !== undefined) chunk.catalogueSize = wire.catalogueSize
  if (wire.catnoPrefix !== undefined) chunk.catnoPrefix = wire.catnoPrefix
  if (wire.catnoNums !== undefined) {
    const nums = fromBase64(wire.catnoNums)
    chunk.catnoNums = new Int32Array(nums.buffer, nums.byteOffset, nums.byteLength >> 2)
  }

  return chunk
}

/**
 * Whether a decoded chunk is internally consistent.
 *
 * The parallel arrays only mean anything if they are the same length — index
 * *i* of `roles` describes release *i*. A chunk that fails this is not a chunk
 * that needs repairing, it is one that must not be stored, whether it came
 * from a hub, a stale cache or a mangled request.
 */
export function chunkIsSound(chunk: HorizonChunk): boolean {
  const n = chunk.releaseIds.length
  if (chunk.roles.length !== n || chunk.years.length !== n) return false
  if (chunk.catnoNums !== undefined && chunk.catnoNums.length !== n) return false
  return chunk.key === `${chunk.kind}:${chunk.entityId}`
}
