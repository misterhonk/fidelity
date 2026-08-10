<script setup lang="ts">
import type { CreditGroup } from '#shared/types'

const props = defineProps<{ digId: string }>()

const { call } = useFidelityWorker()
const { show } = useReleaseSheet()

const groups = ref<CreditGroup[]>([])
const open = ref<number | null>(null)

/**
 * Loaded on demand, not with the dig.
 *
 * It costs nothing in requests — every edge was paid for when the horizon was
 * built — but it does rebuild the lookup, and doing that on every dig result
 * for a panel most people will not open is work for nothing.
 */
async function load() {
  if (groups.value.length > 0) return
  groups.value = await call('dig.credits', { digId: props.digId })
}

/**
 * The sentence docs/00 §5 uses to describe the whole feature. Written from the
 * numbers rather than templated over them, so it stays true when they are odd.
 */
function line(group: CreditGroup): string {
  const here = `${number.format(group.matches.length)} ${group.matches.length === 1 ? 'Platte' : 'Platten'}`
  if (group.owned === 0) {
    return `${here} hier, von denen du noch nichts hast.`
  }
  const owned = `${number.format(group.owned)} ${group.owned === 1 ? 'Platte' : 'Platten'}`
  return `Du hast ${owned} — dieser Händler hat ${here} mehr.`
}
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="credits-heading">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3
        id="credits-heading"
        class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted"
      >
        Wer hier mitgewirkt hat
      </h3>
      <button
        v-if="groups.length === 0"
        type="button"
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="load"
      >
        Nachsehen
      </button>
    </div>

    <p v-if="groups.length === 0" class="text-fid-sm text-fid-text-muted">
      Discogs' größter ungenutzter Schatz: wer produziert, gemischt oder gemastert hat. Steht
      schon im Horizont – die Antwort kommt sofort.
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="group in groups"
        :key="group.entityId"
        class="rounded-fid-md border border-fid-border"
      >
        <button
          type="button"
          class="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-left"
          :aria-expanded="open === group.entityId"
          @click="open = open === group.entityId ? null : group.entityId"
        >
          <span class="text-fid-base font-medium text-fid-text">{{ group.name }}</span>
          <span class="text-fid-sm text-fid-text-muted">{{ line(group) }}</span>
        </button>

        <ul v-if="open === group.entityId" class="flex flex-col gap-1 px-4 pb-3">
          <li
            v-for="entry in group.matches"
            :key="entry.listingId"
            class="flex items-baseline gap-3"
          >
            <span class="fid-num shrink-0 text-fid-sm font-medium text-fid-text">
              {{ entry.score }}
            </span>
            <button
              type="button"
              class="min-w-0 grow truncate text-left text-fid-sm text-fid-text underline-offset-4 hover:underline"
              @click="show(digId, entry.listingId)"
            >
              {{ entry.title }}
            </button>
            <span class="shrink-0 text-fid-xs text-fid-text-muted">{{ entry.role }}</span>
            <span class="fid-num shrink-0 text-fid-sm text-fid-text-muted">
              {{ money(entry.price, entry.currency) }}
            </span>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
