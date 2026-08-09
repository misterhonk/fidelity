<script setup lang="ts">
import type { Identity } from '#shared/types'

const emit = defineEmits<{ signedIn: [Identity] }>()

const { call } = useFidelityWorker()

const token = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    emit('signedIn', await call('auth.signIn', { token: token.value }))
    // Not kept a moment longer than the request needs it.
    token.value = ''
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message
        ? cause.message
        : 'Der Token wurde nicht akzeptiert.'
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
          class="text-fid-accent underline underline-offset-4"
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
      <p id="token-hint" class="text-fid-xs text-fid-text-muted">
        Der Token bleibt in der IndexedDB dieses Geräts. Er wird nie geloggt, nie in eine URL
        geschrieben und an niemanden weitergegeben.
      </p>
      <p v-if="error" id="token-error" role="alert" class="text-fid-sm text-fid-sig-scarcity">
        {{ error }}
      </p>
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
