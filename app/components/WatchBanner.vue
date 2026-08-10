<script setup lang="ts">
const { alerts, dismiss } = useWatchlist()

const number = new Intl.NumberFormat('de-DE')
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
        Seit deinem letzten Besuch
      </h2>
      <button
        type="button"
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="dismiss()"
      >
        Gelesen
      </button>
    </div>

    <ul class="flex flex-col gap-1">
      <li v-for="alert in alerts" :key="alert.dealer" class="text-fid-sm text-fid-text">
        <NuxtLink class="underline underline-offset-4" :to="`/dig?dealer=${alert.dealer}`">
          {{ alert.dealer }}
        </NuxtLink>
        hat <span class="fid-num">{{ number.format(alert.newListings) }}</span>
        {{ alert.newListings === 1 ? 'Listing' : 'Listings' }} mehr im Angebot als beim letzten
        Mal.
      </li>
    </ul>

    <WhyNote label="Wie gezählt wird">
      Die Gesamtzahl des Ladens, nicht wie viele Platten neu sind – wer fünf verkauft und fünf
      einstellt, bewegt sich um null. Ein Dig sagt, was davon für dich dabei ist.
    </WhyNote>
  </section>
</template>
