<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

const { call } = useFidelityWorker()

const url = ref('')
/**
 * One door (M26.3).
 *
 * There were two fields — the shared secret of a hub you run, and the access
 * key of a hub somebody runs for you — and the second confused everybody
 * who had the first: which of them is mine? The answer is in the value. A
 * key starts with `fk1.` and is signed; anything else is a secret. So one
 * field, and the app reads which door it is, stores it in the right place
 * and sends it the right way: a key to hub and catalogue, a secret to the
 * hub alone.
 */
const door = ref('')
const isKey = computed(() => door.value.trim().startsWith('fk1.'))
/** What a key says about itself — tier and validity, read off the string. */
const claims = computed(() => (isKey.value ? decodeAccessKey(door.value.trim()) : null))
const expired = computed(() => claims.value !== null && claims.value.validUntil <= Date.now())
const stored = ref<string | null>(null)
const saved = ref<'door' | 'gone' | null>(null)
const busy = ref(false)
const error = ref<unknown>(null)
/** Whether the door is shown in clear — off on every open, never remembered. */
const doorShown = ref(false)

const status = ref<{
  ok: boolean
  horizon: number
  shipping: number
  secured: boolean
  secret: 'ok' | 'wrong' | 'missing' | 'unchecked'
  key: 'ok' | 'wrong' | 'missing' | 'unchecked'
  doors: ('secret' | 'key')[]
} | null>(null)

const hint = ref<string | null>(null)

onMounted(async () => {
  const preferences = await call('preferences.get', undefined)
  url.value = preferences.hubUrl ?? ''
  door.value = preferences.accessKey ?? preferences.hubSecret ?? ''
  stored.value = door.value || null
  if (url.value) void test()
  else void discover()
})

/**
 * Look whether one is already there — beside the app first, then on this machine.
 *
 * Only from this screen and only while the field is empty — somebody who opened
 * the hub settings is asking exactly this question, and anywhere else it would
 * be an app poking at the local network unasked.
 *
 * Not a stored default. A prefilled `http://localhost:8787` that nobody checked
 * would make every hub call wait two seconds for a machine that was never
 * there, on every device that copied the settings across.
 *
 * **An open hub on the app's own domain is kept without asking.** There is
 * nothing left to decide: it needs no word, it is the same origin, and the
 * alternative is showing somebody a filled-in field and a Save button for a
 * question they already answered by deploying it. One that wants a secret is
 * only filled in — that word cannot be discovered, which is what makes it one.
 */
async function discover() {
  hint.value = null
  busy.value = true

  try {
    const found = await call('hub.discover', undefined)
    if (found.url) {
      url.value = found.url

      if (found.secured) {
        hint.value = st.value.hubPanel.foundSecured
        return
      }

      await call('preferences.set', { hubUrl: found.url, hubSecret: null })
      if (!isKey.value) door.value = ''
      hint.value = st.value.hubPanel.foundAndKept
      void test()
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
    const word = door.value.trim()
    status.value = await call('hub.check', {
      url: url.value,
      secret: isKey.value ? '' : word,
      accessKey: isKey.value ? word : undefined,
    })
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function save() {
  busy.value = true
  error.value = null
  saved.value = null
  try {
    const word = door.value.trim() || null
    await call('preferences.set', {
      hubUrl: url.value.trim() || null,
      hubSecret: word && !isKey.value ? word : null,
      accessKey: word && isKey.value ? word : null,
    })
    stored.value = word
    saved.value = word ? 'door' : 'gone'
    if (url.value.trim()) await test()
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function remove() {
  door.value = ''
  await save()
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
        class="fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />

      <label class="text-fid-sm font-medium text-fid-text" for="hub-door">
        {{ st.hubPanel.door }}
      </label>
      <!--
        Shown on request. A forty-eight-character word typed on a phone
        against dots is a word typed twice; the eye is the same control every
        password field has grown, and the state is in the button, not only in
        the glyph.
      -->
      <div class="flex gap-2">
        <input
          id="hub-door"
          v-model="door"
          :type="doorShown ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          autocapitalize="off"
          class="min-w-0 grow fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
        <button
          type="button"
          class="fid-action flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border border-fid-border text-fid-text-muted hover:text-fid-text"
          :aria-label="doorShown ? st.hubPanel.hideDoor : st.hubPanel.showDoor"
          :aria-pressed="doorShown"
          @click="doorShown = !doorShown"
        >
          <FidIcon :name="doorShown ? 'eye-off' : 'eye'" :size="18" aria-hidden="true" />
        </button>
      </div>
      <!-- What the value is, read before it is saved: a key names its tier, a bad one says so. -->
      <p v-if="isKey && !claims" class="text-fid-sm text-fid-sig-scarcity" aria-live="polite">
        {{ st.accessPanel.notAKey }}
      </p>
      <p v-else-if="claims" class="text-fid-sm text-fid-text" aria-live="polite">
        {{
          st.accessPanel.reads(st.supportPanel.tierName(claims.tier), day(claims.validUntil))
        }}
        <span v-if="expired" class="text-fid-sig-scarcity">
          · {{ st.accessPanel.expired }}</span
        >
      </p>
      <WhyNote>{{ st.hubPanel.notYourToken }}</WhyNote>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
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
      <button
        v-if="stored"
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="remove"
      >
        {{ st.hubPanel.removeDoor }}
      </button>
    </div>

    <p v-if="saved" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ saved === 'door' ? st.accessPanel.saved : st.accessPanel.removed }}
    </p>

    <p v-if="status" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ st.hubPanel.reachable }} · {{ st.hubPanel.horizonEntries(status.horizon) }} ·
      {{ st.hubPanel.shippingTiers(status.shipping) }} ·
      {{ status.secured ? st.hubPanel.secured : st.hubPanel.open }}
      <!--
        And whether the word opens the door. "Reachable" alone said nothing
        about that, and a phone with the wrong secret read it as all fine.
      -->
      <template v-if="status.secret === 'ok'"> · {{ st.hubPanel.secretOk }}</template>
      <span v-else-if="status.secret === 'wrong'" class="text-fid-sig-scarcity">
        · {{ st.hubPanel.secretWrong }}</span
      >
      <span v-else-if="status.secret === 'missing'" class="text-fid-sig-gap">
        · {{ st.hubPanel.secretMissing }}</span
      >
      <!-- The second door, when the hub has one (M22). -->
      <template v-if="status.key === 'ok'"> · {{ st.hubPanel.keyOk }}</template>
      <span v-else-if="status.key === 'wrong'" class="text-fid-sig-scarcity">
        · {{ st.hubPanel.keyWrong }}</span
      >
      <span v-else-if="status.key === 'missing'" class="text-fid-sig-gap">
        · {{ st.hubPanel.keyMissing }}</span
      >
    </p>
  </section>
</template>
