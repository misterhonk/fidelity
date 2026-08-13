<script setup lang="ts">
import type { DealerCandidate } from '#shared/types'

const m = useMessages()
const emit = defineEmits<{ imported: [] }>()

/**
 * Whether there is nothing on the shelf yet.
 *
 * Only changes one thing: the friends question starts open instead of folded.
 * A collapsed summary is a fine footnote next to a working list of shops, and
 * a poor one when the list is empty and the fold is the only thing between
 * somebody and the reason their search comes back with two names.
 */
const { firstTime = false } = defineProps<{ firstTime?: boolean }>()

const { call } = useFidelityWorker()

const running = ref(false)
const progress = ref<{ done: number; total: number; requests: number } | null>(null)
const found = shallowRef<DealerCandidate[] | null>(null)
const chosen = ref(new Set<string>())
const result = ref<string | null>(null)
const error = ref<unknown>(null)

async function discover() {
  if (running.value) return

  running.value = true
  result.value = null
  error.value = null

  try {
    const answer = await call('dealer.discover', undefined, {
      onProgress: (update) => {
        progress.value = update
      },
    })
    found.value = answer.candidates
    // Everything not already known is preselected: somebody who asked for this
    // wants the shops, not a checkbox exercise.
    chosen.value = new Set(
      answer.candidates.filter((one) => !one.known).map((one) => one.username),
    )
    if (answer.candidates.length === 0) {
      result.value = m.value.discovery.nothing
    }
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
    progress.value = null
  }
}

/**
 * Split by where a name came from, and in that order.
 *
 * Orders first: they are the documented source and the stronger claim —
 * somebody who has already bought from a shop has a reason to look there
 * again. Empty groups are dropped rather than shown as a heading over
 * nothing.
 */
const groups = computed(() =>
  (['order', 'friend'] as const)
    .map((source) => ({
      source,
      rows: (found.value ?? []).filter((one) => one.source === source),
    }))
    .filter((group) => group.rows.length > 0),
)

function toggle(username: string) {
  const next = new Set(chosen.value)
  if (next.has(username)) next.delete(username)
  else next.add(username)
  chosen.value = next
}

async function keep() {
  const candidates = (found.value ?? []).filter((one) => chosen.value.has(one.username))
  if (candidates.length === 0) return

  error.value = null
  try {
    const answer = await call('dealer.remember', { candidates })
    result.value = m.value.discovery.added(answer.added)
    found.value = null
    emit('imported')
  } catch (cause) {
    error.value = cause
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <ErrorNote v-if="error" :cause="error" />

    <button
      v-if="!found"
      type="button"
      :disabled="running"
      class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      @click="discover()"
    >
      <template v-if="running">
        {{ m.common.searching }}
        <template v-if="progress && progress.total > 0">
          {{ m.common.ofTotal(count(progress.done), count(progress.total)) }}
        </template>
      </template>
      <template v-else>{{ m.discovery.search }}</template>
    </button>

    <p v-if="result" class="text-fid-sm text-fid-text-muted" aria-live="polite">{{ result }}</p>

    <WhyNote v-if="!found" :label="m.discovery.whereLabel">
      {{ m.discovery.about }}
    </WhyNote>

    <!--
      Der Schalter steht dort, wo er etwas ändert.

      Reading the friends list is off by default and lives in the settings,
      three taps away from the only screen where it does anything (ADR-009).
      Somebody whose shop list is empty is exactly the person it was built for
      — and the moment they look at that empty list is the moment the choice
      is worth offering. It stays in the settings too; this is a second door,
      not a move.
    -->
    <details
      v-if="!found"
      :open="firstTime"
      class="rounded-fid-sm border border-fid-border p-3"
    >
      <summary class="cursor-pointer text-fid-sm text-fid-text-muted">
        {{ m.discovery.friendsSummary }}
      </summary>
      <div class="pt-3"><FriendImportToggle /></div>
    </details>

    <!--
      Zwei Listen, nicht eine mit einem Etikett je Zeile.

      "Bought from" and "friends who sell" are different kinds of trust, and
      the difference is what somebody uses to decide. As a word at the end of
      a row it was read last, if at all; as a heading it is read first — and
      it also puts the undocumented half of the list (ADR-009) under a name
      instead of hiding it in a footnote.
    -->
    <template v-for="group in groups" :key="group.source">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 class="text-fid-sm font-medium text-fid-text">
          {{ m.discovery.sources[group.source] }}
        </h3>
        <p class="fid-num text-fid-xs text-fid-text-muted">{{ count(group.rows.length) }}</p>
      </div>
      <p class="-mt-1 text-fid-xs text-fid-text-muted">
        {{ m.discovery.sourceAbout[group.source] }}
      </p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="candidate in group.rows"
          :key="candidate.username"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-sm border border-fid-border px-3 py-2"
        >
          <label class="flex min-w-0 grow items-center gap-3">
            <input
              type="checkbox"
              class="size-4 shrink-0"
              :checked="chosen.has(candidate.username)"
              :disabled="candidate.known"
              @change="toggle(candidate.username)"
            />
            <span class="min-w-0 truncate text-fid-sm text-fid-text">
              {{ candidate.username }}
            </span>
          </label>

          <!--
            `min-w-0` rather than `shrink-0`: a shop's address is longer than a
            phone is wide (a full street address with postcode and country),
            and a block that refuses to shrink cannot wrap either — it just
            leaves the card.
          -->
          <span class="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-fid-xs text-fid-text-muted">
            <span class="fid-num">{{ m.discovery.listings(count(candidate.numForSale)) }}</span>
            <span v-if="candidate.location">{{ candidate.location }}</span>
            <span v-if="candidate.known">{{ m.discovery.alreadyThere }}</span>
          </span>
        </li>
      </ul>
    </template>

    <template v-if="found && found.length > 0">
      <button
        type="button"
        :disabled="chosen.size === 0"
        class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="keep()"
      >
        {{ m.discovery.take(count(chosen.size)) }}
      </button>
    </template>
  </section>
</template>
