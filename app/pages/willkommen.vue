<script setup lang="ts">
import type { SyncProgress } from '#shared/protocol'
import type { Identity } from '#shared/types'

useSeoMeta({
  title: 'Willkommen',
  description: 'Fidelity einrichten: Token, Sammlung, und was die App damit macht.',
})

/**
 * Die Einrichtung, einmal von vorne bis hinten.
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
 * „Schau es dir an" kommt vor „gib mir deinen Schlüssel".
 *
 * `start` is not a step in the setup and is deliberately not in `STEPS`: it is
 * the page somebody lands on, and the setup is what they choose from it. The
 * progress rail belongs to the three steps that follow, so showing a fourth
 * dot for the page you are standing on would say the demo is something to get
 * through.
 */
type Step = 'start' | 'token' | 'sync' | 'fertig'

const step = ref<Step>('start')
const STEPS: Step[] = ['token', 'sync', 'fertig']
const stepIndex = computed(() => STEPS.indexOf(step.value))

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
    step.value = 'fertig'
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
  const what = p.kind === 'collection' ? 'Sammlung' : 'Wantlist'
  return `${what}: ${number.format(p.stored)} von ${number.format(p.total)}`
})

/**
 * What the app does, in three lines, at the moment it can finally do it.
 *
 * Deliberately at the end rather than the start: a feature tour before there
 * is any data is a promise, and the same three sentences after the collection
 * has landed are instructions.
 */
const CAN_DO = [
  {
    icon: 'kiste',
    title: 'Einen Laden durchgraben',
    body: 'Händlernamen eingeben, Fidelity liest sein Sortiment und sagt dir, was davon zu dir passt – mit einem Satz Begründung pro Treffer.',
    to: '/dig',
    cta: 'Zum Graben',
  },
  {
    icon: 'platte',
    title: 'Im Laden nachschauen',
    body: 'Mit der Platte in der Hand: „Habe ich die schon?" Beantwortet aus dem Gerät, ohne Empfang – Plattenläden sind Keller.',
    to: '/im-laden',
    cta: 'Im Laden',
  },
  {
    icon: 'regal',
    title: 'Deine Sammlung ansehen',
    body: 'Regal, Landkarte und Wantlist. Die Landkarte zeigt, wo deine Sammlung dicht ist und wo Lücken sind.',
    to: '/regal',
    cta: 'Zur Sammlung',
  },
] as const
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">Fidelity</h1>
      <p class="text-fid-base text-fid-text-muted">
        Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.
      </p>
    </header>

    <!--
      Three segments rather than "Schritt 2 von 3". The filled part is the same
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
          {{ name === 'token' ? 'Token' : name === 'sync' ? 'Sammlung' : 'Los geht’s' }}
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
          Der Knopf steht über der Vorführung, nicht darunter.

          Somebody who already knows what this is should not have to scroll
          past a demo to get started, and somebody who does not know finds the
          demo immediately below. The order costs the first group nothing and
          gives the second everything.
        -->
        <section v-if="step === 'start'" key="start" class="flex flex-col gap-8">
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="fid-action self-start rounded-fid-md bg-fid-accent px-6 py-3 text-fid-base font-medium text-fid-n-990"
              @click="step = 'token'"
            >
              Einrichten – mit deiner Sammlung
            </button>
            <p class="max-w-prose text-fid-sm text-fid-text-muted">
              Drei Schritte: ein Token von Discogs, einmal Sammlung und Wantlist holen, fertig.
              Fidelity liest nur und läuft ohne Server – alles bleibt auf diesem Gerät.
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
        <section v-if="step === 'token'" key="token">
          <TokenForm @signed-in="signedIn($event)" />
        </section>

        <!-- 2 · Sammlung --------------------------------------------------- -->
        <section v-else-if="step === 'sync'" key="sync" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">
              Angemeldet als {{ identity?.username }}
            </h2>
            <p class="max-w-prose text-fid-base text-fid-text-muted">
              Jetzt holt Fidelity deine Sammlung und deine Wantlist. Das ist die Grundlage für
              alles Weitere – ohne sie weiß die App nicht, was du magst. Ein paar Sekunden pro
              tausend Platten, danach liegt alles auf diesem Gerät.
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
              {{ syncLabel ?? 'Frage Discogs …' }}
            </p>
          </div>

          <button
            v-else
            type="button"
            class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990"
            @click="sync"
          >
            Sammlung holen
          </button>
        </section>

        <!-- 3 · Los geht's -------------------------------------------------- -->
        <section v-else key="fertig" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h2 class="text-fid-base font-medium text-fid-text">Fertig.</h2>
            <p v-if="library" class="max-w-prose text-fid-base text-fid-text-muted">
              <span class="fid-num text-fid-text">{{ number.format(library.collection) }}</span>
              Platten und
              <span class="fid-num text-fid-text">{{ number.format(library.wantlist) }}</span>
              Wünsche liegen jetzt auf diesem Gerät. Drei Dinge kannst du damit tun:
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

          <!--
            The horizon is not a step here. It costs minutes of somebody's rate
            limit and the app works without it — so it is offered on the start
            screen, where the "Nächster Schritt" card can say what it buys, and
            not smuggled into a setup somebody is trying to finish.
          -->
          <NuxtLink
            to="/"
            class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990"
          >
            Zur Startseite
          </NuxtLink>
        </section>
      </Transition>
    </div>

    <p
      v-if="ready && (step === 'start' || step === 'token')"
      class="text-fid-xs text-fid-text-muted"
    >
      Schon eingerichtet?
      <NuxtLink class="underline underline-offset-4" to="/">Zur Startseite</NuxtLink>
    </p>
  </main>
</template>
