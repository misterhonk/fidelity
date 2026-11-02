<script setup lang="ts">
import { reasonFor } from '~/i18n/reason'

const m = useMessages()

const { alerts, digests, dismiss } = useWatchlist()

/** The new-only pass for this shop, while its prices may still be shown (rule 4). */
function digestOf(dealer: string) {
  return digests.value.find(
    (digest) => digest.dealer === dealer && digest.expiresAt > Date.now(),
  )
}
</script>

<template>
  <!--
    "Seit deinem letzten Besuch."

    Worded as what it actually knows: the shop's total moved. It is *not* a
    count of new records — a dealer who sells five and lists five moves by zero
    — and saying "40 neue Listings" would be a claim the data does not support.
  -->
  <section
    v-if="alerts.length > 0"
    role="status"
    class="flex flex-col gap-2 rounded-fid-md border border-fid-border bg-fid-surface p-4"
    aria-labelledby="watch-banner"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="watch-banner" class="text-fid-base font-medium text-fid-text">
        {{ m.watch.sinceLastVisit }}
      </h2>
      <button
        type="button"
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="dismiss()"
      >
        {{ m.watch.read }}
      </button>
    </div>

    <ul class="flex flex-col gap-1">
      <li v-for="alert in alerts" :key="alert.dealer" class="text-fid-sm text-fid-text">
        <NuxtLink class="underline underline-offset-4" :to="`/shop?dealer=${alert.dealer}`">
          {{ alert.dealer }}
        </NuxtLink>
        {{ m.watch.moved(count(alert.newListings), alert.newListings === 1) }}
        <!-- What the "only what is new" dig found there (#240): the new finds and why. -->
        <template v-if="digestOf(alert.dealer)">
          <ul
            v-if="digestOf(alert.dealer)!.finds.length > 0"
            class="mt-1 flex flex-col gap-1 pl-3"
          >
            <li v-for="find in digestOf(alert.dealer)!.finds" :key="find.listingId">
              <NuxtLink
                class="font-medium underline-offset-4 hover:underline"
                :to="`/shop?id=${find.digId}`"
              >
                {{ [find.artist, find.title].filter(Boolean).join(' · ') }}
              </NuxtLink>
              <span class="block text-fid-text-muted">{{ reasonFor(find.signals) }}</span>
            </li>
          </ul>
          <span v-else class="text-fid-text-muted">{{ m.watch.nothingNew }}</span>
        </template>
      </li>
    </ul>

    <WhyNote :label="m.watch.whyLabel">{{ m.watch.why }}</WhyNote>
  </section>
</template>
