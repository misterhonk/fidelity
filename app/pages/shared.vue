<script setup lang="ts">
import type { SharedDig, Signal } from '#shared/types'

import { byStrength } from '~~/worker/match/reason'

import { plateFor } from '~/i18n/reason'
import { useDigMessages } from '~/i18n/dig'

/**
 * A find list somebody has sent.
 *
 * **The one screen in this app built for somebody who does not have it.** No
 * token, no collection, no hub, possibly never heard of it — everything here
 * comes from the link's fragment (#249). Which is why `/shared` is in the
 * exception list of `app/middleware/setup.global.ts`: a shared link that
 * redirects to the setup is the worst possible way to introduce an app.
 *
 * Reading only, and no price, condition, seller or cover — the link carries
 * none (`worker/share.ts`). The way to the record leads to Discogs, as it does
 * everywhere else in this app; the way into the app leads to the demo.
 */
const d = useDigMessages()

useSeoMeta({ title: () => d.value.sharedTitle })

const { call } = useFidelityWorker()

const loading = ref(true)
const snapshot = shallowRef<SharedDig | null>(null)
const problem = ref<'link' | 'newer' | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  // The fragment, never the query: no browser sends a fragment to a server.
  const data = new URLSearchParams(location.hash.slice(1)).get('d')
  try {
    if (!data) problem.value = 'link'
    else {
      snapshot.value = await call('share.read', { data })
      if (!snapshot.value) problem.value = 'newer'
    }
  } catch (cause) {
    error.value = cause
    problem.value = 'link'
  } finally {
    loading.value = false
  }
})

/** Why it fits, strongest first, as plates: the link carries names, not counts. */
const plates = (signals: Signal[]) => [...signals].sort(byStrength).map(plateFor).join(' · ')
</script>

<template>
  <AppPage narrow class="max-md:pt-[calc(env(safe-area-inset-top,0px)+2rem)]">
    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ d.sheet.loading }}</p>

    <section v-else-if="problem" class="flex flex-col gap-3">
      <h1 class="text-fid-xl font-bold text-fid-text">{{ d.sharedTitle }}</h1>
      <p class="text-fid-base text-fid-text-muted">
        {{ problem === 'newer' ? d.sharedNewer : d.sharedBadLink }}
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
        <h1 class="text-fid-xl font-bold text-fid-text">{{ d.sharedTitle }}</h1>
        <p class="text-fid-sm text-fid-text-muted">
          {{
            d.sharedScope(
              count(snapshot.matches.length),
              count(snapshot.matchesTotal),
              String(Math.round(snapshot.coverage * 100)),
            )
          }}
        </p>
        <p class="text-fid-xs text-fid-text-muted">{{ d.sharedNoPrices }}</p>
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

          <p v-if="match.signals.length" class="text-fid-sm text-fid-text">
            {{ plates(match.signals) }}
          </p>

          <p class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <OutwardLink :to="listingPage(match.listingId)">
              {{ d.sheet.atDiscogs }}
            </OutwardLink>
            <DiscogsCredit :to="listingPage(match.listingId)" />
          </p>
        </li>
      </ul>

      <footer class="flex flex-col gap-2 border-t border-fid-border pt-4">
        <p class="text-fid-sm text-fid-text-muted">{{ d.sharedPitch }}</p>
        <FidButton to="/welcome" class="self-start">
          {{ d.sharedWhatIsThis }}
        </FidButton>
      </footer>
    </template>
  </AppPage>
</template>
