<script setup lang="ts">
useSeoMeta({ title: 'Impressum', description: 'Anbieterkennzeichnung.' })
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
    <NuxtLink
      class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
      to="/"
    >
      ← Start
    </NuxtLink>

    <h1 class="fid-display text-fid-xl font-bold text-fid-text">Impressum</h1>

    <p class="text-fid-base text-fid-text-muted">Angaben gemäß § 5 DDG.</p>

    <address class="flex flex-col gap-1 text-fid-base text-fid-text not-italic">
      <span>Martin Melcher</span>
      <a
        class="fid-action text-fid-accent underline underline-offset-4"
        href="https://github.com/misterhonk"
        target="_blank"
        rel="noopener noreferrer"
      >
        github.com/misterhonk
      </a>
    </address>

    <!--
      Warum hier keine Anschrift steht.
      Fidelity ist ein privates Projekt ohne Gewinnerzielungsabsicht: es verkauft
      nichts, vermittelt nichts und wickelt keine Zahlungen ab. Erreichbar ist der
      Urheber über GitHub — das ist die Stelle, an der ohnehin jede Frage zu
      diesem Projekt landet.
    -->
    <p class="text-fid-sm text-fid-text-muted">
      Fidelity ist ein privates Werkzeug ohne Gewinnerzielungsabsicht. Es verkauft nichts,
      vermittelt nichts und wickelt keine Zahlungen ab. Kontakt und Fehlermeldungen laufen über
      das Projekt auf GitHub.
    </p>

    <p class="text-fid-sm text-fid-text-muted">
      This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
      Discogs. "Discogs" is a trademark of Zink Media, LLC.
    </p>
  </main>
</template>
