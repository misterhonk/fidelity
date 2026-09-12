import { fail } from '../fail'

/**
 * Finding and checking a catalogue service, the hub's way (docs/16 §6).
 *
 * `/catalogue` on the app's own origin first — same origin is the one
 * arrangement that cannot fail for a reason outside the service — then the
 * bare origin, then a local one for whoever runs the build on their laptop.
 */
export async function discoverCatalogue(): Promise<{ url: string | null }> {
  const here = globalThis.location?.origin
  const tried = [
    ...(here ? [`${here}/catalogue`, here] : []),
    'http://localhost:8788',
    'http://127.0.0.1:8788',
  ]
  for (const base of tried) {
    try {
      const response = await fetch(`${base}/v1/catalogue/health`, {
        signal: AbortSignal.timeout(1500),
      })
      if (!response.ok) continue
      const body = (await response.json()) as { ok?: boolean }
      if (body.ok === true) return { url: base }
    } catch {
      // Refused, blocked or too slow — not this one.
    }
  }
  return { url: null }
}

export async function checkCatalogue(
  url: string,
): Promise<{ ok: boolean; build: string; releases: number }> {
  const base = url.trim().replace(/\/+$/, '')
  if (!base) throw fail('no-catalogue', 'catalogue: no url given')

  let response: Response
  try {
    response = await fetch(`${base}/v1/catalogue/health`, { signal: AbortSignal.timeout(5000) })
  } catch {
    const mixed = globalThis.location?.protocol === 'https:' && base.startsWith('http://')
    throw mixed
      ? fail('hub-mixed-content', 'catalogue: mixed content')
      : fail('hub-unreachable', 'catalogue: no answer')
  }
  if (!response.ok) {
    throw Object.assign(fail('hub-http-error', `catalogue: HTTP ${response.status}`), {
      status: response.status,
    })
  }
  const body = (await response.json()) as { ok?: boolean; build?: string; releases?: number }
  if (body.ok !== true || typeof body.build !== 'string') {
    throw fail('not-a-catalogue', 'not a fidelity catalogue')
  }
  return { ok: true, build: body.build, releases: body.releases ?? 0 }
}
