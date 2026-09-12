<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

const b = useBasketMessages()

useSeoMeta({ title: () => b.value.title, description: () => b.value.description })

const { view, load, clear, failure } = useBasket()

/* Loading and the last toggle can each fail; whichever did is what is shown. */
const error = ref<unknown>(null)
const trouble = computed(() => error.value ?? failure.value)

onMounted(async () => {
  try {
    await load()
  } catch (cause) {
    error.value = cause
  }
})

const baskets = computed(() => view.value.baskets)
const records = computed(() =>
  baskets.value.reduce((sum, basket) => sum + basket.lines.length, 0),
)
</script>

<template>
  <AppPage narrow>
    <PageHeader :title="b.title" :lead="b.lead">
      <template #tabs><BasketTabs /></template>
    </PageHeader>

    <!--
        Offered first when the basket is empty, because that is the state
        somebody arrives in mid-shopping-session: records already picked out on
        Discogs, and nothing here yet to reason about.
      -->
    <ErrorNote v-if="trouble" :cause="trouble" />

    <BasketPaste />

    <p v-if="baskets.length === 0" class="text-fid-base text-fid-text-muted">
      {{ b.empty }}
      <NuxtLink class="fid-action text-fid-text underline underline-offset-4" to="/dig">{{
        b.emptyAction
      }}</NuxtLink>
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
  </AppPage>
</template>
