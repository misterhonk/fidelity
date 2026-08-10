/**
 * Cover für alles, was gerade auf dem Schirm ist.
 *
 * The marketplace does not hand them over — every one of 1.200 inventory rows
 * measured on 2026-08-10 came back with an empty `release.thumbnail`, so a dig
 * produces matches with no picture and the app drew grey squares for them.
 * This is the other half of the fix: the store in `db/covers.ts` holds what is
 * known, and a screen asks here for the rest.
 *
 * One map for the whole app, like the verdicts. The same release shows up in a
 * dig, in the basket and on the watchlist, and each place fetching its own copy
 * would spend the request budget several times over for one picture.
 */
const covers = shallowRef<Record<number, { thumbUrl: string; coverUrl: string }>>({})

/**
 * Was schon angefragt wurde — auch das, was nichts ergab.
 *
 * Without this a list that re-renders (a filter, a sort, a scroll) would ask
 * again for every release it already asked about. The worker would answer from
 * the store and cost nothing, but a release Discogs has no picture for would
 * queue a request on every pass forever.
 */
const asked = new Set<number>()

/** Only one fetch in flight, so a fast scroll cannot start twenty of them. */
let inFlight: Promise<void> | null = null

/**
 * Wie viele Cover ein Besuch höchstens kosten darf.
 *
 * Each one is a request, and a dig of four hundred matches scrolled to the end
 * would be four hundred of them — eight minutes of somebody's rate limit spent
 * on decoration, in front of whatever they actually wanted to do next. A
 * hundred and twenty is about ten screens of cards, which is more than anyone
 * scrolls in one sitting; past that the covers already stored still show and
 * the rest stay placeholders until the next visit.
 *
 * Not a cache size — the store keeps everything it ever learned. This only
 * bounds what one page visit is allowed to *ask for*.
 */
const SESSION_BUDGET = 120
let spent = 0

/** One observer for the whole app, and what each watched element stands for. */
let observer: IntersectionObserver | null = null
const watched = new WeakMap<Element, number>()

export function useCovers() {
  const { call } = useFidelityWorker()

  /** What is on hand right now — for a template, without waiting. */
  function coverFor(releaseId: number, fallback?: string | null) {
    const known = covers.value[releaseId]
    if (known?.thumbUrl) return known
    return fallback ? { thumbUrl: fallback, coverUrl: '' } : null
  }

  function remember(entries: Record<number, { thumbUrl: string; coverUrl: string }>) {
    if (Object.keys(entries).length === 0) return
    covers.value = { ...covers.value, ...entries }
  }

  /**
   * Sagt, was auf dem Schirm ist — der Rest ergibt sich.
   *
   * Reads the store first and only then spends requests, because the
   * collection sync has already paid for a few thousand of these. `fetch:
   * false` is for screens that must not cost anything: the offline in-store
   * screen shows what it has and asks for nothing.
   */
  async function request(releaseIds: number[], options: { fetch?: boolean } = {}) {
    const fresh = releaseIds.filter((id) => id > 0 && !asked.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) asked.add(id)

    remember(await call('covers.known', { releaseIds: fresh }))
    if (options.fetch === false) return

    // Math.max, because a negative end index counts from the back — a spent
    // budget would have quietly kept fetching all but the last few.
    const room = Math.max(0, SESSION_BUDGET - spent)
    const missing = fresh.filter((id) => !covers.value[id]).slice(0, room)
    if (missing.length === 0) return
    spent += missing.length

    /*
     * Queued rather than parallel. The pacer serialises the requests anyway,
     * but a second call would sit in front of whatever the user does next —
     * and a cover must never be the reason a dig feels stuck.
     */
    const run = async () => {
      await inFlight
      try {
        remember(await call('covers.fetch', { releaseIds: missing }))
      } catch {
        /*
         * Decoration may not take a screen down. A rate limit, a 404, an
         * offline device — the placeholder stays and nothing else notices.
         * The ids stay in `asked`, so a failed batch is not retried on every
         * re-render; a reload is what tries again.
         */
      }
    }

    inFlight = run()
    await inFlight
  }

  /**
   * Ein Cover holen, sobald die Kachel ins Bild kommt.
   *
   * The alternative was for the list to guess: hand it every match and let a
   * budget stop the bleeding. That fetches pictures for rows nobody scrolled
   * to, in whatever order the array happens to be in. One shared observer asks
   * for exactly what somebody is looking at, in the order they look at it, and
   * costs one observer for the whole app rather than one per card.
   *
   * `rootMargin` runs ahead by a screen, because a request takes 1,2 s and an
   * image that starts loading when it is already visible has arrived too late.
   */
  function watchCover(element: Element | null, releaseId: number) {
    if (!element || releaseId <= 0 || asked.has(releaseId)) return
    if (typeof IntersectionObserver === 'undefined') {
      void request([releaseId])
      return
    }

    observer ??= new IntersectionObserver(
      (entries) => {
        const seen: number[] = []
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = watched.get(entry.target)
          if (id === undefined) continue
          seen.push(id)
          observer?.unobserve(entry.target)
          watched.delete(entry.target)
        }
        if (seen.length > 0) void request(seen)
      },
      { rootMargin: '600px' },
    )

    watched.set(element, releaseId)
    observer.observe(element)
  }

  return { covers, coverFor, request, watchCover }
}
