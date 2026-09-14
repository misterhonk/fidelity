<script setup lang="ts">
import { LISTEN_NAMES, listenUrl, type ListenService } from '#shared/listen'
import { useAudioPreview, videoId } from '~/composables/useAudioPreview'

/**
 * Hearing a record, on the screen where you decide about it (M31).
 *
 * Two things that look like one and are not, which is the whole reason this is
 * a component and not two lines in each sheet:
 *
 * - **The clips** are YouTube addresses people entered at Discogs, and they
 *   come along free with the lookup the top matches get anyway (ADR-012). They
 *   are the only sound Fidelity has. With the preview switched off they are
 *   links that leave the app; with it on they play right here — which is
 *   exactly the difference ADR-012 draws, and the reason the switch exists.
 * - **The search link** goes to whichever service somebody picked in the
 *   settings. Fidelity cannot know Spotify's id for a record without asking
 *   Spotify, and asking needs an account and a key — so it hands over the
 *   artist and the title, which is what you would type yourself.
 *
 * Because those two can disagree — a Deezer listener still hears YouTube here
 * — the screen says where the sound comes from rather than letting the picker
 * above answer for it.
 */
const m = useMessages()
const { call } = useFidelityWorker()

const props = defineProps<{
  artist: string | null | undefined
  title: string | null | undefined
  /** The clips to offer. Absent on everything outside the enriched top fifty. */
  videos?: { title: string; uri: string }[]
  /**
   * Where to look when the caller has no clips — see `asking` below.
   *
   * Left off by a caller that has already looked itself, which is what the
   * shelf's sheet does: it fetches the whole release detail on open and hands
   * the clips down from there.
   */
  releaseId?: number
}>()

const service = ref<ListenService>('none')

/**
 * Off until somebody switches it on, and that is not a default anybody may
 * change: with this false nothing is ever loaded from Google (ADR-012).
 */
const preview = ref(false)

/*
 * The clips a record has, for a record that came without any.
 *
 * A dig fills `videos[]` for the top fifty and nothing below — those fifty get
 * a `/releases/{id}` anyway, for styles and market figures, and the addresses
 * ride along for free (ADR-012). Open the fifty-first and there was nothing to
 * hear, although the record almost certainly has something.
 *
 * So one lookup, for a record somebody deliberately opened, through the same
 * paced lane and kept for ever after — the bargain the covers and the shelf's
 * own sheet already make. Not a loop over releases: rule 2 is about walking
 * ten thousand of them, and this is one, once, per record on the screen.
 */
const found = ref<{ title: string; uri: string }[] | null>(null)
const asking = ref(false)

onMounted(async () => {
  const prefs = await call('preferences.get', undefined)
  service.value = prefs.listenService
  preview.value = prefs.audioPreview

  if (props.videos?.length || !props.releaseId) return
  asking.value = true
  try {
    const detail = await call('release.detail', { releaseId: props.releaseId })
    found.value = detail?.videos ?? []
  } catch {
    // No clips is a section with less in it, not an error on the screen. The
    // search link beside them is unaffected and is the one that always works.
    found.value = []
  } finally {
    asking.value = false
  }
})

/**
 * Six at most, and one row per *video* rather than per address.
 *
 * Two things went wrong at once on a record with fourteen clips. Discogs
 * stores what people entered, and the same video gets entered twice — once as
 * `youtube.com/watch?v=…` and once as `youtu.be/…`. Counting addresses made
 * that two rows, which reads as "this record has two of these" and is simply
 * not true. Reported on 2026-09-14 as links turning up twice.
 *
 * And the cut: the shelf's sheet has always shown six of them and said so. The
 * find's sheet showed all of them, so the same record looked different
 * depending on which screen you came from — a list of fourteen buries
 * everything under it either way.
 */
const LIMIT = 6

const distinct = computed(() => {
  const all = props.videos?.length ? props.videos : (found.value ?? [])
  const seen = new Set<string>()
  return all.filter((video) => {
    // An address nobody can read an id out of stands for itself: dropping it
    // would hide a clip, and keeping it costs one row.
    const id = videoId(video.uri) ?? video.uri
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
})

const clips = computed(() => distinct.value.slice(0, LIMIT))

const searchAt = computed(() => listenUrl(service.value, props.artist, props.title))

/** The service's own name, or null where none is chosen — the link's label. */
const serviceName = computed(() =>
  service.value === 'none' ? null : LISTEN_NAMES[service.value],
)

/*
 * The frame's place — and until somebody taps, an empty div is all it is.
 *
 * `v-show`, never `v-if`: the element has to exist before the tap, because the
 * player is built into it *by* the tap. And it is only visible while something
 * plays — hung off "has anybody ever tapped" it stayed standing after
 * stopping, showing the last record's still under the next one.
 */
const audio = useAudioPreview()
const mount = useTemplateRef<HTMLElement>('mount')

function playing(uri: string): boolean {
  return audio.playing.value !== null && audio.playing.value === videoId(uri)
}

async function hear(video: { title: string; uri: string }) {
  if (!mount.value) return
  if (playing(video.uri)) {
    audio.stop()
    return
  }
  await audio.play(video.uri, mount.value, video.title)
}

/*
 * A sheet closes and takes this element with it. The frame goes too — and a
 * player whose frame has gone plays nothing and stops nothing, which is the
 * one failure nobody could recover from without reloading the app.
 */
onBeforeUnmount(() => audio.release(mount.value))
</script>

<template>
  <section v-if="clips.length || searchAt || asking" class="flex flex-col gap-2">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="text-fid-sm font-bold text-fid-text">{{ m.listen.title }}</h3>

      <a
        v-if="searchAt && serviceName"
        :href="searchAt"
        target="_blank"
        rel="noopener noreferrer"
        class="fid-action inline-flex items-center gap-1 text-fid-xs text-fid-text-muted hover:text-fid-text"
      >
        {{ m.listen.search(serviceName) }}
        <FidIcon name="external-link" :size="12" />
      </a>
    </div>

    <div v-show="audio.playing.value" class="flex flex-col gap-2">
      <div class="aspect-video w-full overflow-hidden rounded-fid-sm bg-fid-field">
        <div ref="mount" class="size-full"></div>
      </div>
      <p class="text-fid-xs text-fid-text-muted">
        <!-- YouTube's title, not the record's: under a 12" there is sometimes
             an album rip, a live take or a different record altogether. -->
        <span v-if="audio.clip.value">{{ audio.clip.value }} · </span>{{ m.listen.source }}
      </p>
    </div>

    <ul v-if="clips.length" class="flex flex-col gap-1">
      <li v-for="video in clips" :key="video.uri">
        <button
          v-if="preview"
          type="button"
          class="fid-action inline-flex min-h-11 w-full items-center gap-2 text-left text-fid-sm text-fid-text"
          @click="hear(video)"
        >
          <FidIcon :name="playing(video.uri) ? 'square' : 'play'" :size="14" />
          <span class="min-w-0 truncate">{{ video.title || video.uri }}</span>
        </button>

        <!--
          Without the switch, the same clip is a link that leaves the app —
          which is what ADR-012 says happens when nobody has asked for an
          embed, and it reaches Google only when it is tapped.
        -->
        <a
          v-else
          :href="video.uri"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center gap-1 text-fid-sm underline underline-offset-4 hover:text-fid-accent"
        >
          <span class="min-w-0 truncate">{{ video.title || video.uri }}</span>
          <FidIcon name="external-link" :size="12" />
        </a>
      </li>
    </ul>

    <p v-if="distinct.length > clips.length" class="fid-num text-fid-xs text-fid-text-muted">
      {{ m.common.ofTotal(count(clips.length), count(distinct.length)) }}
    </p>

    <!-- Something is happening, and the screen says so rather than sitting empty. -->
    <p v-if="asking" class="text-fid-xs text-fid-text-muted" aria-live="polite">
      {{ m.common.asking }}
    </p>

    <!-- What it could do, for somebody who has never been to the settings. -->
    <p v-if="clips.length && !preview" class="text-fid-xs text-fid-text-muted">
      {{ m.listen.here.lead }}
      <NuxtLink to="/settings/data" class="fid-action underline underline-offset-4">{{
        m.listen.here.link
      }}</NuxtLink>
    </p>
  </section>
</template>
