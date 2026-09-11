<script setup lang="ts">
/**
 * „Die App ist neuer als beim letzten Mal" — eine Zeile, einmal.
 *
 * **Warum es das braucht.** Seit 760a11e gibt es eine Seite, die sagt, was in
 * dieser Ausgabe neu ist. Erreichbar war sie nur über die Versionsnummer im
 * Footer — also für jemanden, der weiß, dass diese Zahl ein Link ist. Das ist
 * die Sorte Weg, die niemand findet, der ihn nicht schon kennt.
 *
 * **Warum nicht im Update-Hinweis.** Der steht *vor* dem Neuladen, und die
 * Notizen liegen im Build: davor sieht man die der Ausgabe, die man gerade
 * verlässt. Die Zeile gehört hinter den Wechsel, nicht davor.
 *
 * **Warum an der zuletzt gesehenen Version und nicht am Update-Hinweis.** So
 * greift sie unabhängig davon, wie jemand zur neuen Ausgabe kam — über den
 * Hinweis, über einen Neustart des Browsers, über ein neues Gerät.
 */

const m = useMessages()
const { version } = useRuntimeConfig().public

/**
 * Pro Browser, nicht pro Konto.
 *
 * „Habe ich diese Ausgabe schon gesehen" ist eine Eigenschaft dieses Fensters
 * und nicht der Sammlung — es gehört deshalb nicht in den Tresor und nicht in
 * IndexedDB. Und es darf verlorengehen: dann steht die Zeile einmal zu viel
 * da, was der harmlosere von zwei Fehlern ist.
 */
const SCHLUESSEL = 'fidelity:seen-version'

const zeigen = ref(false)

function lies(): string | null {
  try {
    return localStorage.getItem(SCHLUESSEL)
  } catch {
    // Privates Fenster, blockierte Website-Daten: dann eben keine Zeile.
    return null
  }
}

function merke() {
  try {
    localStorage.setItem(SCHLUESSEL, String(version))
  } catch {
    /* siehe oben */
  }
}

onMounted(() => {
  const zuletzt = lies()

  /*
   * Beim allerersten Start wird nur gemerkt, nicht gemeldet.
   *
   * Wer die App zum ersten Mal öffnet, hat auf nichts aktualisiert — „neu seit
   * deinem letzten Besuch" wäre dort schlicht unwahr, und die erste Zeile, die
   * jemand von einer App liest, sollte keine falsche sein.
   */
  if (zuletzt === null) {
    merke()
    return
  }

  zeigen.value = zuletzt !== String(version)
})

/** Gelesen ist gesehen — die Zeile kommt für diese Ausgabe nicht wieder. */
function gesehen() {
  merke()
  zeigen.value = false
}
</script>

<template>
  <p
    v-if="zeigen"
    class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-fid-sm text-fid-text-muted"
    role="status"
  >
    <span class="fid-num">{{ m.news.updatedTo(version) }}</span>
    <NuxtLink
      to="/whats-new"
      class="fid-action underline underline-offset-4"
      @click="gesehen()"
      >{{ m.news.whatChanged }}</NuxtLink
    >
    <button type="button" class="fid-action underline underline-offset-4" @click="gesehen()">
      {{ m.news.dismiss }}
    </button>
  </p>
</template>
