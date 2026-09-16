<script setup lang="ts">
import type { HorizonStatus } from '#shared/protocol'
import {
  WANT_MOST,
  type WantedRecord,
  type WantlistItem,
  type WantlistOverview,
  type WantPlan,
} from '#shared/types'
import { ORIGIN_FILTERS, readOrigin, type OriginFilter } from '#shared/countries'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
useSeoMeta({
  title: () => c.value.tabs.wantlist,
  description: () => c.value.wantlist.description,
})

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const overview = shallowRef<WantlistOverview | null>(null)
/** Whether the horizon is built — the first sentence explains it once while it is not (M28 #5). */
const horizon = shallowRef<HorizonStatus | null>(null)
const horizonMissing = computed(
  () => horizon.value !== null && horizon.value.expanded < horizon.value.entities,
)
/** Your wants across the shops scanned inside the six hours (M19 #9). */
const plan = shallowRef<WantPlan | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)
const query = ref('')

const route = useRoute()

onMounted(async () => {
  try {
    overview.value = await call('collection.wantlist', undefined)
    plan.value = await call('wantlist.plan', { from: origin.value })
    horizon.value = await call('horizon.status', undefined)
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }

  /*
   * Scroll to the row somebody came for, once it exists.
   *
   * The browser handles `#want-123` on its own only if the element is in the
   * document when the address arrives — and here it never is: the list comes
   * out of IndexedDB a moment later. Coming from a cover on the start screen
   * therefore landed at the top of twenty-three records, which reads as "that
   * tap did nothing" (seen 2026-08-13).
   */
  if (!route.hash) return
  // A pressing folded under its album is unfolded first, or there is nothing to land on.
  const wanted = Number(route.hash.replace('#want-', ''))
  const group = groups.value.find((g) => g.members.some((m) => m.releaseId === wanted))
  if (group && group.lead.releaseId !== wanted) toggleGroup(group.lead.masterId)
  await nextTick()
  document.querySelector(route.hash)?.scrollIntoView({ block: 'start' })
})

/*
 * The note, edited where it is read.
 *
 * No separate screen and no edit mode: a wantlist note is one line, and the
 * moment it is worth writing is the moment you are looking at the record it
 * belongs to. Written on blur rather than on every keystroke — the outbox
 * collapses repeats anyway, but a request per letter would be absurd.
 */
async function note(record: WantedRecord, text: string) {
  if (text === record.note) return
  await call('wantlist.note', { releaseId: record.releaseId, note: text, want: record.want })
  overview.value = await call('collection.wantlist', undefined)
}

/*
 * How much you want it (M20 #1).
 *
 * Five buttons, like the shelf's rating: one tap on the star you mean, and
 * the lit one taken back is "never said" again. Note and priority travel to
 * Discogs together — the endpoint replaces both, so the note goes along
 * unchanged rather than being cleared by accident.
 */
const STARS = [1, 2, 3, 4, 5] as const

async function want(record: WantedRecord, stars: number) {
  const next = record.want === stars ? 0 : stars
  await call('wantlist.note', { releaseId: record.releaseId, note: record.note, want: next })
  overview.value = await call('collection.wantlist', undefined)
}

/** Longest wanted, or the ones you want most first — in the address. */
const sort = computed(() => (route.query.sort === 'want' ? 'want' : 'waiting'))
const router = useRouter()

/** "Only from Germany / the EU" on the plan (M20 #2), in the address too. */
const origin = computed(() => readOrigin(route.query.from))
function originBy(key: OriginFilter) {
  void router.replace({ query: { ...route.query, from: key === 'any' ? undefined : key } })
}
watch(origin, async (from) => {
  try {
    plan.value = await call('wantlist.plan', { from })
  } catch (cause) {
    error.value = cause
  }
})
function sortBy(key: 'waiting' | 'want') {
  void router.replace({
    query: { ...route.query, sort: key === 'want' ? 'want' : undefined },
  })
}

async function drop(releaseId: number) {
  if (!(await call('wantlist.remove', { releaseId }))) return
  // Re-read rather than splice: the overview carries counts that a removed
  // row changes, and a list whose header disagrees with its body is worse
  // than one that takes a moment.
  overview.value = await call('collection.wantlist', undefined)
}

/**
 * How many rows are really in the document.
 *
 * The data comes out of IndexedDB in one go — that is cheap and stays so. What
 * is expensive is the *drawing*: every row carries a cover, and a wantlist of
 * five hundred entries is five hundred images a phone creates all at once on
 * first sight. The shelf has always done it this way; here it was missing.
 */
const shown = ref(60)
const STEP = 120

const records = computed(() => {
  const stored = overview.value?.records ?? []
  // The overview arrives longest-wanted-first; "wanted most" is a stable
  // re-sort on top of that, so equal priorities keep their queue order.
  const all = sort.value === 'want' ? [...stored].sort((a, b) => b.want - a.want) : stored
  const needle = query.value.trim().toLowerCase()
  if (!needle) return all

  const words = needle.split(/\s+/).filter(Boolean)
  return all.filter((record) => {
    const haystack = `${record.artist} ${record.title}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
})

/**
 * And how much of it gets drawn.
 *
 * A new filter starts at the top — otherwise somebody searches for "Aphex",
 * gets three hits and a "show 120 more" button with nothing more to show.
 */
/**
 * One sleeve per album (M28 #2). A want at Discogs is a pressing; four
 * wants for four pressings of "Sonar System" are one record somebody is
 * looking for. Rows with a master fold under the first of them in queue
 * order; the pressings unfold on tap. A want without a master stands alone.
 */
interface WantGroup {
  lead: WantedRecord
  members: WantedRecord[]
}
const groups = computed<WantGroup[]>(() => {
  const byMaster = new Map<number, WantGroup>()
  const out: WantGroup[] = []
  for (const record of records.value) {
    const known = record.masterId > 0 ? byMaster.get(record.masterId) : undefined
    if (known) {
      known.members.push(record)
      continue
    }
    const group = { lead: record, members: [record] }
    if (record.masterId > 0) byMaster.set(record.masterId, group)
    out.push(group)
  }
  return out
})
/**
 * The note as text, or one word until there is one (M28 #1): sixteen empty
 * fields down a page shout for attention none of them has earned. A tap
 * opens the field; it closes again with the note standing as text.
 */
const noting = ref(new Set<number>())
function openNote(releaseId: number) {
  noting.value = new Set([...noting.value, releaseId])
}
function closeNote(releaseId: number) {
  const next = new Set(noting.value)
  next.delete(releaseId)
  noting.value = next
}

const expanded = ref(new Set<number>())
function toggleGroup(masterId: number) {
  const next = new Set(expanded.value)
  if (next.has(masterId)) next.delete(masterId)
  else next.add(masterId)
  expanded.value = next
}

const visible = computed(() => groups.value.slice(0, shown.value))

/*
 * Which wanted record is open, and the list it can be walked with (M31.21).
 *
 * The lead of each group, in the order the grid shows them — the same rule
 * every other walk follows: "the list" is what is on the screen.
 */
const open = ref<number | null>(null)
const openRecord = computed(
  () => visible.value.find((group) => group.lead.releaseId === open.value)?.lead ?? null,
)
const walk = computed(() => {
  const ids = visible.value.map((group) => group.lead.releaseId)
  const at = open.value
  if (at === null) return null
  const index = ids.indexOf(at)
  if (index < 0) return null
  return {
    index,
    total: ids.length,
    previous: ids[index - 1] ?? null,
    next: ids[index + 1] ?? null,
  }
})
const rest = computed(() => groups.value.length - visible.value.length)

/**
 * Selecting several, and the one thing worth doing to an armful (M27).
 *
 * The shelf has had this since M27.5 and the wantlist never did, so the way
 * off a list that goes stale faster than any other — you buy a record and it
 * is still on it — was one sheet per record. Same control, same words; what
 * differs is the action, because a want has no place to be put into. There is
 * exactly one that makes sense on twelve at a time, and it is taking them off.
 *
 * The tick is on the **group**, because a folded row is an album: ticking it
 * means all four pressings of "Sonar System", and the button counts wants
 * rather than sleeves so it cannot promise nine and remove fourteen (M28 #4).
 */
const selecting = ref(false)
const selected = ref(new Set<number>())
/**
 * The way back. `records` is null once there is nothing left to undo — the
 * line then still says what happened, which is the only moment it is worth
 * saying that anything was asked for again at Discogs.
 */
const last = shallowRef<{ line: string; records: WantlistItem[] | null } | null>(null)

const chosen = computed(() => groups.value.filter((g) => selected.value.has(g.lead.releaseId)))
/** Wants, not rows: a folded album counts for every pressing under it. */
const chosenWants = computed(() => chosen.value.reduce((n, g) => n + g.members.length, 0))

function toggleSelect(releaseId: number) {
  const next = new Set(selected.value)
  if (next.has(releaseId)) next.delete(releaseId)
  else next.add(releaseId)
  selected.value = next
}
/** "All" means the whole answer, not the sixty that happen to be drawn (M28 #4). */
function selectAll() {
  selected.value = new Set(groups.value.map((g) => g.lead.releaseId))
}
function stopSelecting() {
  selecting.value = false
  selected.value = new Set()
}

async function dropSelected() {
  const releaseIds = chosen.value.flatMap((g) => g.members.map((m) => m.releaseId))
  if (releaseIds.length === 0) return

  const records = await call('wantlist.removeMany', { releaseIds })
  stopSelecting()
  overview.value = await call('collection.wantlist', undefined)
  last.value = { line: c.value.wantlist.select.dropped(count(records.length)), records }
}

async function undo() {
  const records = last.value?.records
  if (!records) return

  const resent = await call('wantlist.restore', { records })
  overview.value = await call('collection.wantlist', undefined)
  /*
   * Usually nothing was resent: the removal was still sitting in the outbox
   * and undoing it dropped the job, so Discogs never heard about it. Where it
   * had already drained, the records are on their way back and saying so is
   * the difference between a silent wait and an explained one.
   */
  last.value =
    resent > 0
      ? { line: c.value.wantlist.select.backAtDiscogs(count(resent)), records: null }
      : null
}

watch(query, () => {
  shown.value = 60
  /*
   * And the selection goes with it.
   *
   * A tick on a row the filter has since hidden is a promise nobody can check
   * — the count would move on its own and the button would remove records
   * that are not on the screen. That is the failure M28 #4 named from the
   * other side, and clearing is the honest half of it: the undo line makes a
   * cleared selection cheap, an invisible one is never cheap.
   */
  selected.value = new Set()
})

/**
 * How long it has been on the list, which is the thing that stings.
 *
 * Written out here rather than left to `Intl.RelativeTimeFormat` because the
 * unit is the point: "since 2019" says something "6 years ago" does not, and
 * a wantlist is read for exactly that sting.
 */
function waiting(addedAt: string): string | null {
  const added = Date.parse(addedAt)
  if (!Number.isFinite(added)) return null
  return waitingFor(Math.floor((Date.now() - added) / 86_400_000))
}
</script>

<template>
  <AppPage>
    <PageHeader :title="c.title">
      <template #tabs><CollectionTabs /></template>
    </PageHeader>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ c.loading }}</p>

    <p v-else-if="!overview || overview.total === 0" class="text-fid-base text-fid-text-muted">
      {{ c.wantlist.empty }}
      <NuxtLink
        class="fid-action text-fid-text underline underline-offset-4"
        to="/settings/collection"
        >{{ c.wantlist.emptyAction }}</NuxtLink
      >
    </p>

    <template v-else>
      <p class="text-fid-base text-fid-text-muted">
        <template v-if="horizonMissing">
          {{ c.wantlist.leadNoHorizon(count(overview.total)) }}
          <NuxtLink
            class="fid-action text-fid-text underline underline-offset-4"
            to="/settings/collection#horizon"
            >{{ c.wantlist.buildHorizon }}</NuxtLink
          >
          {{ c.wantlist.buildHorizonTail }}
        </template>
        <template v-else>
          {{ c.wantlist.lead(count(overview.total), count(overview.withPressings)) }}
        </template>
        <template v-if="overview.seenRecently > 0">
          {{ c.wantlist.seenRecently(count(overview.seenRecently)) }}
        </template>
      </p>

      <!--
        Across the shops you scanned (M19 #9) — labelled as the subset it is.
        The wish is "across all of Discogs"; there is no listings-by-release
        endpoint, so this is over the digs still inside their six hours, and
        what it adds is the postage from the same tables the basket uses.
      -->
      <section
        v-if="plan"
        class="flex flex-col gap-3 border-t border-fid-border pt-4"
        aria-labelledby="want-plan"
        data-testid="want-plan"
      >
        <div class="flex flex-col gap-1">
          <h2 id="want-plan" class="text-fid-base font-medium text-fid-text">
            {{ c.wantlist.plan.title }}
          </h2>
          <WhyNote>{{ c.wantlist.plan.subset }}</WhyNote>
        </div>

        <!--
          Before the first dig the box said nothing at all (M20 #4) — and a
          feature nobody has seen is a feature nobody uses. So it says what
          would fill it, with the way there.
        -->
        <p v-if="plan.shopsScanned === 0" class="text-fid-sm text-fid-text-muted">
          {{ c.wantlist.plan.empty }}
          <NuxtLink to="/dig" class="fid-action text-fid-text underline underline-offset-4">{{
            c.wantlist.plan.emptyAction
          }}</NuxtLink>
        </p>

        <div
          v-else
          role="group"
          :aria-label="c.wantlist.plan.origin.label"
          class="flex flex-wrap gap-1"
        >
          <button
            v-for="key in ORIGIN_FILTERS"
            :key="key"
            type="button"
            class="fid-action min-h-11 rounded-fid-sm border px-3 text-fid-xs"
            :class="
              origin === key
                ? 'border-fid-text bg-fid-inset text-fid-text'
                : 'border-fid-border text-fid-text-muted hover:text-fid-text'
            "
            :aria-pressed="origin === key"
            @click="originBy(key)"
          >
            {{
              key === 'home'
                ? c.wantlist.plan.origin.home(plan.home)
                : c.wantlist.plan.origin[key]
            }}
          </button>
        </div>

        <p
          v-if="plan.shopsScanned > 0 && plan.available === 0"
          class="text-fid-sm text-fid-text-muted"
        >
          {{ c.wantlist.plan.none }}
          <template v-if="plan.originLeftOut > 0">
            {{
              c.wantlist.plan.origin.leftOut(c.wantlist.plan.shops(plan.originLeftOut))
            }}</template
          >
        </p>

        <template v-else-if="plan.available > 0">
          <p class="text-fid-sm text-fid-text">
            {{ c.wantlist.plan.lead(count(plan.available), count(plan.wanted)) }}
            <template v-if="plan.best">
              {{
                c.wantlist.plan.best(
                  c.wantlist.plan.shops(plan.best.shops.length),
                  money(plan.best.goods, plan.currency) ?? '',
                  money(plan.best.postage, plan.currency) ?? '',
                  money(plan.best.total, plan.currency) ?? '',
                )
              }}
            </template>
          </p>

          <ul v-if="plan.best" class="flex flex-col gap-2">
            <li
              v-for="shop in plan.best.shops"
              :key="shop.dealer"
              class="flex flex-col gap-1 rounded-fid-sm border border-fid-border px-3 py-2"
            >
              <div class="flex flex-wrap items-baseline justify-between gap-x-3">
                <NuxtLink
                  :to="`/dig/${shop.digId}`"
                  class="fid-action text-fid-sm font-medium text-fid-text underline-offset-4 hover:underline"
                >
                  {{ shop.displayName }}
                </NuxtLink>
                <span class="fid-num text-fid-xs text-fid-text-muted">
                  {{
                    c.wantlist.plan.shopLine(
                      c.wantlist.plan.records(shop.items.length),
                      money(shop.goods, plan.currency) ?? '',
                      money(shop.postage, plan.currency) ?? '',
                    )
                  }}
                </span>
              </div>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="item in shop.items"
                  :key="item.listingId"
                  class="flex flex-wrap items-baseline justify-between gap-x-3 text-fid-sm"
                >
                  <NuxtLink
                    :to="`https://www.discogs.com/sell/item/${item.listingId}`"
                    target="_blank"
                    rel="noopener"
                    class="fid-action min-w-0 text-fid-text underline-offset-4 hover:underline"
                    :aria-label="`${item.artist} – ${item.title} (${c.wantlist.plan.open})`"
                  >
                    {{ item.artist }} – {{ item.title }}
                    <span
                      v-if="item.want >= WANT_MOST"
                      class="text-fid-xs text-fid-sig-wantlist"
                    >
                      · {{ c.wantlist.priority.most }}</span
                    >
                    <span v-if="!item.exact" class="text-fid-xs text-fid-text-muted">
                      · {{ c.wantlist.plan.otherPressing }}</span
                    >
                  </NuxtLink>
                  <span class="fid-num text-fid-text-muted">{{
                    money(item.price, plan.currency)
                  }}</span>
                </li>
              </ul>
              <p v-if="shop.belowMinimum" class="text-fid-xs text-fid-sig-scarcity">
                {{
                  c.wantlist.plan.belowMinimum(money(shop.minOrderTotal, plan.currency) ?? '')
                }}
              </p>
            </li>
          </ul>

          <p v-if="plan.best && plan.naive" class="text-fid-sm text-fid-text-muted">
            <template v-if="plan.naive.total > plan.best.total">
              {{
                c.wantlist.plan.naive(
                  c.wantlist.plan.shops(plan.naive.shops.length),
                  money(plan.naive.postage, plan.currency) ?? '',
                  money(plan.naive.total - plan.best.total, plan.currency) ?? '',
                )
              }}
            </template>
            <template v-else>{{ c.wantlist.plan.sameAsNaive }}</template>
          </p>

          <p
            v-if="plan.unknownPostage.length > 0 || plan.otherCurrencies > 0"
            class="text-fid-xs text-fid-text-muted"
          >
            <template v-if="plan.unknownPostage.length > 0">
              {{ c.wantlist.plan.unknownPostage(plan.unknownPostage.join(', ')) }}
              <template v-if="plan.onlyWithoutPostage > 0">
                {{ c.wantlist.plan.onlyThere(count(plan.onlyWithoutPostage)) }}</template
              >
            </template>
            <template v-if="plan.otherCurrencies > 0">
              {{
                c.wantlist.plan.otherCurrencies(c.wantlist.plan.offers(plan.otherCurrencies))
              }}</template
            >
          </p>

          <p v-if="plan.originLeftOut > 0" class="text-fid-xs text-fid-text-muted">
            {{ c.wantlist.plan.origin.leftOut(c.wantlist.plan.shops(plan.originLeftOut)) }}
          </p>

          <p v-if="plan.expiresAt" class="text-fid-xs text-fid-text-muted">
            {{ c.wantlist.plan.expires(dayTime(plan.expiresAt)) }}
          </p>
        </template>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          :placeholder="c.wantlist.search"
          :aria-label="c.wantlist.searchLabel"
          class="fid-field px-3 py-2 text-fid-sm text-fid-text"
        />
        <!-- Longest wanted, or wanted most (M20 #1). Two states, in the address. -->
        <div role="group" :aria-label="c.wantlist.priority.sortLabel" class="flex gap-4">
          <button
            v-for="key in ['waiting', 'want'] as const"
            :key="key"
            type="button"
            class="fid-plate min-h-11 border-b-2 transition-colors"
            :class="
              sort === key
                ? 'border-fid-accent text-fid-text'
                : 'border-transparent text-fid-text-muted hover:text-fid-text'
            "
            :aria-pressed="sort === key"
            @click="sortBy(key)"
          >
            {{ c.wantlist.priority[key] }}
          </button>
        </div>

        <!-- The same control the shelf has, in the same place on the bar. -->
        <button
          type="button"
          class="fid-plate min-h-11 border-b-2 transition-colors"
          :class="
            selecting
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="selecting"
          @click="selecting ? stopSelecting() : (selecting = true)"
        >
          {{ selecting ? c.wantlist.select.done : c.wantlist.select.start }}
        </button>
      </div>

      <!-- The selection's one action: off the list, with the way back below. -->
      <div v-if="selecting" class="flex flex-wrap items-center gap-4">
        <span class="fid-plate text-fid-text-muted">{{
          c.wantlist.select.count(count(chosenWants))
        }}</span>
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="selectAll"
        >
          {{ c.wantlist.select.all }}
        </button>
        <button
          type="button"
          :disabled="chosenWants === 0"
          class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-50"
          @click="dropSelected"
        >
          {{ c.wantlist.select.drop(count(chosenWants)) }}
        </button>
      </div>

      <!-- The way back, pinned where the eye is — as on the shelf. -->
      <p
        v-if="last"
        role="status"
        class="fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-3 rounded-fid-sm border border-fid-border bg-fid-surface px-4 py-2 text-fid-sm text-fid-text shadow-lg"
      >
        {{ last.line }}
        <button
          v-if="last.records"
          type="button"
          class="fid-action min-h-11 text-fid-sm text-fid-accent underline underline-offset-4"
          @click="undo"
        >
          {{ c.wantlist.select.undo }}
        </button>
      </p>

      <p v-if="records.length === 0" class="text-fid-sm text-fid-text-muted">
        {{ c.map.nothingByName }}
      </p>

      <!--
        Longest wanted first. A wantlist is a queue of disappointments, and the
        record that has been on it for four years is the one worth being
        reminded about.
      -->
      <!--
        Sleeves, not cards (M28 #1, the M26 rule): the cover large, the title
        in the display face, everything else a plate. Every album is
        addressable — a cover on the start page lands on its row, `scroll-mt`
        keeps it out from under the nav, and `:target` says which one for a
        moment, because a page that jumps without saying where looks like it
        did nothing.
      -->
      <ul v-else class="grid grid-cols-2 gap-x-4 gap-y-8 @md:grid-cols-3 @2xl:grid-cols-4">
        <li
          v-for="group in visible"
          :id="`want-${group.lead.releaseId}`"
          :key="group.lead.releaseId"
          class="fid-want relative flex scroll-mt-24 flex-col gap-2 rounded-fid-sm"
        >
          <!-- In select mode the sleeve is a thing to tick, not a door. -->
          <input
            v-if="selecting"
            type="checkbox"
            class="absolute top-2 left-2 z-10 size-5"
            :checked="selected.has(group.lead.releaseId)"
            :aria-label="c.wantlist.select.pick(group.lead.artist, group.lead.title)"
            @change="toggleSelect(group.lead.releaseId)"
          />
          <!--
            Outward, and marked as such: Discogs is where you go to buy one.
            The sleeve is the door, in both sizes the sync already brought and
            lazily, because i.discogs.com has a budget of its own (docs/02).
          -->
          <!--
            The sleeve is the door — into the record, not out of the app
            (M31.21). It led to discogs.com until 2026-09-14, which made the
            wantlist the one screen where a cover was a way out.
          -->
          <button
            type="button"
            class="fid-cover-button rounded-fid-sm"
            :class="
              selecting && selected.has(group.lead.releaseId)
                ? 'outline-2 outline-offset-2 outline-fid-accent'
                : ''
            "
            :aria-label="
              selecting
                ? c.wantlist.select.pick(group.lead.artist, group.lead.title)
                : c.open(group.lead.artist, group.lead.title)
            "
            @click="
              selecting ? toggleSelect(group.lead.releaseId) : (open = group.lead.releaseId)
            "
          >
            <img
              v-if="group.lead.thumbUrl || group.lead.coverUrl"
              :src="group.lead.coverUrl || group.lead.thumbUrl"
              :srcset="
                group.lead.coverUrl && group.lead.thumbUrl
                  ? `${group.lead.thumbUrl} 150w, ${group.lead.coverUrl} 600w`
                  : undefined
              "
              sizes="(min-width: 90rem) 16vw, (min-width: 48rem) 25vw, 50vw"
              alt=""
              loading="lazy"
              decoding="async"
              width="600"
              height="600"
              class="aspect-square w-full rounded-fid-sm bg-fid-surface object-cover"
            />
            <span
              v-else
              class="flex aspect-square w-full items-center justify-center rounded-fid-sm bg-fid-surface text-fid-xs text-fid-text-muted"
            >
              {{ c.noCover }}
            </span>
          </button>
          <button
            type="button"
            class="fid-action fid-display line-clamp-2 text-left text-fid-sm leading-tight font-semibold text-fid-text"
            @click="open = group.lead.releaseId"
          >
            {{ group.lead.title }}
          </button>
          <span class="fid-plate truncate text-fid-text-muted">{{ group.lead.artist }}</span>

          <!-- One plate line: the year, the wait, the priority, the pressings the horizon knows. -->
          <p class="fid-plate flex flex-wrap gap-x-2 text-fid-text-muted">
            <span v-if="group.lead.year > 0" class="fid-num">{{ group.lead.year }}</span>
            <span v-if="waiting(group.lead.addedAt)">{{ waiting(group.lead.addedAt) }}</span>
            <span v-if="group.lead.want >= WANT_MOST" class="text-fid-sig-wantlist">{{
              c.wantlist.priority.most
            }}</span>
            <span v-if="group.lead.pressings !== null">{{
              c.wantlist.pressings(count(group.lead.pressings), group.lead.pressings === 1)
            }}</span>
            <span v-else-if="group.lead.masterId === 0">{{ c.wantlist.noMaster }}</span>
          </p>

          <!--
            How much you want it — Discogs' own 0–5 (M20 #1). The lit star
            tapped again is "never said": zero is a state, not the absence of one.
          -->
          <div role="group" :aria-label="c.wantlist.priority.label" class="-ml-2 flex">
            <button
              v-for="star in STARS"
              :key="star"
              type="button"
              :aria-label="c.wantlist.priority.set(star)"
              :aria-pressed="group.lead.want >= star"
              class="fid-lift flex min-h-11 min-w-8 items-center justify-center rounded-fid-sm text-fid-sm transition-colors"
              :class="
                group.lead.want >= star
                  ? 'text-fid-sig-wantlist'
                  : 'text-fid-text-muted hover:text-fid-text'
              "
              @click="want(group.lead, star)"
            >
              {{ group.lead.want >= star ? '★' : '☆' }}
            </button>
          </div>

          <!-- Seen by master, so a different pressing still counts — and a way back to that shop. -->
          <NuxtLink
            v-if="group.lead.lastSeen"
            :to="`/dig?dealer=${encodeURIComponent(group.lead.lastSeen.dealer)}`"
            class="fid-action fid-plate text-fid-sig-wantlist underline-offset-4 hover:underline"
          >
            {{ c.lastSeenAt }}
            <span class="text-fid-text">{{ group.lead.lastSeen.dealer }}</span>
            {{ c.onDay(day(group.lead.lastSeen.at)) }}
          </NuxtLink>

          <!-- The other pressings of the same album, folded under it. -->
          <template v-if="group.members.length > 1">
            <button
              type="button"
              class="fid-plate fid-action min-h-11 self-start text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
              :aria-expanded="expanded.has(group.lead.masterId)"
              @click="toggleGroup(group.lead.masterId)"
            >
              {{ c.wantlist.inPressings(count(group.members.length)) }} ·
              {{
                expanded.has(group.lead.masterId)
                  ? c.wantlist.hidePressings
                  : c.wantlist.showPressings
              }}
            </button>
            <ul v-if="expanded.has(group.lead.masterId)" class="flex flex-col gap-1">
              <li
                v-for="member in group.members"
                :id="`want-${member.releaseId}`"
                :key="member.releaseId"
                class="fid-want flex scroll-mt-24 flex-wrap items-baseline justify-between gap-x-3 rounded-fid-sm text-fid-xs"
              >
                <OutwardLink
                  tone="inherit"
                  class="min-w-0 text-fid-text"
                  :to="`https://www.discogs.com/release/${member.releaseId}`"
                >
                  {{ member.title
                  }}<template v-if="member.year > 0"> · {{ member.year }}</template>
                </OutwardLink>
                <button
                  type="button"
                  class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
                  :aria-label="c.wantlist.drop(member.artist, member.title)"
                  @click="drop(member.releaseId)"
                >
                  {{ c.wantlist.dropShort }}
                </button>
              </li>
            </ul>
          </template>

          <!--
            Which pressing will do, in your own words — the most useful line
            on the screen. Drawn without a border until it is wanted: a note
            is an invitation, not a form field.
          -->
          <input
            v-if="noting.has(group.lead.releaseId)"
            :value="group.lead.note"
            type="text"
            autofocus
            :placeholder="c.wantlist.notePlaceholder"
            :aria-label="c.wantlist.noteLabel(group.lead.artist, group.lead.title)"
            class="fid-field min-h-11 w-full px-2 text-fid-sm text-fid-text placeholder:text-fid-text-muted"
            @change="note(group.lead, ($event.target as HTMLInputElement).value)"
            @blur="closeNote(group.lead.releaseId)"
          />
          <button
            v-else-if="group.lead.note"
            type="button"
            class="fid-action text-left text-fid-sm text-fid-text"
            :aria-label="c.wantlist.noteLabel(group.lead.artist, group.lead.title)"
            @click="openNote(group.lead.releaseId)"
          >
            {{ group.lead.note }}
          </button>
          <button
            v-else
            type="button"
            class="fid-plate fid-action min-h-11 self-start text-fid-text-muted hover:text-fid-text"
            :aria-label="c.wantlist.noteLabel(group.lead.artist, group.lead.title)"
            @click="openNote(group.lead.releaseId)"
          >
            {{ c.wantlist.noteShort }}
          </button>

          <!--
            Wanting something is allowed to stop — as a plate, not a button:
            twenty of them down a page would shout. No confirmation: unlike
            the collection, a want costs nothing to add back.
          -->
          <button
            v-if="group.members.length === 1"
            type="button"
            class="fid-plate fid-action min-h-11 self-start text-fid-text-muted hover:text-fid-text"
            :aria-label="c.wantlist.drop(group.lead.artist, group.lead.title)"
            @click="drop(group.lead.releaseId)"
          >
            {{ c.wantlist.dropShort }}
          </button>
        </li>
      </ul>

      <button
        v-if="rest > 0"
        type="button"
        class="fid-action self-center text-fid-sm text-fid-accent underline underline-offset-4"
        @click="shown += STEP"
      >
        {{ c.showMore(count(Math.min(rest, STEP))) }}
      </button>
    </template>

    <WantSheet
      v-if="openRecord"
      :key="openRecord.releaseId"
      :record="openRecord"
      :walk="walk"
      @close="open = null"
      @step="open = $event"
      @want="want(openRecord, $event)"
    />
  </AppPage>
</template>

<style scoped>
/*
 * A moment only, then it is a row like any other again.
 *
 * The jump alone says nothing: somebody coming from the start page sees a list
 * and does not know which one was meant. The outline says so and then goes,
 * instead of claiming a selection that does not exist.
 *
 * `prefers-reduced-motion` turns the animation off and leaves the emphasis
 * standing — the information must not hang off a preference about movement.
 */
.fid-want:target {
  border-color: var(--color-fid-accent);
  animation: fid-want-found 2.4s ease-out forwards;
}

@keyframes fid-want-found {
  from {
    border-color: var(--color-fid-accent);
  }
  to {
    border-color: var(--color-fid-border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fid-want:target {
    animation: none;
  }
}
</style>
