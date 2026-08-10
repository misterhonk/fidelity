import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Der Kurator tritt zurück, wenn jemand etwas angestoßen hat.
 *
 * This is the property the whole design rests on. The pacer is one lane and
 * first-come-first-served (CLAUDE.md rule 3), so a keeper that starts a job
 * while a dig is running puts its requests in front of the dig — and the dig,
 * which somebody is watching a progress bar for, silently gets slower with no
 * explanation on screen.
 */
const busy = { value: false }

vi.mock('~~/worker/busy', () => ({
  isForegroundBusy: () => busy.value,
  trackForeground: <T>(task: () => Promise<T>) => task(),
}))

const syncLibrary = vi.fn()
const checkWatched = vi.fn()
const revalidateHorizon = vi.fn()
const syncState = { value: null as { collectionSyncedAt: number } | null }

vi.mock('~~/db/meta', () => ({ getSyncState: () => Promise.resolve(syncState.value) }))
vi.mock('~~/worker/sync/library', () => ({ syncLibrary }))
vi.mock('~~/worker/watch/check', () => ({ checkWatched }))
vi.mock('~~/worker/horizon/build', () => ({ revalidateHorizon }))

const { runKeeper } = await import('~~/worker/keeper')

const client = {} as never
const NOW = 1_760_000_000_000

beforeEach(() => {
  busy.value = false
  syncState.value = null
  syncLibrary.mockReset().mockResolvedValue({
    collection: { stored: 2, requests: 1, total: 2 },
    wantlist: { stored: 0, requests: 1, total: 0 },
  })
  checkWatched.mockReset().mockResolvedValue({ checked: 1, alerts: [{ dealer: 'x' }] })
  revalidateHorizon.mockReset().mockResolvedValue({ expanded: 3 })
})

describe('der Kurator', () => {
  it('erledigt alles Überfällige, wenn nichts anderes läuft', async () => {
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.did).toEqual(['library', 'watch', 'horizon'])
    expect(result.stored).toBe(2)
    expect(result.alerts).toBe(1)
    expect(result.deferred).toBe(false)
  })

  it('fängt gar nicht erst an, solange etwas anderes läuft', async () => {
    busy.value = true
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.deferred).toBe(true)
    expect(result.did).toEqual([])
    expect(syncLibrary).not.toHaveBeenCalled()
    expect(checkWatched).not.toHaveBeenCalled()
    expect(revalidateHorizon).not.toHaveBeenCalled()
  })

  it('bricht ab, sobald zwischendurch etwas anderes startet', async () => {
    // The realistic case: somebody hits "Dig starten" while the library delta
    // is still in flight. What has begun finishes; nothing further begins.
    syncLibrary.mockImplementation(async () => {
      busy.value = true
      return { collection: { stored: 0 }, wantlist: { stored: 0 } }
    })

    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.did).toEqual(['library'])
    expect(checkWatched).not.toHaveBeenCalled()
    expect(revalidateHorizon).not.toHaveBeenCalled()
  })

  it('lässt die Sammlung in Ruhe, solange sie frisch ist', async () => {
    syncState.value = { collectionSyncedAt: NOW - 60_000 }
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(syncLibrary).not.toHaveBeenCalled()
    expect(result.did).not.toContain('library')
  })

  it('holt sie trotzdem, wenn jemand „Alles auffrischen" drückt', async () => {
    syncState.value = { collectionSyncedAt: NOW - 60_000 }
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW, force: true })

    expect(syncLibrary).toHaveBeenCalled()
    expect(result.did).toContain('library')
  })

  it('tut nichts ohne Anmeldung', async () => {
    const result = await runKeeper({ client, username: null, now: NOW })

    expect(result.did).toEqual([])
    expect(syncLibrary).not.toHaveBeenCalled()
  })

  it('lässt einen Fehler nicht den Rest verhindern', async () => {
    // Silent by design: the keeper is the one thing nobody asked for, so it is
    // the one thing that must never take a screen down.
    syncLibrary.mockRejectedValue(new Error('offline'))
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.did).toEqual(['watch', 'horizon'])
  })
})
