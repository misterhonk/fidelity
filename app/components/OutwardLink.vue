<script setup lang="ts">
/**
 * A link that leaves — and says so before it is clicked.
 *
 * Fidelity and Discogs look the same to a reader: both show a record, a
 * sleeve, a price. So a link has to declare which one it lands on, or every
 * tap is a small gamble — and the answer arrives as a new tab, which is the
 * worst moment to learn it.
 *
 * The arrow was already in three places and missing from five others when
 * somebody asked (2026-08-13). One component, so there is one answer to
 * "what does an outward link look like" instead of four that drift.
 *
 * The icon is decorative; the words beside it carry the name. What a screen
 * reader gets instead is a spoken suffix, because "opens at Discogs" is
 * information, not decoration, and an arrow says nothing out loud.
 *
 * **Not for the two sheets.** Their "View at Discogs" is a button-shaped
 * action carrying those exact words, so it already says where it goes in the
 * loudest way available. This is for links inside a line of text, which is
 * where the two places genuinely looked alike.
 */
const m = useMessages()

withDefaults(
  defineProps<{
    to: string
    /**
     * How loud it is — and the default is not always right.
     *
     * `accent` for a link that *is* the action ("View at Discogs"). `inherit`
     * where the link text is the content itself: a whole wantlist of titles in
     * accent colour turns a list into a row of buttons, and the arrow already
     * carries the message. `muted` for something spent, like a sold listing.
     */
    tone?: 'accent' | 'inherit' | 'muted'
  }>(),
  { tone: 'accent' },
)

const TONES = {
  accent: 'text-fid-accent',
  inherit: 'hover:text-fid-accent',
  muted: 'text-fid-text-muted hover:text-fid-text',
} as const
</script>

<template>
  <a
    :href="to"
    target="_blank"
    rel="noopener noreferrer"
    class="fid-action inline-flex items-center gap-1 underline underline-offset-4"
    :class="TONES[tone]"
  >
    <span class="min-w-0"><slot /></span>
    <span class="sr-only">{{ m.common.opensAtDiscogs }}</span>
    <!--
      Never allowed to wrap onto its own line: an arrow alone under a line of
      text reads as a bullet, not as a mark on the link above it.
    -->
    <FidIcon name="external-link" :size="13" class="shrink-0" aria-hidden="true" />
  </a>
</template>
