import type { Match, SignalType } from '#shared/types'

import {
  arrange,
  availableSignals,
  parseDensity,
  parseSignals,
  parseSort,
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
export function useDigView(matches: Ref<Match[]> | ComputedRef<Match[]>) {
  const route = useRoute()
  const router = useRouter()

  function param(name: string): string {
    const value = route.query[name]
    return typeof value === 'string' ? value : ''
  }

  const active = computed(() => parseSignals(param('sig'), matches.value))
  const sort = computed(() => parseSort(param('sort')))
  const density = computed(() => parseDensity(param('dicht')))
  const available = computed(() => availableSignals(matches.value))
  const visible = computed(() => arrange(matches.value, active.value, sort.value))

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

  const setSort = (key: SortKey) => apply({ sort: key === 'score' ? undefined : key })
  const setDensity = (value: Density) =>
    apply({ dicht: value === 'compact' ? 'kompakt' : undefined })
  const clear = () => apply({ sig: undefined })

  return { active, available, sort, density, visible, toggleSignal, setSort, setDensity, clear }
}
