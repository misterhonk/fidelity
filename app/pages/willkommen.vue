<script setup lang="ts">
import type { SyncProgress } from '#shared/protocol'
import type { Identity } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'
import { useWelcomeMessages } from '~/i18n/welcome'

const c = useCollectionMessages()
const w = useWelcomeMessages()
useSeoMeta({ title: () => w.value.title, description: () => w.value.description })

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
 * Horizon and credits are steps as of today. They were left out because they
 * cost minutes and the app runs without them — both still true, and both beside
 * the point: without them the matcher only knows the artists somebody already
 * owns, by name. No other pressings, no catalogue series, no producers. That is
 * half the app, hidden behind a settings page nobody has a reason to open on
 * day one. Each says what it buys before it starts and each is one click to
 * walk past.
 */
type Step = 'start' | 'token' | 'sync' | 'horizont' | 'credits' | 'fertig'

const step = ref<Step>('start')
const STEPS: Step[] = ['token', 'sync', 'horizont', 'credits', 'fertig']
const stepIndex = computed(() => STEPS.indexOf(step.value))

/**
 * Short enough that five of them fit on a phone.
 *
 * Typed by `Step` rather than `Exclude<Step, 'start'>` so the lookup in the
 * template needs no cast — a `<` inside a template expression reads as an
 * opening tag to the formatter, which is a strange way to lose a build.
 */
const STEP_LABEL: Partial<Record<Step, string>> = {
  token: 'Token',
  sync: 'Sammlung',
  horizont: 'Horizont',
  credits: 'Credits',
  fertig: 'Fertig',
}

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
  step.value = summary.collection > 0 ? 'fertig' : 'sync'
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
    step.value = 'horizont'
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
 * What the app does, in three lines, at the moment it can finally do it.
 *
 * Deliberately at the end rather than the start: a feature tour before there
 * is any data is a promise, and the same three sentences after the collection
 * has landed are instructions.
 */
const CAN_DO = computed(
  () =>
    [
      { icon: 'kiste', to: '/dig', ...w.value.canDo.dig },
      { icon: 'platte', to: '/im-laden', ...w.value.canDo.inStore },
      { icon: 'regal', to: '/regal', ...w.value.canDo.collection },
    ] as const,
)
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">Fidelity</h1>
      <p class="text-fid-base text-fid-text-muted">
        {{ w.lead }}
      </p>
    </header>

    <!--
      Segments rather than "Schritt 2 von 5". The filled part is the same
      information and takes no words, and the labels underneath say what the
      steps are, which a number never does.
    -->
    <ol v-if="step !== 'start'" class="flex gap-2" aria-label="Einrichtung">
      <li
        v-for="(name, index) in STEPS"
        :key="name"
        class="flex flex-1 flex-col gap-2"
        :aria-current="step === name ? 'step' : undefined"
      >
        <span
          class="h-1 rounded-full transition-colors duration-300"
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
      <Transition name="fid-step" mode="out-in">
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
              class="fid-action self-start rounded-fid-md bg-fid-accent px-6 py-3 text-fid-base font-medium text-fid-on-accent"
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
                class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
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
            class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent"
            @click="sync"
          >
            {{ w.fetchCollection }}
          </button>
        </section>

        <!-- 3 · Horizont ---------------------------------------------------- -->
        <!--
          The horizon was deliberately not in the setup — now it is. Why, in
          `app/i18n/welcome.ts`.

          The argument for leaving it out was that it takes minutes and the app
          works without it. Both are still true. What that argument missed is
          that half of what makes Fidelity interesting is invisible without it:
          another pressing of a record you own, a catalogue series with a hole
          in it, a producer whose name you never see on a sleeve. Somebody who
          finishes the setup and never opens the settings gets a matcher that
          only knows the artists they already own by name.

          So it is a step, and it says how long it takes before it starts, and
          it can be walked past in one click.
        -->
        <section v-else-if="step === 'horizont'" key="horizont" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">
              {{ w.horizon.title }}
            </h2>
            <p class="max-w-prose text-fid-base text-fid-text-muted">
              {{ w.horizon.about }}
            </p>
          </div>

          <HorizonBuild />

          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent"
              @click="step = 'credits'"
            >
              {{ w.horizon.skip }}
            </button>
            <p class="text-fid-xs text-fid-text-muted">
              {{ w.horizon.resumable }}
            </p>
          </div>
        </section>

        <!-- 4 · Credits ----------------------------------------------------- -->
        <section v-else-if="step === 'credits'" key="credits" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">
              {{ w.credits.title }}
            </h2>
            <p class="max-w-prose text-fid-base text-fid-text-muted">
              {{ w.credits.about }}
            </p>
          </div>

          <CreditHarvest />

          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent"
              @click="step = 'fertig'"
            >
              {{ w.credits.skip }}
            </button>
            <p class="text-fid-xs text-fid-text-muted">
              {{ w.credits.later }}
            </p>
          </div>
        </section>

        <!-- 5 · Fertig ------------------------------------------------------ -->
        <section v-else key="fertig" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">{{ w.done.title }}</h2>
            <p v-if="library" class="max-w-prose text-fid-base text-fid-text-muted">
              {{ w.done.summary(count(library.collection), count(library.wantlist)) }}
            </p>
          </div>

          <ul class="flex flex-col gap-3">
            <li
              v-for="(thing, index) in CAN_DO"
              :key="thing.title"
              class="fid-rise flex flex-col gap-2 rounded-fid-md border border-fid-border bg-fid-surface p-4"
              :style="{ '--fid-stagger': index + 1 }"
            >
              <h3 class="flex items-center gap-2 text-fid-base font-medium text-fid-text">
                <FidIcon :name="thing.icon" />
                {{ thing.title }}
              </h3>
              <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ thing.body }}</p>
              <NuxtLink
                :to="thing.to"
                class="fid-action self-start text-fid-sm text-fid-text underline underline-offset-4"
              >
                {{ thing.cta }}
              </NuxtLink>
            </li>
          </ul>

          <NuxtLink
            to="/"
            class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent"
          >
            {{ w.done.toStart }}
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
  </main>
</template>
