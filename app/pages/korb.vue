<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

const b = useBasketMessages()

useSeoMeta({ title: () => b.value.title, description: () => b.value.description })

const { view, load, clear } = useBasket()

onMounted(load)

const baskets = computed(() => view.value.baskets)
const records = computed(() =>
  baskets.value.reduce((sum, basket) => sum + basket.lines.length, 0),
)
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ b.title }}</h1>
      <BasketTabs />
      <p class="text-fid-base text-fid-text-muted">{{ b.lead }}</p>
    </div>

    <!--
      Offered first when the basket is empty, because that is the state
      somebody arrives in mid-shopping-session: records already picked out on
      Discogs, and nothing here yet to reason about.
    -->
    <BasketPaste />

    <p v-if="baskets.length === 0" class="text-fid-base text-fid-text-muted">
      {{ b.empty }}
    </p>

    <template v-else>
      <!--
        One parcel per shop.

        Postage is per shipment, so every basket sums, tiers and advises for
        itself. What is new is that there can be several: a shopping session is
        three records at one seller and two at another, and until now the
        second click silently deleted the first basket.
      -->
      <div
        v-if="baskets.length > 1"
        class="flex flex-wrap items-baseline justify-between gap-2"
      >
        <p class="fid-num text-fid-sm text-fid-text-muted">
          {{ b.shops(count(baskets.length), count(records)) }}
        </p>
        <button
          type="button"
          class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
          @click="clear()"
        >
          {{ b.clearAll }}
        </button>
      </div>

      <BasketCard v-for="basket in baskets" :key="basket.dealer" :summary="basket" />
    </template>
  </main>
</template>
