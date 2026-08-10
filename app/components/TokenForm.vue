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
      class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
    >
      {{ busy ? 'Prüfe …' : 'Anmelden' }}
    </button>
  </form>
</template>
