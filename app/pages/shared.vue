<script setup lang="ts">
import type { SharedDig } from '#shared/types'

import { reasonFor } from '~/i18n/reason'
import { useDigMessages } from '~/i18n/dig'

/**
 * Eine Fundliste, die jemand geschickt hat.
 *
 * **Der einzige Bildschirm dieser App, der für jemanden gebaut ist, der sie
 * nicht hat.** Kein Token, keine Sammlung, kein Hub eingetragen, vielleicht
 * noch nie davon gehört — alles, was hier steht, kommt aus dem Link. Deshalb
 * steht `/shared` in der Ausnahmeliste von `app/middleware/setup.global.ts`:
 * ein geteilter Link, der zur Einrichtung umleitet, ist die schlechteste Art,
 * eine App vorzustellen.
 *
 * Nur lesen. Kein Daumen, kein Korb, kein Sheet — das sind alles Dinge, die
 * eine eigene Sammlung voraussetzen. Der Weg zur Platte führt zu Discogs, so
 * wie überall sonst in dieser App auch.
 */
const d = useDigMessages()
const route = useRoute()

useSeoMeta({ title: () => d.value.sharedTitle })

const { call } = useFidelityWorker()

const loading = ref(true)
const snapshot = shallowRef<SharedDig | null>(null)
const problem = ref<'link' | 'gone' | 'nohub' | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  /*
   * Der Schlüssel steht im Fragment und wird von dort gelesen — nicht aus der
   * Query.
   *
   * Ein Fragment schickt kein Browser an einen Server. Stünde der Schlüssel
   * als `?k=` daneben, läge er in jedem Zugriffs-Log, das der Hub oder ein
   * Reverse Proxy davor führt, und die ganze Verschlüsselung wäre Zierde.
   */
  const key = new URLSearchParams(location.hash.slice(1)).get('k')
  const id = typeof route.query.id === 'string' ? route.query.id : null

  if (!key || !id) {
    problem.value = 'link'
    loading.value = false
    return
  }

  try {
    /*
     * Welcher Hub gefragt wird, entscheidet dieses Gerät — nicht der Link.
     *
     * Eine Adresse, die der Absender bestimmt, wäre eine Einladung, den
     * Browser eines Fremden auf einen beliebigen Server zeigen zu lassen. Also
     * dieselbe Suche, die auch beim Einrichten läuft: `/hub` unter derselben
     * Domain zuerst, danach die nackte Herkunft, danach localhost. Der Link
     * kam von jemandem, dessen Hub genau dort steht.
     */
    const found = await call('hub.discover', undefined)
    /*
     * „Hier läuft kein Hub" ist eine andere Nachricht als „der Link ist alt".
     *
     * Beides gleich zu nennen hat mich beim ersten Durchlauf eine
     * Viertelstunde gekostet: der Bildschirm sagte „abgelaufen", während in
     * Wahrheit die Adresse nicht stimmte. Was für mich eine Fehlersuche war,
     * wäre für einen Empfänger eine Sackgasse ohne Hinweis.
     */
    if (!found.url) {
      problem.value = 'nohub'
      return
    }

    const hubUrl = found.url
    snapshot.value = await call('share.read', { hubUrl, id, key })
    if (!snapshot.value) problem.value = 'gone'
  } catch (cause) {
    /*
     * Ein falscher Schlüssel und ein abgelaufener Link bedeuten dasselbe:
     * daraus wird nichts mehr. Alles andere ist ein Fehler und wird als einer
     * gezeigt.
     *
     * Vorher landete hier jede Ursache im Satz „abgelaufen". Das hat beim
     * ersten Durchlauf eine Viertelstunde gekostet — und für einen Empfänger
     * wäre es schlimmer als für mich: er hätte keinen zweiten Weg, es
     * herauszufinden.
     */
    error.value = cause
    problem.value = 'gone'
  } finally {
    loading.value = false
  }
})

const fresh = computed(() => {
  const at = snapshot.value?.expiresAt
  return at !== undefined && Date.now() < at
})
</script>

<template>
  <main class="fid-page py-4">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ d.sheet.loading }}</p>

      <section v-else-if="problem" class="flex flex-col gap-3">
        <h1 class="text-fid-xl font-bold text-fid-text">{{ d.sharedTitle }}</h1>
        <p class="text-fid-base text-fid-text-muted">
          {{
            problem === 'link'
              ? d.sharedBadLink
              : problem === 'nohub'
                ? d.sharedNoHub
                : d.sharedGone
          }}
        </p>
        <ErrorNote v-if="error" :cause="error" :signed-in="false" />
        <NuxtLink
          to="/welcome"
          class="fid-action self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        >
          {{ d.sharedWhatIsThis }}
        </NuxtLink>
      </section>

      <template v-else-if="snapshot">
        <header class="flex flex-col gap-2">
          <h1 class="text-fid-xl font-bold text-fid-text">
            {{ d.sharedFrom(snapshot.dealer) }}
          </h1>
          <p class="text-fid-sm text-fid-text-muted">
            {{
              d.sharedScope(
                count(snapshot.matches.length),
                count(snapshot.matchesTotal),
                String(Math.round(snapshot.coverage * 100)),
              )
            }}
          </p>
          <!--
            Die Sechs-Stunden-Uhr, auch hier. Sie läuft ab dem Scan und nicht ab
            dem Verschicken; deshalb steht hier ein Zeitpunkt und keine Dauer.
          -->
          <p v-if="fresh" class="text-fid-xs text-fid-text-muted">
            {{ d.shareGone(dayTime(snapshot.expiresAt)) }}
          </p>
        </header>

        <ul class="flex flex-col gap-3">
          <li
            v-for="match in snapshot.matches"
            :key="match.listingId"
            class="flex flex-col gap-1 rounded-fid-md border border-fid-border p-3"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-fid-base font-medium text-fid-text">
                {{ match.artist }} – {{ match.title }}
              </p>
              <p class="fid-num shrink-0 text-fid-sm text-fid-text-muted">{{ match.score }}</p>
            </div>

            <p
              v-if="match.label || match.year"
              class="font-fid-mono text-fid-xs text-fid-text-muted"
            >
              {{
                [match.label, match.catno, match.format, match.year].filter(Boolean).join(' · ')
              }}
            </p>

            <p class="text-fid-sm text-fid-text">{{ reasonFor(match.signals) }}</p>

            <!--
              Preis und Zustand nur, solange sie gezeigt werden dürfen. Nach
              sechs Stunden ist der Link ohnehin weg — aber zwischen „der Server
              hat ihn noch" und „dieses Gerät findet ihn abgelaufen" liegt eine
              Uhr, und die hier zählt.
            -->
            <p v-if="fresh && match.price !== null" class="text-fid-sm text-fid-text">
              {{ money(match.price, match.currency) }}
              <span v-if="match.condition" class="text-fid-text-muted"
                >· {{ match.condition }}</span
              >
            </p>

            <OutwardLink :to="`https://www.discogs.com/sell/item/${match.listingId}`">
              {{ d.sheet.atDiscogs }}
            </OutwardLink>
          </li>
        </ul>

        <footer class="flex flex-col gap-2 border-t border-fid-border pt-4">
          <p class="text-fid-sm text-fid-text-muted">{{ d.sharedPitch }}</p>
          <NuxtLink
            to="/welcome"
            class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
          >
            {{ d.sharedWhatIsThis }}
          </NuxtLink>
        </footer>
      </template>
    </div>
  </main>
</template>
