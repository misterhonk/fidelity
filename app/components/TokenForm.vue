<script setup lang="ts">
import type { Identity } from '#shared/types'

const emit = defineEmits<{ signedIn: [Identity] }>()

const { call } = useFidelityWorker()

const token = ref('')
const busy = ref(false)
const error = ref<unknown>(null)

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    emit('signedIn', await call('auth.signIn', { token: token.value }))
    // Not kept a moment longer than the request needs it.
    token.value = ''
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="flex max-w-xl flex-col gap-5" @submit.prevent="submit">
    <div class="flex flex-col gap-2">
      <h2 class="text-fid-xl font-bold text-fid-text">Token eintragen</h2>
      <p class="text-fid-base text-fid-text-muted">
        Fidelity spricht direkt mit Discogs – ohne Server dazwischen. Dafür braucht es einen
        persönlichen Token, den du dir selbst erzeugst.
      </p>
    </div>

    <!--
      Erst das Ergebnis, dann die Frage nach dem Schlüssel.

      This screen asked for the key to somebody's Discogs account and showed
      nothing of what the app does with it — the first result came after a
      token, a sync and a two-minute scan. That is a lot of trust on credit.

      Not a screenshot and not prose about the app: these are its own
      sentences, recomputed from their signals by the real `buildReason` in a
      test, so an example can never quietly become a promise the app no longer
      keeps.
    -->
    <section class="flex flex-col gap-3 rounded-fid-md bg-fid-inset p-4">
      <h3 class="text-fid-sm font-medium text-fid-text">Was dabei herauskommt</h3>
      <ul class="flex flex-col gap-3">
        <li v-for="find in SAMPLE_FINDS" :key="find.reason" class="flex items-baseline gap-3">
          <span class="fid-num shrink-0 text-fid-base font-medium text-fid-text">
            {{ find.score }}
          </span>
          <span class="fid-num shrink-0 text-fid-xs text-fid-text-muted">{{ find.grade }}</span>
          <span class="min-w-0 text-fid-sm text-fid-text-muted">{{ find.reason }}</span>
        </li>
      </ul>
      <p class="text-fid-xs text-fid-text-muted">
        Beispiele. Eine Punktzahl, ein Satz, warum – für jede Platte im Sortiment eines
        Händlers. Mit deiner Sammlung stehen dort deine Künstler und deine Labels.
      </p>
    </section>

    <ol class="flex list-decimal flex-col gap-1 pl-5 text-fid-sm text-fid-text-muted">
      <li>
        <a
          class="fid-action text-fid-accent underline underline-offset-4"
          href="https://www.discogs.com/settings/developers"
          target="_blank"
          rel="noopener noreferrer"
        >
          discogs.com/settings/developers
        </a>
        öffnen
      </li>
      <li>„Generate token“ klicken</li>
      <li>Den Token hier einfügen</li>
    </ol>

    <div class="flex flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="discogs-token">
        Personal Access Token
      </label>
      <input
        id="discogs-token"
        v-model="token"
        type="password"
        autocomplete="off"
        spellcheck="false"
        required
        :aria-invalid="error !== null"
        :aria-describedby="error ? 'token-error' : 'token-hint'"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
      <!--
        Wo er liegt — und was damit passiert.

        This said only where the token is kept, which answers the second
        question somebody has. The first one is "what can this thing do to my
        account?", and a Discogs personal token can do a great deal: it is the
        same key that edits a collection and places an order. Fidelity reads.
        Saying so is the difference between a stranger's app and one somebody
        pastes a key into.
      -->
      <p id="token-hint" class="flex flex-col gap-1 text-fid-xs text-fid-text-muted">
        <span>
          <span class="text-fid-text">Fidelity liest nur.</span> Sammlung, Wantlist und
          Händlersortimente – mehr nicht. Es ändert nichts an deinem Discogs-Konto, kauft nichts
          und schreibt nichts zurück. Gekauft wird bei Discogs, von dir.
        </span>
        <span>
          Der Token bleibt in der IndexedDB dieses Geräts. Er wird nie geloggt, nie in eine URL
          geschrieben und an niemanden weitergegeben.
        </span>
      </p>
      <div v-if="error" id="token-error">
        <ErrorNote :cause="error" :signed-in="false" />
      </div>
    </div>

    <button
      type="submit"
      :disabled="busy || token.length === 0"
      class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent disabled:opacity-50"
    >
      {{ busy ? 'Prüfe …' : 'Anmelden' }}
    </button>
  </form>
</template>
