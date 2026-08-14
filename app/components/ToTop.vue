<script setup lang="ts">
/**
 * Zurück nach oben, ohne zu wischen bis der Daumen glüht.
 *
 * Das Regal zeigt 120 Cover und lädt in Schritten von 240 nach; wer bei 600
 * angekommen ist und wieder an die Filterleiste will, scrollt eine halbe
 * Minute. Auf dem Telefon gibt es keinen Pos1-Ersatz, und die Kopfzeile ist
 * dort nicht klebend.
 *
 * **Er schwebt, also darf er nichts verdecken.** Der Aktualisierungs-Hinweis
 * stand einmal genauso da — `fixed bottom-4` — und lag über einer Trefferkarte,
 * über der Attribution im Fuß und auf dem Telefon über der Navigation selbst
 * (siehe `app/app.vue`). Deshalb: unten rechts, klein, oberhalb der Leiste, und
 * nur sichtbar, wenn wirklich etwas hinter einem liegt.
 */
const m = useMessages()

/**
 * Ab wann er auftaucht: zwei Bildschirmhöhen.
 *
 * Ein fester Pixelwert war die naheliegende Wahl und die schlechtere — 300 px
 * sind auf einem Telefon ein Drittel Bildschirm und auf einem Schreibtisch ein
 * Fünftel. Zwei Höhen heißen überall dasselbe: „du hast etwas hinter dir
 * gelassen, das nicht mehr zu sehen ist."
 */
const shown = ref(false)

function measure() {
  shown.value = window.scrollY > window.innerHeight * 2
}

onMounted(() => {
  measure()
  // Passiv: dieser Zuhörer verhindert nie etwas, und ein Scroll-Handler ohne
  // das kostet auf einer langen Liste spürbar Bildrate.
  window.addEventListener('scroll', measure, { passive: true })
  window.addEventListener('resize', measure, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', measure)
  window.removeEventListener('resize', measure)
})

function toTop() {
  /*
   * Sanft, außer jemand hat darum gebeten, dass es das nicht ist.
   *
   * `prefers-reduced-motion` ist keine Geschmacksfrage: für manche Leute löst
   * eine lange gleitende Bewegung Übelkeit aus, und sechshundert Cover
   * vorbeifliegen zu lassen ist eine lange Bewegung.
   */
  const sanft = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: sanft ? 'smooth' : 'auto' })
}
</script>

<template>
  <!--
    Aus dem Weg, wenn er nichts zu tun hat: `v-if` statt Deckkraft, damit er
    auch für die Tastatur und den Bildschirmleser verschwindet, statt als
    unsichtbares Ziel stehen zu bleiben.
  -->
  <Transition
    enter-active-class="transition-opacity"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity"
    leave-to-class="opacity-0"
  >
    <button
      v-if="shown"
      type="button"
      class="fid-lift fixed right-4 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border border-fid-border bg-fid-surface-raised text-fid-text shadow-lg max-md:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6"
      :aria-label="m.common.toTop"
      @click="toTop()"
    >
      <FidIcon name="arrow-up" :size="20" aria-hidden="true" />
    </button>
  </Transition>
</template>
