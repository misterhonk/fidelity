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

const { last, tick } = useKeeper()
const busy = ref(false)

async function refreshAll() {
  if (busy.value) return
  busy.value = true
  try {
    await tick({ force: true })
    emit('refreshed')
  } finally {
    busy.value = false
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
  if (busy.value) return words.looking

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
  <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-fid-xs text-fid-text-muted">
    <span aria-live="polite">{{ note }}</span>
    <button
      type="button"
      :disabled="busy"
      class="fid-action underline underline-offset-4 disabled:opacity-50"
      @click="refreshAll"
    >
      {{ m.freshness.refreshAll }}
    </button>
  </p>
</template>
