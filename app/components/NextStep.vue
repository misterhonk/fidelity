<script setup lang="ts">
import type { HorizonStatus, LibrarySummary } from '#shared/protocol'

const m = useMessages()
const { call } = useFidelityWorker()

const library = ref<LibrarySummary | null>(null)
const horizon = ref<HorizonStatus | null>(null)
const digs = ref(0)
/** The newest full dig, for "dig it again" once the lookup has caught up with it. */
const newest = ref<{ dealer: string; startedAt: number } | null>(null)

async function refresh() {
  const [summary, status, list] = await Promise.all([
    call('library.summary', undefined),
    call('horizon.status', undefined),
    call('dig.list', undefined),
  ])
  library.value = summary
  horizon.value = status
  digs.value = list.length
  const full = list
    .filter((dig) => (dig.depth ?? 'normal') !== 'neu')
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  newest.value = full ? { dealer: full.dealer, startedAt: full.startedAt } : null
}

onMounted(refresh)

/**
 * Exactly one next thing (docs/06 M8: onboarding somebody gets through
 * schafft").
 *
 * The dashboard carries four panels that can all be started in any order, and
 * three of them only make sense after the one above. Naming a single next step
 * is the difference between a screen somebody reads and a screen somebody
 * asks about — and it disappears entirely once there is nothing to say, rather
 * than lingering as a permanent checklist.
 */
const step = computed(() => {
  if (!library.value || !horizon.value) return null

  if (library.value.collection === 0) {
    return { ...m.value.nextStep.library, to: '/settings/collection#library' }
  }

  /*
   * The dig first, the lookup second (2026-10-21).
   *
   * The order was the other way round, and the lookup is about twelve minutes
   * for a typical shelf: a stranger's first answer was a quarter of an hour
   * away, behind a progress bar about somebody else's discographies. A dig
   * works without it — with the signals the shelf and the wantlist carry —
   * and is a list in two to four minutes. The lookup then makes the *next*
   * dig better, and says so.
   */
  if (digs.value === 0) {
    return { ...m.value.nextStep.dig, to: '/dig' }
  }

  if (horizon.value.expanded < horizon.value.entities) {
    const minutes = Math.ceil((horizon.value.estimatedRequests * 1.2) / 60)
    const words = m.value.nextStep.horizon
    return {
      cta: words.cta,
      title: words.title,
      body: words.body(minutes),
      to: '/settings/collection#horizon',
    }
  }

  /*
   * The lookup finished after the newest dig: that dig ran without it.
   * Only while somebody is starting out — a lookup that fills gaps after a
   * sync finishes again later, and a standing "dig again" would nag.
   */
  const built = horizon.value.builtAt
  if (digs.value <= 2 && newest.value && built !== null && built > newest.value.startedAt) {
    const words = m.value.nextStep.again
    return {
      cta: words.cta,
      title: words.title(newest.value.dealer),
      body: words.body,
      to: `/dig?dealer=${encodeURIComponent(newest.value.dealer)}`,
    }
  }

  return null
})
</script>

<template>
  <section
    v-if="step"
    class="flex flex-col gap-2 rounded-fid-md border border-fid-accent/40 bg-fid-accent/5 p-4"
    aria-labelledby="next-step"
  >
    <h2 id="next-step" class="text-fid-base font-medium text-fid-text">{{ step.title }}</h2>
    <p class="text-fid-sm text-fid-text-muted">{{ step.body }}</p>
    <!--
      One button, always in the same place, always the thing the sentence
      above just named. Two different affordances for "go here" was a choice
      nobody needed to make.
    -->
    <NuxtLink
      :to="step.to"
      class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
    >
      {{ step.cta }}
    </NuxtLink>
  </section>
</template>
