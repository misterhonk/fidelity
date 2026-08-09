<script setup lang="ts">
useSeoMeta({
  title: 'Championship',
  description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
})

// Ten colours for eleven signals — S1 and S2 share one. This strip is the
// visual proof that tokens/*.json actually reaches the browser; the real
// SignalChip lands with M2.
const signals = [
  { key: 'wantlist', label: 'Wantlist' },
  { key: 'artist', label: 'Künstler' },
  { key: 'label', label: 'Label' },
  { key: 'style', label: 'Stil' },
  { key: 'gap', label: 'Lücke' },
  { key: 'catalog', label: 'Katalogserie' },
  { key: 'credit', label: 'Credits' },
  { key: 'upgrade', label: 'Upgrade' },
  { key: 'price', label: 'Preis' },
  { key: 'scarcity', label: 'Seltenheit' },
]
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <p class="text-fid-xs uppercase tracking-[0.2em] text-fid-text-muted">Championship</p>
      <h1 class="text-fid-2xl font-bold text-fid-text">Fidelity</h1>
      <p class="text-fid-base text-fid-text-muted">
        Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer. Das
        Fundament steht. Der erste Dig kommt mit M2.
      </p>
    </div>

    <ul class="flex flex-wrap gap-2" aria-label="Die Match-Signale">
      <li
        v-for="signal in signals"
        :key="signal.key"
        class="rounded-fid-sm border px-3 py-1 text-fid-xs text-fid-text"
        :style="{
          backgroundColor: `color-mix(in oklch, var(--fid-sig-${signal.key}) 12%, transparent)`,
          borderColor: `color-mix(in oklch, var(--fid-sig-${signal.key}) 40%, transparent)`,
        }"
      >
        {{ signal.label }}
      </li>
    </ul>
  </main>
</template>
