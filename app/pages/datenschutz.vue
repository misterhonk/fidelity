<script setup lang="ts">
useSeoMeta({
  title: 'Datenschutz',
  description: 'Was Fidelity speichert – und wo. Kurz, weil es kurz ist.',
})
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
    <NuxtLink
      class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
      to="/"
    >
      ← Start
    </NuxtLink>

    <h1 class="fid-display text-fid-xl font-bold text-fid-text">Datenschutz</h1>

    <!--
      docs/09 §3: there is no server, so there is almost nothing to declare.
      The honest version of that is a short page, not a long one that pretends
      otherwise.
    -->
    <p class="text-fid-base text-fid-text">
      Fidelity hat keinen Server. Es gibt keine Stelle, an der deine Daten verarbeitet werden
      könnten – alles liegt in der Datenbank deines Browsers und verlässt dieses Gerät nicht.
    </p>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">Was auf deinem Gerät liegt</h2>
      <ul class="flex list-disc flex-col gap-1 pl-5 text-fid-base text-fid-text-muted">
        <li>Dein Discogs Personal Access Token</li>
        <li>Deine Sammlung und Wantlist, so wie Discogs sie herausgibt</li>
        <li>Der Horizont: Release-IDs und Kanten, keine Titel und keine Bilder</li>
        <li>Die letzten fünf Digs mit ihren Treffern</li>
        <li>Korb, Bewertungen und Versandstaffeln, die du eingetragen hast</li>
      </ul>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">Wohin Verbindungen gehen</h2>
      <p class="text-fid-base text-fid-text-muted">
        Ausschließlich zu <span class="font-fid-mono">api.discogs.com</span> und zu
        <span class="font-fid-mono">i.discogs.com</span> für die Cover. Dein Token geht dabei an
        Discogs, an sonst niemanden. Kein Analytics, keine Fonts von fremden Servern, keine
        Fehler-Berichte.
      </p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">Marktplatzdaten</h2>
      <p class="text-fid-base text-fid-text-muted">
        Preise und Zustände werden sechs Stunden nach einem Dig gelöscht – so schreiben es die
        Nutzungsbedingungen von Discogs vor. Was bleibt, sind Scores und Begründungen, die auf
        diesem Gerät entstanden sind.
      </p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">Löschen</h2>
      <p class="text-fid-base text-fid-text-muted">
        „Alles löschen" auf der Startseite entfernt die Datenbank vollständig, Token
        eingeschlossen. Es gibt keine Kopie irgendwo anders, die danach noch übrig wäre.
      </p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">Verantwortlich</h2>
      <p class="text-fid-base text-fid-text-muted">
        Siehe
        <NuxtLink class="underline underline-offset-4" to="/impressum">Impressum</NuxtLink>.
      </p>
    </section>
  </main>
</template>
