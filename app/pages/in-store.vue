<script setup lang="ts">
import type { DigWithMatches } from '#shared/protocol'
import type { ShelfHit, ShelfResult } from '#shared/types'
import { reasonFor } from '~/i18n/reason'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const m = useMessages()
useSeoMeta({
  title: () => m.value.inStore.title,
  description: () => m.value.inStore.description,
})

const { call } = useFidelityWorker()
const { online } = useOnline()
const { verdicts, judge, failure: judgeFailure, load: loadFeedback } = useFeedback()
const { contains, toggle, failure: basketFailure, load: loadBasket } = useBasket()

// Shallow: the in-store screen judges records too, and a proxy cannot
// cross postMessage. Same reason as the dig screen.
const result = shallowRef<DigWithMatches | null>(null)
const loading = ref(true)
const query = ref('')

onMounted(async () => {
  try {
    result.value = await call('dig.latest', undefined)
    await Promise.all([loadFeedback(), loadBasket()])
  } finally {
    loading.value = false
  }
})

/**
 * Everything, by score, with the shortlist folded in.
 *
 * No filter bar, no density switch, no sorting. Standing in a shop holding a
 * record you want one question answered — is this one of mine — and every
 * control between you and that answer is in the way.
 */
const matches = computed(() => {
  const all = result.value?.matches ?? []
  const needle = query.value.trim()
  return needle ? all.filter((match) => textMatches(match, needle)) : all
})

/*
 * "Habe ich die schon?"
 *
 * The question this screen says it exists for — and until now it could only
 * answer it about records the last dig happened to find, which is one online
 * dealer's stock and never the crate in front of you.
 *
 * The collection and the wantlist have been on this device since M1. No
 * request, no network, no rate limit, which is the whole point: record shops
 * are basements and basements have no signal.
 */
const shelf = shallowRef<ShelfResult | null>(null)

let shelfToken = 0
watch(query, (value) => {
  const mine = ++shelfToken
  if (value.trim().length < 2) {
    shelf.value = null
    return
  }

  void call('collection.shelf', { query: value }).then((result) => {
    // A slower answer to an older query must not overwrite a newer one.
    if (mine === shelfToken) shelf.value = result
  })
})

/** Nothing anywhere — which in a shop is an answer, not an empty state. */
const nothingAnywhere = computed(
  () =>
    query.value.trim().length >= 2 &&
    matches.value.length === 0 &&
    shelf.value?.hits.length === 0,
)

function formats(hit: ShelfHit): string {
  return hit.formats.slice(0, 2).join(', ')
}

/** How long it has been wanted — the part that makes the answer sting. */
function waiting(days: number | null): string | null {
  if (days === null) return null
  if (days < 1) return 'heute notiert'
  if (days === 1) return 'seit gestern'
  if (days < 31) return `seit ${days} Tagen`
  const months = Math.floor(days / 30)
  if (months < 24) return `seit ${months} Monaten`
  return `seit ${Math.floor(months / 12)} Jahren`
}

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? Date.now() > dig.expiresAt : false
})
</script>

<template>
  <main class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
    <!--
      The in-store screen (docs/05 §3 row 9).

      Built for a phone in one hand and a record in the other: 56 px rows, one
      column, nothing that needs precision. It reads only from IndexedDB, so it
      is complete without a network — which is the point, because record shops
      are basements.
    -->
    <div class="flex items-baseline justify-between gap-3">
      <h1 class="fid-display flex items-center gap-2 text-fid-xl font-bold text-fid-text">
        <FidIcon name="nadel" :size="22" />
        {{ m.inStore.title }}
      </h1>
      <NuxtLink
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        to="/"
      >
        {{ m.inStore.back }}
      </NuxtLink>
    </div>

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>

    <template v-else>
      <p v-if="result" class="text-fid-sm text-fid-text-muted">
        {{ result.dig.dealer }} ·
        <span class="fid-num">{{ result.matches.length }}</span>
        {{ m.inStore.finds(result.matches.length)
        }}<template v-if="!online"> · {{ m.inStore.offline }}</template>
      </p>

      <!--
        A dig that was cut short is not a result.
        Standing in a shop is the worst place to be told three records are all
        there is, when the scan behind that number stopped halfway. The dig
        screen says so and offers to finish; this one showed the same matches
        with none of it.
      -->
      <p
        v-if="result && result.dig.status !== 'done'"
        role="status"
        class="text-fid-sm text-fid-sig-gap"
      >
        {{
          m.inStore.interrupted(
            count(result.dig.listingsScanned),
            count(result.dig.listingsTotal),
          )
        }}
      </p>
      <!--
        No dig is not an empty screen any more. The list of finds needs one;
        "do I have this already?" does not, and that is the question somebody
        actually has standing in a shop.
      -->
      <p v-else class="text-fid-sm text-fid-text-muted">
        {{ m.inStore.noDig }}
      </p>

      <p v-if="expired" role="status" class="text-fid-sm text-fid-sig-gap">
        {{ m.inStore.expired }}
      </p>

      <!--
        A verdict or a basket click that did not survive the trip to the
        worker. Both roll back, so without this the button would spring back
        with no explanation — and in a shop, with the record in your hand, that
        is the worst place to be guessing.
      -->
      <ErrorNote v-if="judgeFailure" :cause="judgeFailure" />
      <ErrorNote v-else-if="basketFailure" :cause="basketFailure" />

      <!-- Big enough to hit while walking. -->
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="m.inStore.search"
        :aria-label="m.inStore.searchLabel"
        class="rounded-fid-md border border-fid-field bg-fid-surface px-4 py-3 text-fid-base text-fid-text"
      />

      <!--
        Your own shelf first. Standing in a shop the two answers that stop you
        short are "die hast du schon" and "die suchst du seit vier Jahren", and
        both come out of IndexedDB — no request, no signal needed.
      -->
      <ul v-if="shelf && shelf.hits.length > 0" class="flex flex-col gap-2">
        <li
          v-for="hit in shelf.hits"
          :key="`${hit.source}-${hit.releaseId}`"
          class="flex min-h-14 flex-col justify-center gap-1 rounded-fid-md border px-3 py-2"
          :class="
            hit.source === 'wantlist'
              ? 'border-fid-sig-wantlist/50 bg-fid-sig-wantlist/5'
              : 'border-fid-border'
          "
        >
          <span class="flex flex-wrap items-baseline gap-x-2">
            <span
              class="text-fid-sm font-medium"
              :class="
                hit.source === 'wantlist' ? 'text-fid-sig-wantlist' : 'text-fid-text-muted'
              "
            >
              {{ hit.source === 'wantlist' ? m.inStore.youWant : m.inStore.youOwn }}
            </span>
            <span class="min-w-0 text-fid-base text-fid-text">
              {{ hit.artist }} – {{ hit.title }}
            </span>
          </span>

          <span class="flex flex-wrap gap-x-2 text-fid-xs text-fid-text-muted">
            <span v-if="hit.year > 0" class="fid-num">{{ hit.year }}</span>
            <!--
              The format is the whole answer when you own the record already:
              holding the vinyl of something you have on CD is a buy, not a
              stop.
            -->
            <span v-if="formats(hit)">{{ formats(hit) }}</span>
            <span v-if="hit.rating > 0" class="fid-num">{{ hit.rating }}/5</span>
            <span v-if="waiting(hit.waitingDays)">{{ waiting(hit.waitingDays) }}</span>
            <!--
              How likely the copy in your hand is the one you meant. One of two
              hundred and forty-seven pressings is a different proposition from
              the only one there is.
            -->
            <span v-if="hit.pressings !== null" class="fid-num">
              {{ m.inStore.pressings(hit.pressings) }}
            </span>
          </span>
        </li>
      </ul>

      <p v-if="nothingAnywhere" class="text-fid-base text-fid-text-muted">
        {{ m.inStore.notInLibrary
        }}<template v-if="result"> {{ m.inStore.norLastDig }}</template
        >.
      </p>
      <p
        v-else-if="matches.length === 0 && (!shelf || shelf.hits.length === 0)"
        class="text-fid-base text-fid-text-muted"
      >
        {{ m.inStore.nothingByName }}
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="match in matches"
          :key="match.listingId"
          class="flex min-h-14 items-center gap-3 rounded-fid-md border border-fid-border px-3 py-2"
        >
          <span
            class="fid-num w-10 shrink-0 text-center text-fid-xl font-bold text-fid-text"
            :aria-label="d.match.score(match.score)"
          >
            {{ match.score }}
          </span>

          <!--
            The title gets the full width and the price moves under it. Holding
            a record in a shop, the one question is whether this is one of
            yours, and "Portishea…" does not answer it.
          -->
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-fid-base text-fid-text">
              {{ match.artist }} – {{ match.title }}
            </span>
            <span class="flex items-baseline gap-2">
              <span
                v-if="money(match.price, match.currency)"
                class="fid-num shrink-0 text-fid-sm text-fid-text-muted"
              >
                {{ money(match.price, match.currency) }}
              </span>
              <span class="truncate text-fid-xs text-fid-text-muted">{{
                reasonFor(match.signals)
              }}</span>
            </span>
          </span>

          <!--
            Two targets, both 44 px, both one-handed: is it for me, and did I
            take it. Everything else belongs on a desk.
          -->
          <button
            type="button"
            :aria-pressed="contains(match.listingId)"
            :aria-label="contains(match.listingId) ? d.match.outOfBasket : d.match.inBasket"
            class="size-11 shrink-0 rounded-fid-sm border text-fid-xl"
            :class="
              contains(match.listingId)
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-fid-border text-fid-text-muted'
            "
            @click="toggle(match.digId, match.listingId)"
          >
            <FidIcon name="shopping-cart" :size="20" />
          </button>

          <button
            type="button"
            :aria-pressed="verdicts[match.listingId] === 'wrong'"
            :aria-label="m.inStore.wrong"
            class="size-11 shrink-0 rounded-fid-sm border text-fid-xl"
            :class="
              verdicts[match.listingId] === 'wrong'
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-fid-border text-fid-text-muted'
            "
            @click="judge(match, 'wrong')"
          >
            <FidIcon name="thumbs-down" :size="20" />
          </button>
        </li>
      </ul>
    </template>
  </main>
</template>
