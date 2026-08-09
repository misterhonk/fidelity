<script setup lang="ts">
useSeoMeta({ title: 'Impressum', description: 'Anbieterkennzeichnung.' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-16">
    <NuxtLink class="text-fid-sm text-fid-text-muted underline underline-offset-4" to="/">
      ← Championship
    </NuxtLink>

    <h1 class="text-fid-2xl font-bold text-fid-text">Impressum</h1>

    <!--
      Deliberately left for the operator to fill in. A placeholder address
      would be worse than an empty one: an Impressum is a legal declaration
      about a real person, and inventing its contents is not something a
      generator should do.
    -->
    <p class="text-fid-base text-fid-text-muted">
      Angaben gemäß § 5 DDG. Diese Seite ist noch auszufüllen – siehe
      <span class="font-fid-mono">app/pages/impressum.vue</span>.
    </p>

    <address class="flex flex-col gap-1 text-fid-base text-fid-text not-italic">
      <span>Martin Melcher</span>
      <span class="text-fid-text-muted">[Anschrift]</span>
      <span class="text-fid-text-muted">[E-Mail]</span>
    </address>

    <p class="text-fid-sm text-fid-text-muted">
      Fidelity ist ein privates Werkzeug ohne Gewinnerzielungsabsicht. Es verkauft nichts,
      vermittelt nichts und wickelt keine Zahlungen ab.
    </p>

    <p class="text-fid-sm text-fid-text-muted">
      This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
      Discogs. "Discogs" is a trademark of Zink Media, LLC.
    </p>
  </main>
</template>
