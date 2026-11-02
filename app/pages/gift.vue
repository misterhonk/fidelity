<script setup lang="ts">
import type { GiftProgress, GiftResult } from '~~/worker/gift'

import { useGiftMessages } from '~/i18n/gift'

/**
 * A gift for a friend (#245): their public wantlist, across the shops you
 * scanned, within a budget, minus what they own.
 *
 * Their name and everything read about them live in this component and
 * nowhere else — not the address, not IndexedDB (Restricted Data, docs/09).
 */
const g = useGiftMessages()
useSeoMeta({ title: () => g.value.title, description: () => g.value.lead })

const { call } = useFidelityWorker()

const typed = ref('')
const budget = ref(25)
const friend = computed(() => dealerFromInput(typed.value))
const busy = ref(false)
const progress = shallowRef<GiftProgress | null>(null)
const result = shallowRef<GiftResult | null>(null)
const asked = ref('')
const error = ref<unknown>(null)

// Rule 4: past the earliest dig's six hours the prices go.
useDeadline(
  () => result.value?.expiresAt,
  () => (result.value = null),
)

async function find() {
  const username = friend.value
  if (!username || !(budget.value > 0)) return
  busy.value = true
  error.value = null
  result.value = null
  progress.value = null
  try {
    result.value = await call(
      'gift.find',
      { username, budget: budget.value },
      { onProgress: (p) => (progress.value = p) },
    )
    asked.value = username
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppPage narrow>
    <PageHeader :title="g.title" :lead="g.lead" />

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="find">
      <div class="flex min-w-64 grow flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="gift-who">{{ g.who }}</label>
        <input
          id="gift-who"
          v-model="typed"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
      </div>
      <div class="flex w-36 flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="gift-budget">{{
          g.budget
        }}</label>
        <input
          id="gift-budget"
          v-model.number="budget"
          type="number"
          min="1"
          step="1"
          inputmode="decimal"
          class="fid-field fid-num px-3 py-2 text-fid-sm text-fid-text"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || friend === null || !(budget > 0)"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      >
        {{ g.find }}
      </button>
    </form>
    <p v-if="typed.trim() && friend === null" class="text-fid-xs text-fid-error">
      {{ g.badName }}
    </p>
    <p class="text-fid-xs text-fid-text-muted">{{ g.forgotten }}</p>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="busy" role="status" class="text-fid-sm text-fid-text-muted">
      {{ progress ? g.reading(count(progress.read), count(progress.total)) : g.looking }}
    </p>

    <section v-if="result" class="flex flex-col gap-3" data-testid="gift-result">
      <p v-if="result.closed" class="text-fid-base text-fid-text">{{ g.closed }}</p>
      <template v-else>
        <p class="text-fid-base text-fid-text">
          {{
            result.ideas.length > 0
              ? g.found(result.ideas.length, count(result.wanted))
              : g.none
          }}
        </p>
        <p v-if="result.owned" class="text-fid-sm text-fid-text-muted">
          {{ g.owned(result.owned) }}
        </p>
        <p v-if="result.owned === null" class="text-fid-sm text-fid-text-muted">
          {{ g.collectionClosed }}
        </p>
        <p v-if="result.overBudget > 0" class="text-fid-sm text-fid-text-muted">
          {{ g.overBudget(result.overBudget) }}
        </p>

        <ul v-if="result.ideas.length > 0" class="flex flex-col gap-2">
          <li
            v-for="idea in result.ideas"
            :key="idea.listingId"
            class="flex flex-wrap items-baseline justify-between gap-x-3 text-fid-sm"
          >
            <span class="flex min-w-0 flex-col">
              <a
                :href="listingPage(idea.listingId)"
                target="_blank"
                rel="noopener"
                class="fid-action text-fid-text underline-offset-4 hover:underline"
                :aria-label="`${idea.artist} – ${idea.title} (${g.open})`"
              >
                {{ idea.artist }} – {{ idea.title }}
              </a>
              <NuxtLink
                :to="`/shop?id=${idea.digId}`"
                class="fid-action text-fid-xs text-fid-text-muted underline-offset-4 hover:underline"
              >
                {{ idea.displayName }}
              </NuxtLink>
            </span>
            <span class="fid-num text-fid-text-muted">{{
              money(idea.price, idea.currency)
            }}</span>
          </li>
        </ul>
        <DiscogsCredit v-if="asked" :to="wantlistPage(asked)" />
        <p v-if="result.expiresAt" class="text-fid-xs text-fid-text-muted">
          {{ g.expires(dayTime(result.expiresAt)) }}
        </p>
      </template>
    </section>
  </AppPage>
</template>
