<script setup lang="ts">
import { since } from '~/utils/when'

/**
 * Wie aktuell der Bestand ist — an einer Stelle, mit einem Knopf.
 *
 * Fidelity refreshes four different things and each button lived somewhere
 * else: the library sync in Einstellungen → Abgleich, the horizon under
 * Einstellungen → Sammlung, the watchlist nowhere at all, the market data in
 * each basket. Nothing was wrong with any of them individually; together they
 * added up to an app whose data quietly aged and never said so.
 *
 * The keeper handles all three cheap ones on its own now
 * (worker/keeper.ts). This says when that last happened and gives it a handle
 * — because "es passiert von selbst" is only trustworthy when you can see it
 * having happened.
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
 * Was gerade passiert ist, in einem Satz — oder wie alt der Stand ist.
 *
 * A run that changed nothing says so rather than staying silent: "nichts Neues"
 * is an answer, and a button that appears to do nothing is worse than one that
 * reports a boring result.
 */
const note = computed(() => {
  if (busy.value) return 'Sieht nach …'

  const result = last.value
  if (result?.did.length) {
    const parts: string[] = []
    if (result.stored > 0) parts.push(counted(result.stored, 'Platte', 'Platten') + ' dazu')
    if (result.alerts > 0)
      parts.push(counted(result.alerts, 'Laden hat', 'Läden haben') + ' Neues')
    if (parts.length > 0) return parts.join(' · ')
    return 'Nichts Neues.'
  }

  const at = props.collectionSyncedAt
  return at ? `Stand von ${since(at)}` : 'Noch nichts geholt'
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
      Alles auffrischen
    </button>
  </p>
</template>
