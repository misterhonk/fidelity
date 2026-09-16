import type { LandedContext, Match, SignalType } from '#shared/types'
import { landedPrice } from '#shared/shipping'

import {
  arrange,
  availableSignals,
  DEFAULT_DIRECTION,
  parseDensity,
  parseDirection,
  parseSignals,
  parseSort,
  parseUpTo,
  type Density,
  type SortKey,
} from '~/utils/digview'

/**
 * Filter, sort and density — kept in the URL, not in a ref.
 *
 * docs/05 §4 makes this a rule and it earns itself here: a dig is four minutes
 * of somebody's rate limit, so reloading the page must not silently throw away
 * the view they arranged on top of it. Back and forward work, and the link you
 * paste into your own notes still shows what you were looking at.
 *
 * This file is only the binding. Everything that can actually be wrong lives
 * in `~/utils/digview`, where it is a pure function and has tests.
 */
export function useDigView(
  matches: Ref<Match[]> | ComputedRef<Match[]>,
  landed: Ref<LandedContext | null> | null = null,
) {
  const route = useRoute()
  const router = useRouter()

  function param(name: string): string {
    const value = route.query[name]
    return typeof value === 'string' ? value : ''
  }

  const active = computed(() => parseSignals(param('sig'), matches.value))
  const sort = computed(() => parseSort(param('sort')))
  const direction = computed(() => parseDirection(param('dir'), sort.value))
  /*
   * `density`, or the `dicht` it was called until ADR-010 reached this
   * setting. The new key wins where both are somehow present.
   */
  const density = computed(() => parseDensity(param('density') || param('dicht')))
  const available = computed(() => availableSignals(matches.value))
  const query = computed(() => param('q'))
  const upTo = computed(() => parseUpTo(param('upto')))
  /** Whether this shop's postage is known at all — the list only offers the sort when it is. */
  const landedKnown = computed(() => (landed?.value?.tiers.length ?? 0) > 0)
  const visible = computed(() =>
    arrange(
      matches.value,
      active.value,
      sort.value,
      query.value,
      {
        of: (match) => landedPrice(match, landed?.value ?? null),
        upTo: landedKnown.value ? upTo.value : null,
      },
      direction.value,
    ),
  )

  function apply(next: Record<string, string | undefined>) {
    // Empty values are dropped rather than written as `?sig=`, so the default
    // view has a clean URL and "no filter" has exactly one representation.
    const query = Object.fromEntries(
      Object.entries({ ...route.query, ...next }).filter(([, value]) => Boolean(value)),
    )
    // replace, not push: arranging a view is not a navigation step, and one
    // back press should leave the dig rather than undo a chip.
    void router.replace({ query })
  }

  function toggleSignal(type: SignalType) {
    const set = new Set(active.value)
    if (!set.delete(type)) set.add(type)
    apply({ sig: [...set].join(',') })
  }

  /**
   * Picking a key takes its own direction; pressing the key again turns it.
   *
   * The same rule the shelf has had since M26, and the answer to "I want to
   * sort the price from cheap to expensive or the other way round" — which
   * until 2026-09-14 had no other way round at all, because the arrow was
   * baked into the label.
   *
   * The default direction is left out of the address, so the tidy URL stays
   * tidy and "cheapest first" has exactly one representation.
   */
  const setSort = (key: SortKey) => {
    const turned =
      sort.value === key && direction.value === DEFAULT_DIRECTION[key]
        ? DEFAULT_DIRECTION[key] === 'asc'
          ? 'desc'
          : 'asc'
        : DEFAULT_DIRECTION[key]
    apply({
      sort: key === 'score' ? undefined : key,
      dir: turned === DEFAULT_DIRECTION[key] ? undefined : turned,
    })
  }
  const setDensity = (value: Density) =>
    apply({
      density: value === 'comfortable' ? undefined : value,
      // And the old key goes, or an address carrying both would say two
      // things and the reader above would have to pick a winner for ever.
      dicht: undefined,
    })
  const setQuery = (value: string) => apply({ q: value.trim() || undefined })
  const setUpTo = (value: string) => {
    const amount = parseUpTo(value)
    apply({ upto: amount === null ? undefined : String(amount) })
  }
  const clear = () => apply({ sig: undefined, q: undefined, upto: undefined })

  return {
    active,
    available,
    sort,
    density,
    direction,
    query,
    upTo,
    landedKnown,
    visible,
    toggleSignal,
    setSort,
    setDensity,
    setQuery,
    setUpTo,
    clear,
  }
}
