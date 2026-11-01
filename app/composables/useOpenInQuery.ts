import { ref, watch, type Ref } from 'vue'

/** A numeric id from the address, or nothing — `?record=abc` opens no sheet. */
export const asId = (raw: string): number | null => (/^\d+$/.test(raw) ? Number(raw) : null)

/**
 * Which record a page's sheet shows, kept in the address (#227).
 *
 * The same bookkeeping `app.vue` does for `?find=` (M31.23), for the sheets a
 * page owns: opening pushes a history entry so **Back closes the sheet**,
 * stepping to a neighbour replaces it, and closing goes back where this page
 * pushed and replaces where it did not — a reload landing on the parameter has
 * nothing to go back to, and `back()` there would leave the app.
 */
export function useOpenInQuery<T extends string | number>(
  key: string,
  parse: (raw: string) => T | null,
): Ref<T | null> {
  const route = useRoute()
  const router = useRouter()

  const read = (): T | null => {
    const raw = route.query[key]
    return typeof raw === 'string' && raw ? parse(raw) : null
  }

  const open = ref(read()) as Ref<T | null>
  /** Whether the entry now in the history bar is one this page pushed. */
  let pushed = false

  watch(open, (now, before) => {
    if (now === read()) return
    const query = { ...route.query, [key]: now === null ? undefined : String(now) }
    if (now !== null && before !== null) void router.replace({ query })
    else if (now !== null) {
      pushed = true
      void router.push({ query })
    } else if (pushed) {
      pushed = false
      router.back()
    } else void router.replace({ query })
  })

  watch(
    () => route.query[key],
    () => {
      const has = read()
      if (has === open.value) return
      // Back, or a guard changed the address underneath us.
      if (has === null) pushed = false
      open.value = has
    },
  )

  return open
}
