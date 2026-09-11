<script setup lang="ts">
import { since } from '~/utils/when'

const m = useMessages()

/**
 * How current everything is — in one place, with one button.
 *
 * Fidelity refreshes four different things and each button lived somewhere
 * else: the library sync under Settings → Sync, the horizon under Settings →
 * Collection, the watchlist nowhere at all, the market data in each basket.
 * Nothing was wrong with any of them individually; together they added up to an
 * app whose data quietly aged and never said so.
 *
 * The keeper handles all three cheap ones on its own now (worker/keeper.ts).
 * This says when that last happened and gives it a handle — because "it happens
 * by itself" is only trustworthy when you can watch it having happened.
 */
const props = defineProps<{ collectionSyncedAt: number | null }>()
const emit = defineEmits<{ refreshed: [] }>()

/**
 * `busy` is the keeper itself, `pressed` is the button.
 *
 * Two states, because they are two occasions: the keeper runs on opening and
 * every twenty minutes of its own accord, the button is a request. Before,
 * there was only the second — the first ran silently, and that was the gap.
 */
const { last, busy, tick } = useKeeper()
const pressed = ref(false)

/**
 * Has this run reported a step yet?
 *
 * "Looking …" belongs before the first report — the worker is loading its
 * module, and a button that does nothing is worse than a line of patience.
 * After that it does not belong: measured 2026-09-11, it bracketed the named
 * steps on both sides, and the trailing one read as though the run were
 * starting over.
 */
const reported = ref(false)
watch(busy, (job) => {
  if (job !== null) reported.value = true
})

async function refreshAll() {
  if (pressed.value) return
  pressed.value = true
  reported.value = false
  try {
    await tick({ force: true })
    emit('refreshed')
  } finally {
    pressed.value = false
  }
}

/**
 * What just happened, in one sentence — or how old the state is.
 *
 * A run that changed nothing says so rather than staying silent: "nothing new"
 * is an answer, and a button that appears to do nothing is worse than one that
 * reports a boring result.
 */
const note = computed(() => {
  const words = m.value.freshness

  /*
   * What is running beats any past tense.
   *
   * And the step is named: "updating" on its own is a reassurance; "collection
   * and wantlist" is information.
   */
  if (busy.value) return `${words.updating} — ${words.job[busy.value]} …`
  if (pressed.value && !reported.value) return words.looking

  const result = last.value
  if (result?.did.length) {
    const parts: string[] = []
    if (result.stored > 0) parts.push(words.added(result.stored))
    if (result.alerts > 0) parts.push(words.alerts(result.alerts))
    if (parts.length > 0) return parts.join(' · ')
    return words.nothingNew
  }

  const at = props.collectionSyncedAt
  return at ? words.asOf(since(at)) : m.value.common.nothingYet
})
</script>

<template>
  <!--
    A `<div>` and no longer a `<p>`.

    `<p>` takes phrasing content only, and `WhyNote` is a `<details>`. The
    browser then closes the paragraph itself and lifts the `<details>` out —
    the line falls into two blocks, and only in the rendered document, not in
    the source. Noticed on 2026-09-11 while fitting it.
  -->
  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-fid-xs text-fid-text-muted">
    <span aria-live="polite">{{ note }}</span>
    <button
      type="button"
      :disabled="pressed || busy !== null"
      class="fid-action underline underline-offset-4 disabled:opacity-50"
      @click="refreshAll"
    >
      {{ m.freshness.refreshAll }}
    </button>
    <WhyNote :label="m.freshness.whyLabel">{{ m.freshness.why }}</WhyNote>
  </div>
</template>
