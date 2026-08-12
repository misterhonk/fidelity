import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The keeper steps back when somebody has started something.
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
const syncState = {
  value: null as { collectionSyncedAt: number; collectionReadFullyAt?: number } | null,
}

const expireDigs = vi.fn()

vi.mock('~~/db/meta', () => ({ getSyncState: () => Promise.resolve(syncState.value) }))
vi.mock('~~/db/expire', () => ({ expireDigs }))
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
  expireDigs.mockReset().mockResolvedValue(0)
})

/**
 * The six-hour deadline, and the two excuses it does not accept.
 *
 * `expireDigs` was fully written and fully tested for months and called by
 * nothing outside its own test file, which is the failure mode these three
 * guard against: not "does the function work" — it always did — but "does
 * anything run it".
 *
 * Both cases below are the ones a plausible implementation gets wrong, because
 * both are checks the keeper already had and it would be natural to put the
 * new step after them. Signed out is the sharper of the two: somebody who
 * removed their token is exactly the person who thinks their data is gone.
 */
describe('the six-hour deadline', () => {
  it('runs for somebody who is signed out', async () => {
    expireDigs.mockResolvedValue(12)
    const result = await runKeeper({ client, username: null, now: NOW })

    expect(expireDigs).toHaveBeenCalledWith(undefined, NOW)
    expect(result.expired).toBe(12)
  })

  it('runs while a dig is in progress, because a deadline cannot be deferred', async () => {
    busy.value = true
    expireDigs.mockResolvedValue(7)
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.deferred).toBe(true)
    expect(result.expired).toBe(7)
  })

  it('reports nothing when nothing was old enough', async () => {
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.expired).toBe(0)
  })
})

describe('der Kurator', () => {
  it('does everything overdue when nothing else is running', async () => {
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.did).toEqual(['library', 'watch', 'horizon'])
    expect(result.stored).toBe(2)
    expect(result.alerts).toBe(1)
    expect(result.deferred).toBe(false)
  })

  it('does not start at all while something else is running', async () => {
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

  it('leaves the collection alone while it is fresh', async () => {
    syncState.value = { collectionSyncedAt: NOW - 60_000, collectionReadFullyAt: NOW - 60_000 }
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(syncLibrary).not.toHaveBeenCalled()
    expect(result.did).not.toContain('library')
  })

  /*
   * Coming back to the tab is where the gap usually opened — a record added on
   * the phone, a rating given on the website. Half an hour of "fresh" is the
   * right answer for a ticking clock and the wrong one for somebody who just
   * looked, and the delta costs one request when nothing changed.
   */
  it('looks again for somebody who has just come back', async () => {
    syncState.value = { collectionSyncedAt: NOW - 5 * 60_000, collectionReadFullyAt: NOW }
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW, eager: true })

    expect(syncLibrary).toHaveBeenCalled()
    expect(result.did).toContain('library')
  })

  it('still leaves it alone when it was read a minute ago', async () => {
    syncState.value = { collectionSyncedAt: NOW - 60_000, collectionReadFullyAt: NOW - 60_000 }
    await runKeeper({ client, username: 'mrtnmlchr', now: NOW, eager: true })

    expect(syncLibrary).not.toHaveBeenCalled()
  })

  it('fetches it anyway when somebody presses "Refresh everything"', async () => {
    syncState.value = { collectionSyncedAt: NOW - 60_000, collectionReadFullyAt: NOW }
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW, force: true })

    expect(syncLibrary).toHaveBeenCalled()
    expect(result.did).toContain('library')
    // And it reads *everything*: this is the button somebody presses because
    // the two have drifted, and a delta cannot see a changed rating.
    expect(syncLibrary).toHaveBeenCalledWith(expect.anything(), { full: true })
  })

  /*
   * Once a day, the whole list.
   *
   * The delta only ever sees additions — a rating given on the Discogs website
   * leaves `date_added` alone, and Discogs offers no modification date to ask
   * about. Reading everything is the only way to notice, so it happens on a
   * clock rather than only when somebody suspects something.
   */
  it('reads the whole collection when a day has passed', async () => {
    syncState.value = { collectionSyncedAt: NOW, collectionReadFullyAt: NOW - 25 * 3_600_000 }
    await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(syncLibrary).toHaveBeenCalledWith(expect.anything(), { full: true })
  })

  // Renamed from "does nothing without a sign-in", which stopped being true
  // when expiry moved in front of this check. It never spends a *request*
  // without one, which is what the test was actually about.
  it('spends no request without a sign-in', async () => {
    const result = await runKeeper({ client, username: null, now: NOW })

    expect(result.did).toEqual([])
    expect(syncLibrary).not.toHaveBeenCalled()
  })

  it('does not let one failure stop the rest', async () => {
    // Silent by design: the keeper is the one thing nobody asked for, so it is
    // the one thing that must never take a screen down.
    syncLibrary.mockRejectedValue(new Error('offline'))
    const result = await runKeeper({ client, username: 'mrtnmlchr', now: NOW })

    expect(result.did).toEqual(['watch', 'horizon'])
  })
})
