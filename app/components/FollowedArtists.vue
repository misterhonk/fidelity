<script setup lang="ts">
import type { ArtistHit } from '~~/worker/followed'
import type { FollowedArtist } from '#shared/types'
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const { call } = useFidelityWorker()

const followed = shallowRef<FollowedArtist[]>([])
const query = ref('')
const hits = shallowRef<ArtistHit[]>([])
const searched = ref(false)
const busy = ref(false)
const error = ref<unknown>(null)

onMounted(async () => {
  try {
    followed.value = await call('followed.list', undefined)
  } catch (cause) {
    error.value = cause
  }
})

/*
 * Searched on submit, never as you type.
 *
 * One request per keystroke would be six requests to spell "Exit N" — out of
 * a budget of sixty a minute, shared with the dig somebody is waiting for
 * (rule 3). A field and a button spend one.
 */
async function search() {
  if (busy.value || query.value.trim().length === 0) return
  busy.value = true
  error.value = null

  try {
    hits.value = await call('followed.search', { query: query.value })
    searched.value = true
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function add(hit: ArtistHit) {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    followed.value = await call('followed.add', { artistId: hit.artistId, name: hit.name })
    // The row stays in the result list and goes quiet, rather than vanishing
    // under the finger that tapped it.
    hits.value = hits.value.map((row) =>
      row.artistId === hit.artistId ? { ...row, known: true } : row,
    )
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function remove(artistId: number) {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    followed.value = await call('followed.remove', { artistId })
    hits.value = hits.value.map((row) =>
      row.artistId === artistId ? { ...row, known: false } : row,
    )
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.library.radar.lead }}</p>

    <ul v-if="followed.length > 0" class="flex flex-col gap-1">
      <li
        v-for="artist in followed"
        :key="artist.artistId"
        class="flex items-center justify-between gap-3 border-b border-fid-border py-2 last:border-0"
      >
        <span class="text-fid-base text-fid-text">{{ artist.name }}</span>
        <button
          type="button"
          :disabled="busy"
          class="fid-action shrink-0 rounded-fid-sm border border-fid-border px-3 py-1 text-fid-sm text-fid-text-muted disabled:opacity-50"
          @click="remove(artist.artistId)"
        >
          {{ st.library.radar.remove }}
        </button>
      </li>
    </ul>
    <p v-else class="text-fid-sm text-fid-text-muted">{{ st.library.radar.empty }}</p>

    <!--
      What the list is worth depends on the horizon.

      A followed band whose discography has never been expanded is a name and
      nothing more: the engine then knows only the exact spelling on the
      listing. The horizon card is the next one down this page, and the
      sentence says so rather than leaving somebody to work it out.
    -->
    <p v-if="followed.length > 0" class="max-w-prose text-fid-sm text-fid-text-muted">
      {{ st.library.radar.needsHorizon }}
      <a href="#horizon" class="text-fid-accent underline underline-offset-4">
        {{ st.library.radar.toHorizon }}
      </a>
    </p>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="search">
      <div class="flex min-w-56 grow flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="radar-search">
          {{ st.library.radar.searchLabel }}
        </label>
        <input
          id="radar-search"
          v-model="query"
          type="text"
          autocomplete="off"
          :placeholder="st.library.radar.searchPlaceholder"
          class="fid-field px-3 py-2 text-fid-sm text-fid-text"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || query.trim().length === 0"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      >
        {{ st.library.radar.search }}
      </button>
    </form>

    <ErrorNote v-if="error" :cause="error" />

    <ul v-if="hits.length > 0" class="flex flex-col gap-1">
      <li
        v-for="hit in hits"
        :key="hit.artistId"
        class="flex items-center justify-between gap-3 border-b border-fid-border py-2 last:border-0"
      >
        <span class="text-fid-base text-fid-text">{{ hit.name }}</span>
        <button
          type="button"
          :disabled="busy || hit.known"
          class="fid-action shrink-0 rounded-fid-sm border border-fid-border px-3 py-1 text-fid-sm text-fid-text disabled:opacity-50"
          @click="add(hit)"
        >
          {{ hit.known ? st.library.radar.onIt : st.library.radar.add }}
        </button>
      </li>
    </ul>
    <p v-else-if="searched && !busy" class="text-fid-sm text-fid-text-muted">
      {{ st.library.radar.noHits }}
    </p>
  </section>
</template>
