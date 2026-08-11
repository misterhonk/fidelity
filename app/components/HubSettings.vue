<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

const { call } = useFidelityWorker()

const url = ref('')
const secret = ref('')
const busy = ref(false)
const error = ref<unknown>(null)
const status = ref<{ ok: boolean; horizon: number; shipping: number; secured: boolean } | null>(
  null,
)

const hint = ref<string | null>(null)

onMounted(async () => {
  const preferences = await call('preferences.get', undefined)
  url.value = preferences.hubUrl ?? ''
  secret.value = preferences.hubSecret ?? ''
  if (url.value) void test()
  else void discover()
})

/**
 * Nachsehen, ob auf diesem Rechner schon einer läuft.
 *
 * Only from this screen and only while the field is empty — somebody who opened
 * the hub settings is asking exactly this question, and anywhere else it would
 * be an app poking at the local network unasked.
 *
 * Not a stored default. A prefilled `http://localhost:8787` that nobody checked
 * would make every hub call wait two seconds for a machine that was never
 * there, on every device that copied the settings across.
 */
async function discover() {
  hint.value = null
  busy.value = true

  try {
    const found = await call('hub.discover', undefined)
    if (found.url) {
      url.value = found.url
      hint.value = st.value.hubPanel.found
      return
    }

    // The difference that matters — the two cases are told apart in the pack,
    // and why they must be is written there.
    hint.value = found.blockedByMixedContent
      ? st.value.hubPanel.blockedByMixedContent
      : st.value.hubPanel.notFound
  } catch {
    hint.value = st.value.hubPanel.searchFailed
  } finally {
    busy.value = false
  }
}

/**
 * Tested before it is saved, and the result is shown rather than assumed.
 *
 * A hub is somebody's spare machine. Typing a URL and getting silence would
 * leave nobody able to tell "saved and working" from "saved and pointing at
 * nothing" — and since a broken hub is invisible by design (rule 8), that
 * distinction has to be made here or nowhere.
 */
async function test() {
  busy.value = true
  error.value = null
  status.value = null

  try {
    status.value = await call('hub.check', { url: url.value, secret: secret.value })
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function save() {
  busy.value = true
  error.value = null
  try {
    await call('preferences.set', {
      hubUrl: url.value.trim() || null,
      hubSecret: secret.value.trim() || null,
    })
    if (url.value.trim()) await test()
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <!--
      What it gives you, not what it does not.

      This said "it can speed things up, it carries nothing (ADR-008)". That is
      the rule this design is built on and it is written for us, not for anybody
      using the app: read cold, "carries nothing" says "it is useless", and an
      ADR number in a sentence somebody is making a decision from is noise.
    -->
    <WhyNote :label="st.hubPanel.whyLabel">{{ st.hubPanel.why }}</WhyNote>

    <p class="text-fid-sm text-fid-text-muted">{{ st.hubPanel.optional }}</p>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="hint" class="max-w-prose text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ hint }}
    </p>

    <div class="flex flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="hub-url">
        {{ st.hubPanel.url }}
      </label>
      <input
        id="hub-url"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="http://localhost:8787"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />

      <label class="text-fid-sm font-medium text-fid-text" for="hub-secret">
        {{ st.hubPanel.secret }}
      </label>
      <input
        id="hub-secret"
        v-model="secret"
        type="password"
        autocomplete="off"
        spellcheck="false"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
      <p class="text-fid-xs text-fid-text-muted">{{ st.hubPanel.notYourToken }}</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="save"
      >
        {{ st.hubPanel.save }}
      </button>
      <button
        type="button"
        :disabled="busy || !url.trim()"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="test"
      >
        {{ st.hubPanel.test }}
      </button>
      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="discover"
      >
        {{ st.hubPanel.discover }}
      </button>
    </div>

    <p v-if="status" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ st.hubPanel.reachable }} · {{ st.hubPanel.horizonEntries(status.horizon) }} ·
      {{ st.hubPanel.shippingTiers(status.shipping) }} ·
      {{ status.secured ? st.hubPanel.secured : st.hubPanel.open }}
    </p>
  </section>
</template>
