<script setup lang="ts">
import type { HorizonStatus, LibrarySummary } from '#shared/protocol'

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
 * Exactly one next thing (docs/06 M8: "Onboarding, das Jens ohne Rückfrage
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
    return {
      cta: 'Sammlung holen',
      title: 'Als Erstes: deine Sammlung holen',
      body:
        'Ohne sie weiß Fidelity nicht, was du magst. Ein paar Sekunden pro tausend ' +
        'Platten, danach ist sie auf diesem Gerät.',
      to: '/einstellungen/sammlung#library',
    }
  }

  if (horizon.value.expanded < horizon.value.entities) {
    const minutes = Math.ceil((horizon.value.estimatedRequests * 1.2) / 60)
    return {
      cta: 'Horizont bauen',
      title: 'Dann: den Horizont bauen',
      body:
        `Einmalig rund ${counted(minutes, 'Minute', 'Minuten')}. Danach erkennt jeder Dig ` +
        'auch Produzenten, ' +
        'Katalogserien und andere Pressungen – und kostet dafür keinen einzigen Request extra.',
      to: '/einstellungen/sammlung#horizon',
    }
  }

  if (digs.value === 0) {
    return {
      cta: 'Dig starten',
      title: 'Jetzt: den ersten Händler scannen',
      body:
        'Nimm einen, bei dem du ohnehin kaufst. Zwei bis vier Minuten für zwanzigtausend ' +
        'Listings, und am Ende steht eine Liste mit einem Satz pro Treffer.',
      to: '/dig',
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
      class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990"
    >
      {{ step.cta }}
    </NuxtLink>
  </section>
</template>
