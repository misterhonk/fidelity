<script setup lang="ts">
import type { StarterShop } from '#shared/starter-shops'
import type { Dealer } from '#shared/types'
import type { SuggestResult } from '~~/worker/dealers/suggest'

import { useDealerMessages } from '~/i18n/dealers'

/**
 * The foot of the shops screen (M34.4): what the hub suggests, the one field
 * for a name, five shops for a device with none, and the hidden ones.
 *
 * Under the list, because adding a shop is what you do *after* looking at
 * the ones you have — and on a device with none, the empty line above points
 * straight down here.
 */
const h = useDealerMessages()

defineProps<{
  hidden: Dealer[]
  suggested: SuggestResult | null
  suggesting: boolean
  adding: boolean
  /** The starter shops not yet on this device — empty once the list has begun. */
  starters: StarterShop[]
  /** Which starter is being added right now, if any. */
  starterBusy: string | null
}>()

const emit = defineEmits<{
  add: [name: string]
  restore: [username: string]
  starter: [username: string]
}>()

const typed = ref('')
const typedName = computed(() => dealerFromInput(typed.value))

function submit() {
  const name = typedName.value
  if (!name) return
  emit('add', name)
  typed.value = ''
}
</script>

<template>
  <!--
    Asking the hub takes a moment — up to twenty shops go up before the list
    comes back — and a screen that shows nothing while it works looks like a
    screen that is finished. Muted, not the accent: a thing happening by
    itself is not a thing to press.
  -->
  <p
    v-if="suggesting && !suggested"
    role="status"
    class="flex items-center gap-2 text-fid-sm text-fid-text-muted"
  >
    <span class="size-2 animate-pulse rounded-full bg-fid-text-muted" aria-hidden="true" />
    {{ h.suggested.busy }}
  </p>

  <!--
    Shops other people have dug (ADR-014). Only where there is something to
    show: without a hub there is no list, and saying so on every device that
    has none would be a permanent notice about a feature nobody asked for.
  -->
  <section
    v-if="suggested && suggested.shops.length > 0"
    class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    aria-labelledby="suggested"
  >
    <h2 id="suggested" class="text-fid-base font-medium text-fid-text">
      {{ h.suggested.title }}
    </h2>
    <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ h.suggested.about }}</p>

    <ul class="flex flex-col gap-2">
      <li
        v-for="shop in suggested.shops"
        :key="shop.username"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-fid-border pb-2 last:border-0"
      >
        <NuxtLink
          :to="{ path: '/dig', query: { dealer: shop.username } }"
          class="fid-action flex items-center gap-2 text-fid-base font-medium text-fid-text"
        >
          <ShopLogo :dealer="shop.username" :avatar-url="shop.avatarUrl" :size="20" />
          {{ shop.displayName }}
        </NuxtLink>
        <!-- The number, and the labels behind it: a percentage on its own is a score taken on trust. -->
        <span class="fid-num text-fid-sm text-fid-accent">
          {{ h.suggested.fit(Math.round(shop.fit * 100)) }}
        </span>
        <span v-if="shop.labels.length > 0" class="text-fid-sm text-fid-text-muted">
          {{ shop.labels.join(' · ') }}
        </span>
        <span v-if="shop.shipsFrom" class="text-fid-xs text-fid-text-muted">
          {{ shop.shipsFrom }}
        </span>
      </li>
    </ul>

    <!-- What the number is a share *of*: a sample, not a catalogue. -->
    <p class="max-w-prose text-fid-xs text-fid-text-muted">{{ h.suggested.sample }}</p>
  </section>

  <!--
    Five shops for a device with none (shared/starter-shops.ts). Each one is
    one lookup, and it stands on the list as "entered by hand" until dug.
  -->
  <section
    v-if="starters.length > 0"
    class="flex flex-col gap-3"
    :aria-label="h.starters.title"
  >
    <h2 class="text-fid-base font-medium text-fid-text">{{ h.starters.title }}</h2>
    <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ h.starters.about }}</p>
    <ul class="flex flex-col divide-y divide-fid-border border-y border-fid-border">
      <li
        v-for="shop in starters"
        :key="shop.username"
        class="flex items-center gap-3 py-2 pr-2 pl-3"
      >
        <ShopLogo :dealer="shop.username" :size="32" class="shrink-0" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-fid-sm font-medium text-fid-text">{{
            shop.displayName
          }}</span>
          <span class="fid-plate text-fid-text-muted">{{ countryCode(shop.shipsFrom) }}</span>
        </span>
        <button
          type="button"
          :disabled="starterBusy !== null"
          class="fid-action fid-tonal rounded-fid-sm px-3 text-fid-xs font-medium disabled:opacity-50"
          :aria-label="`${h.starters.add} ${shop.displayName}`"
          @click="emit('starter', shop.username)"
        >
          {{ starterBusy === shop.username ? h.starters.adding : h.starters.add }}
        </button>
      </li>
    </ul>
  </section>

  <!--
    A shop entered by hand — the one field at the foot (M34.1). The search
    through orders and friends lives in the settings beside its switch.
  -->
  <form class="flex flex-wrap items-end gap-3" @submit.prevent="submit">
    <div class="flex min-w-64 grow flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="add-shop">
        {{ h.add.label }}
      </label>
      <input
        id="add-shop"
        v-model="typed"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :placeholder="h.add.placeholder"
        class="fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
    </div>
    <button
      type="submit"
      :disabled="adding || typedName === null"
      class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
    >
      {{ adding ? h.add.busy : h.add.submit }}
    </button>
  </form>

  <!-- The hidden ones, at the foot and only when there are any. -->
  <section
    v-if="hidden.length > 0"
    class="flex flex-col gap-2"
    :aria-label="h.hidden.title(hidden.length)"
  >
    <h2 class="text-fid-sm font-medium text-fid-text-muted">
      {{ h.hidden.title(hidden.length) }}
    </h2>
    <p class="text-fid-xs text-fid-text-muted">{{ h.hideWhy }}</p>
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="shop in hidden"
        :key="shop.username"
        class="flex items-center gap-2 rounded-fid-sm border border-fid-border py-1 pr-1 pl-3 text-fid-sm text-fid-text-muted"
      >
        {{ shop.displayName || shop.username }}
        <button
          type="button"
          class="fid-action rounded-fid-sm px-2 py-1 text-fid-xs text-fid-text underline underline-offset-4"
          @click="emit('restore', shop.username)"
        >
          {{ h.hidden.restore }}
        </button>
      </li>
    </ul>
  </section>
</template>
