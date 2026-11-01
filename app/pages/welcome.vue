<script setup lang="ts">
import type { SyncProgress } from '#shared/protocol'
import { STARTER_SHOPS } from '#shared/starter-shops'
import type { Identity } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'
import { useWelcomeMessages } from '~/i18n/welcome'

const c = useCollectionMessages()
const w = useWelcomeMessages()
/*
 * No title of its own, on purpose.
 *
 * This is the page somebody is on when they add the app to their home screen,
 * and iOS reads the document title to name the icon. "Fidelity · Welcome"
 * would be a two-word name for a one-word app. The description still says
 * what the screen is for, to anything that reads descriptions.
 */
useSeoMeta({ description: () => w.value.description })

/**
 * The setup, once, from front to back.
 *
 * Everything here existed already — the token form, the sync, the horizon —
 * but scattered across three screens with nothing saying which came first.
 * Somebody arriving at a token field has no idea that two more things have to
 * happen before the app does anything.
 *
 * Its own route rather than a modal: it is the only thing on screen, it can be
 * left and come back to, and it is a chunk that a returning user never loads.
 */
const { call } = useFidelityWorker()
const { identity, ready, load, set } = useIdentity()

/**
 * "Have a look" comes before "give me your key".
 *
 * `start` is not a step in the setup and is deliberately not in `STEPS`: it is
 * the page somebody lands on, and the setup is what they choose from it. The
 * progress rail belongs to the steps that follow, so an extra dot for the page
 * you are standing on would say the demo is something to get through.
 *
 * Key, collection, first dig (#214). Artists and credits were steps of their
 * own for a while: minutes each, before anything was found. They now start in
 * the background once the first dig is through (`app/pages/dig.vue`), which
 * is when somebody has a list to look at instead of a bar to watch.
 */
type Step = 'start' | 'token' | 'sync' | 'dig'

const step = ref<Step>('start')
const STEPS: Step[] = ['token', 'sync', 'dig']

/**
 * Where the last button leads.
 *
 * The middleware sets `?next=` when it has sent somebody here from another
 * screen. Only relative paths are accepted: a `next=https://…` in a shared
 * link would be an open redirect, and preventing that costs nothing.
 */
const backTo = computed(() => {
  const next = useRoute().query.next
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/dig'
})
const stepIndex = computed(() => STEPS.indexOf(step.value))

/**
 * Short enough that the three of them fit on a phone.
 *
 * Typed by `Step` rather than `Exclude<Step, 'start'>` so the lookup in the
 * template needs no cast — a `<` inside a template expression reads as an
 * opening tag to the formatter, which is a strange way to lose a build.
 */
const STEP_LABEL = computed<Partial<Record<Step, string>>>(
  // `satisfies` is what the loose type above gave up: two of the labels
  // were keyed `horizont` and `fertig`, and the segments stood there empty.
  () => w.value.steps satisfies Record<Exclude<Step, 'start'>, string>,
)

const syncing = ref(false)
const progress = ref<SyncProgress | null>(null)
const error = ref<unknown>(null)
const library = ref<{ collection: number; wantlist: number } | null>(null)

onMounted(async () => {
  await load()
  if (!identity.value) return

  /*
   * Coming back mid-way is the normal case, not an edge one: entering a token
   * navigates to Discogs and back, and a sync of five thousand records is
   * minutes during which somebody looks at something else. Where the flow
   * resumes is decided by what is actually on the device, not by a flag that
   * could disagree with it.
   */
  const summary = await call('library.summary', undefined)
  library.value = summary
  step.value = summary.collection > 0 ? 'dig' : 'sync'
})

function signedIn(next: Identity) {
  set(next)
  step.value = 'sync'
}

async function sync() {
  if (syncing.value) return
  syncing.value = true
  error.value = null

  try {
    await call('library.sync', undefined, { onProgress: (p) => (progress.value = p) })
    library.value = await call('library.summary', undefined)
    step.value = 'dig'
  } catch (cause) {
    error.value = cause
  } finally {
    syncing.value = false
    progress.value = null
  }
}

/** Determinate, and named — a bar with no numbers under it says nothing. */
const percent = computed(() => {
  const p = progress.value
  if (!p || p.total === 0) return 0
  return Math.min(100, Math.round((p.stored / p.total) * 100))
})

const syncLabel = computed(() => {
  const p = progress.value
  if (!p) return null
  const what = p.kind === 'collection' ? c.value.tabs.shelf : c.value.tabs.wantlist
  return w.value.syncing(what, count(p.stored), count(p.total))
})

/**
 * Focus follows the step (#214).
 *
 * The panel that had focus is gone after the swap, and focus fell back to the
 * body: a screen reader said nothing and a keyboard started over at the top.
 * After the new panel has entered, its heading takes focus — the one place
 * that says where the setup has got to.
 */
function focusHeading(panel: Element) {
  const heading = panel.querySelector<HTMLElement>('h2')
  if (!heading) return
  heading.tabIndex = -1
  heading.focus()
}
</script>

<template>
  <AppPage narrow>
    <PageHeader>
      <template #title>Sleeveside</template>
      <p class="max-w-prose text-fid-base text-fid-text-muted">{{ w.lead }}</p>
    </PageHeader>

    <!--
        Segments rather than "Schritt 2 von 5". The filled part is the same
        information and takes no words, and the labels underneath say what the
        steps are, which a number never does.
      -->
    <ol v-if="step !== 'start'" class="flex gap-2" :aria-label="w.setupProgress">
      <li
        v-for="(name, index) in STEPS"
        :key="name"
        class="flex flex-1 flex-col gap-2"
        :aria-current="step === name ? 'step' : undefined"
      >
        <span
          class="h-1 rounded-full transition-colors duration-[var(--fid-motion-layout)]"
          :class="index <= stepIndex ? 'bg-fid-accent' : 'bg-fid-inset'"
        />
        <span
          class="text-fid-xs transition-colors"
          :class="index <= stepIndex ? 'text-fid-text' : 'text-fid-text-muted'"
        >
          {{ STEP_LABEL[name] }}
        </span>
      </li>
    </ol>

    <ErrorNote v-if="error" :cause="error" :signed-in="Boolean(identity)" />

    <!--
        `mode="out-in"` so the leaving panel is gone before the next arrives —
        two panels crossfading through each other is mush at this size.
      -->
    <div class="relative">
      <Transition name="fid-step" mode="out-in" @after-enter="focusHeading">
        <!-- 0 · Ankommen ---------------------------------------------------- -->
        <!--
            The button goes above the demonstration, not below it.

            Somebody who already knows what this is should not have to scroll
            past a demo to get started, and somebody who does not know finds the
            demo immediately below. The order costs the first group nothing and
            gives the second everything.
          -->
        <section v-if="step === 'start'" key="start" class="flex flex-col gap-8">
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="fid-fill fid-action self-start rounded-fid-md bg-fid-accent-fill px-6 py-3 text-fid-base font-medium text-fid-on-accent"
              @click="step = 'token'"
            >
              {{ w.setUp }}
            </button>
            <p class="max-w-prose text-fid-sm text-fid-text-muted">
              {{ w.setUpAbout }}
            </p>
          </div>

          <hr class="border-fid-border" />

          <DemoDig />
        </section>

        <!-- 1 · Token ------------------------------------------------------ -->
        <!--
            No lead of its own. The first draft had one, and on a phone it read
            as the same sentence twice: TokenForm already opens with "Fidelity
            spricht direkt mit Discogs – ohne Server dazwischen", and repeating
            it above is the kind of padding this app is supposed to be free of.
          -->
        <section v-else-if="step === 'token'" key="token">
          <TokenForm @signed-in="signedIn($event)" />
        </section>

        <!-- 2 · Sammlung --------------------------------------------------- -->
        <section v-else-if="step === 'sync'" key="sync" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">
              {{ w.signedInAs(identity?.username ?? '') }}
            </h2>
            <p class="max-w-prose text-fid-base text-fid-text-muted">
              {{ w.syncAbout }}
            </p>
          </div>

          <div v-if="syncing" class="flex flex-col gap-2" aria-live="polite">
            <div class="h-2 w-full overflow-hidden rounded-full bg-fid-inset">
              <div
                class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
                :style="{ width: `${percent}%` }"
              />
            </div>
            <p class="fid-num text-fid-sm text-fid-text-muted">
              {{ syncLabel ?? w.asking }}
            </p>
          </div>

          <button
            v-else
            type="button"
            class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 font-medium text-fid-on-accent"
            @click="sync"
          >
            {{ w.fetchCollection }}
          </button>
        </section>

        <!-- 3 · First dig ------------------------------------------------- -->
        <!--
            The setup ends in a dig, not on the start page (#214). A shop
            leads to the dig screen with its name filled in and checked, never
            started: the scan spends somebody's rate limit, and that screen
            asks first.
          -->
        <section v-else key="dig" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">{{ w.dig.title }}</h2>
            <p v-if="library" class="max-w-prose text-fid-base text-fid-text-muted">
              {{ w.dig.summary(count(library.collection), count(library.wantlist)) }}
            </p>
            <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ w.dig.after }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <h3 id="welcome-starters" class="text-fid-xs font-medium text-fid-text-muted">
              {{ w.dig.starters }}
            </h3>
            <nav aria-labelledby="welcome-starters" class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="shop in STARTER_SHOPS"
                :key="shop.username"
                :to="{ path: '/dig', query: { dealer: shop.username } }"
                class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
              >
                {{ shop.displayName }}
                <span class="ml-1.5 text-fid-xs opacity-70">{{ shop.shipsFrom }}</span>
              </NuxtLink>
            </nav>
          </div>

          <!--
              The middleware appends `?next=` when it has sent somebody here
              from another screen; they go back there, under a label that says
              so. Everybody else goes to the dig.
            -->
          <NuxtLink
            :to="backTo"
            class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 font-medium text-fid-on-accent"
          >
            {{ backTo === '/dig' ? w.dig.anyShop : w.dig.goBack }}
          </NuxtLink>
        </section>
      </Transition>
    </div>

    <p
      v-if="ready && (step === 'start' || step === 'token')"
      class="text-fid-xs text-fid-text-muted"
    >
      {{ w.alreadySetUp }}
      <NuxtLink class="underline underline-offset-4" to="/">{{ w.startPage }}</NuxtLink>
    </p>
  </AppPage>
</template>
