<script setup lang="ts">
import type { SharedDig } from '#shared/types'

import { reasonFor } from '~/i18n/reason'
import { useDigMessages } from '~/i18n/dig'

/**
 * A find list somebody has sent.
 *
 * **The one screen in this app built for somebody who does not have it.** No
 * token, no collection, no hub entered, possibly never heard of it —
 * everything here comes from the link. Which is why `/shared` is in the
 * exception list of `app/middleware/setup.global.ts`: a shared link that
 * redirects to the setup is the worst possible way to introduce an app.
 *
 * Reading only. No thumb, no basket, no sheet — those all presuppose a
 * collection of your own. The way to the record leads to Discogs, as it does
 * everywhere else in this app.
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
   * The key is in the fragment and read from there — not from the query.
   *
   * No browser sends a fragment to a server. If the key stood beside it as
   * `?k=`, it would be in every access log the hub or a reverse proxy in front
   * of it keeps, and the whole encryption would be decoration.
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
     * Which hub gets asked is this device's decision — not the link's.
     *
     * An address the sender determines would be an invitation to point a
     * stranger's browser at an arbitrary server. So the same search that runs
     * during setup: `/hub` under the same domain first, then the bare origin,
     * then localhost. The link came from somebody whose hub is exactly there.
     */
    const found = await call('hub.discover', undefined)
    /*
     * "No hub runs here" is a different message from "the link is old".
     *
     * Calling both the same thing cost a quarter of an hour on the first run:
     * the screen said "expired" while in truth the address was wrong. What was
     * a debugging session here would be a dead end with no clue for a
     * recipient.
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
     * A wrong key and an expired link mean the same thing: nothing will come
     * of this. Everything else is an error and is shown as one.
     *
     * Before, every cause landed in the sentence "expired". That cost a
     * quarter of an hour on the first run — and it would be worse for a
     * recipient than it was here: they would have no second way to find out.
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
  <AppPage narrow>
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
            The six-hour clock, here too. It runs from the scan and not from
            the sending; hence a point in time here and not a duration.
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
              Price and condition only for as long as they may be shown. After
              six hours the link is gone anyway — but between "the server still
              has it" and "this device finds it expired" lies a clock, and this
              is the one that counts.
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
  </AppPage>
</template>
