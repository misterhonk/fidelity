<script setup lang="ts">
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()

const route = useRoute()
const bar = useTemplateRef<HTMLElement>('bar')

/*
 * Den aktuellen Reiter ins Bild holen.
 *
 * Ohne das landet man auf „Orte" und sieht eine Leiste, die bei „Regal"
 * anfängt — der Reiter, auf dem man steht, ist dann außerhalb. Ein
 * Bildschirm, dessen eigener Reiter nicht zu sehen ist, wirkt wie ein
 * Bildschirm ohne Reiter.
 */
onMounted(() => {
  bar.value
    ?.querySelector('[data-current]')
    ?.scrollIntoView({ block: 'nearest', inline: 'center' })
})

/**
 * Three views of one subject: the records, what they say about you, and the
 * ones still missing. Giving each its own top-level entry would have made
 * seven where five already fill a phone.
 *
 * Full width on a phone, content width from a tablet up. A segmented control
 * stretched across 1680 pixels is three enormous buttons with nothing in them
 * — it stops reading as a switch and starts reading as a header.
 */
const TABS = [
  { to: '/shelf', key: 'shelf', icon: 'regal' },
  { to: '/map', key: 'map', icon: 'map' },
  { to: '/wantlist', key: 'wantlist', icon: 'wantlist' },
  /*
   * Und der vierte: dieselbe Sammlung, aus der Richtung des Marktes.
   *
   * Hierher und nicht in die Hauptleiste — fünf Einträge sind dort die
   * Grenze. „Im Blick" ist keine eigene Gegend, sondern eine weitere Sicht auf
   * das, was man hat und was man sucht.
   */
  { to: '/watched', key: 'watched', icon: 'eye' },
  { to: '/places', key: 'places', icon: 'map-pin' },
] as const
</script>

<template>
  <!--
    Symbol über Text, überall.

    Am 2026-09-11 nachgemessen: fünf Reiter nebeneinander brauchen 435 px in
    einer 343 px breiten Leiste und laufen über. Gestapelt sind es 341 — das
    Symbol fällt aus der Breite heraus, und dieselbe Änderung, die die Knöpfe
    im Stapel lesbar gemacht hat, schafft hier den Platz.

    **Keine `@xl:`-Varianten mehr.** Das sind Container-Queries, und von den
    fünf Seiten mit dieser Leiste haben nur drei ein `@container` — dieselbe
    Leiste sah je nach Seite anders aus, ohne dass irgendetwas das erklärt
    hätte. Am 2026-09-11 nachgesehen, nicht vermutet. Was breitenabhängig sein
    soll, hängt jetzt am Fenster (`md:`), was überall gleich sein soll, an
    nichts.

    `overflow-x-auto` bleibt als Reserve für eine Sprache mit längeren
    Wörtern, und `scrollIntoView` sorgt dafür, dass der Reiter, auf dem man
    steht, dann zu sehen ist.
  -->
  <nav
    ref="bar"
    :aria-label="c.tabs.label"
    class="flex gap-1 self-stretch overflow-x-auto rounded-fid-sm border border-fid-border p-1 md:self-start md:overflow-visible"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :data-current="route.path === tab.to ? 'true' : undefined"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="flex min-h-11 flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-fid-sm px-3 py-2 text-center text-fid-xs whitespace-nowrap transition-colors md:px-6"
      :class="
        route.path === tab.to
          ? 'bg-fid-accent/15 text-fid-text'
          : 'text-fid-text-muted hover:text-fid-text'
      "
    >
      <FidIcon :name="tab.icon" :size="16" />
      {{ c.tabs[tab.key] }}
    </NuxtLink>
  </nav>
</template>
