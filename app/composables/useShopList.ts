import { ORIGIN_FILTERS, passesOrigin, readOrigin, type OriginFilter } from '#shared/countries'
import type { DealerReason, DealerWithReasons } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

/**
 * The shops list's own state (M34.4): where from, which order, which name,
 * how many rows are out, and which of them is open.
 *
 * Pulled out of the page so the list can be one component and the page can
 * still walk it with j and k. Everything here is derived from the rows the
 * page holds and the address the router holds; nothing here talks to the
 * worker.
 */

export const SHOP_SORTS = ['rate', 'recent', 'size', 'name'] as const
export type ShopSort = (typeof SHOP_SORTS)[number]

/** Rows come out a dozen at a time; the open one is always among them. */
const STEP = 12

/** The mental model, not a filter: yours, and the rest. */
const MINE: DealerReason[] = ['watched', 'order', 'manual', 'basket']
const isMine = (dealer: DealerWithReasons) =>
  dealer.reasons.some((reason) => MINE.includes(reason))

export function useShopList(
  dealers: Ref<DealerWithReasons[]>,
  home: Ref<string>,
  selected: Ref<string | null>,
) {
  const h = useDealerMessages()
  const route = useRoute()
  const router = useRouter()

  /* Where from, through the address (M20 #2). */
  const origin = computed(() => readOrigin(route.query.from))
  function originBy(key: OriginFilter) {
    void router.replace({ query: { ...route.query, from: key === 'any' ? undefined : key } })
  }

  /** How many shops each chip would keep — the count beside the word. */
  const originCounts = computed(
    () =>
      Object.fromEntries(
        ORIGIN_FILTERS.map((key) => [
          key,
          dealers.value.filter((dealer) => passesOrigin(dealer.shipsFrom, key, home.value))
            .length,
        ]),
      ) as Record<OriginFilter, number>,
  )

  const shown = computed(() =>
    dealers.value.filter((dealer) => passesOrigin(dealer.shipsFrom, origin.value, home.value)),
  )

  const query = ref('')
  const room = ref(STEP)
  const sort = ref<ShopSort>('rate')
  const sortOptions = computed(() =>
    SHOP_SORTS.map((key) => ({ key, label: h.value.sort[key] })),
  )

  const matching = computed(() => {
    const needle = query.value.trim().toLowerCase()
    if (!needle) return shown.value
    return shown.value.filter((dealer) =>
      `${dealer.displayName} ${dealer.username}`.toLowerCase().includes(needle),
    )
  })

  /* Ranked by hit rate by default: the only ordering that answers "where first?". */
  const ordered = computed(() => {
    const rows = [...matching.value]
    if (sort.value === 'recent')
      return rows.sort((a, b) => (b.lastScannedAt ?? 0) - (a.lastScannedAt ?? 0))
    if (sort.value === 'size') return rows.sort((a, b) => b.numForSale - a.numForSale)
    if (sort.value === 'name')
      return rows.sort((a, b) =>
        (a.displayName || a.username).localeCompare(b.displayName || b.username),
      )
    return rows
  })

  const listed = computed(() => {
    const head = ordered.value.slice(0, room.value)
    const open = ordered.value.find((dealer) => dealer.username === selected.value)
    return open && !head.includes(open) ? [...head, open] : head
  })

  const rest = computed(() => matching.value.length - listed.value.length)

  const groups = computed(() => {
    const mine = listed.value.filter(isMine)
    const others = listed.value.filter((dealer) => !isMine(dealer))
    if (mine.length === 0 || others.length === 0) return [{ key: null, rows: listed.value }]
    return [
      { key: 'mine' as const, rows: mine },
      { key: 'rest' as const, rows: others },
    ]
  })

  /** The strongest hit rate in the list, so the bars share one scale. */
  const peak = computed(() =>
    Math.max(0, ...matching.value.map((dealer) => dealer.affinity ?? 0)),
  )

  /** Where the open shop stands in the order — for j, k and the sheet's arrows. */
  const position = computed(() =>
    ordered.value.findIndex((dealer) => dealer.username === selected.value),
  )

  // A new search, order or origin starts from the top again.
  watch([query, origin, sort], () => (room.value = STEP))

  function more() {
    room.value += STEP
  }

  return reactive({
    origin,
    originBy,
    originCounts,
    shown,
    query,
    sort,
    sortOptions,
    matching,
    ordered,
    listed,
    rest,
    groups,
    peak,
    position,
    more,
  })
}

export type ShopListState = ReturnType<typeof useShopList>
