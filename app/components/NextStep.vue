<script setup lang="ts">
import type { HorizonStatus, LibrarySummary } from '#shared/protocol'

const m = useMessages()
const { call } = useFidelityWorker()

const library = ref<LibrarySummary | null>(null)
const horizon = ref<HorizonStatus | null>(null)
const digs = ref(0)

async function refresh() {
  const [summary, status, list] = await Promise.all([
    call('library.summary', undefined),
    call('horizon.status', undefined),
    call('dig.list', undefined),
  ])
  library.value = summary
  horizon.value = status
  digs.value = list.length
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
    return { ...m.value.nextStep.library, to: '/einstellungen/sammlung#library' }
  }

  if (horizon.value.expanded < horizon.value.entities) {
    const minutes = Math.ceil((horizon.value.estimatedRequests * 1.2) / 60)
    const words = m.value.nextStep.horizon
    return {
      cta: words.cta,
      title: words.title,
      body: words.body(minutes),
      to: '/einstellungen/sammlung#horizon',
    }
  }

  if (digs.value === 0) {
    return { ...m.value.nextStep.dig, to: '/dig' }
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
      class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
    >
      {{ step.cta }}
    </NuxtLink>
  </section>
</template>
