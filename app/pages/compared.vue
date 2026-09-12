<script setup lang="ts">
import { useComparedMessages } from '~/i18n/compared'

const c = useComparedMessages()

useSeoMeta({ title: () => c.value.title, description: () => c.value.description })
</script>

<template>
  <main class="fid-page py-16">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <NuxtLink
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        to="/"
      >
        {{ c.back }}
      </NuxtLink>

      <header class="flex flex-col gap-3">
        <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.title }}</h1>
        <p class="text-fid-base font-medium text-fid-text">{{ c.sentence }}</p>
        <p class="max-w-prose text-fid-base text-fid-text-muted">{{ c.sentenceAbout }}</p>
      </header>

      <section class="flex flex-col gap-2">
        <h2 class="text-fid-base font-medium text-fid-text">{{ c.notTitle }}</h2>
        <p class="max-w-prose text-fid-base text-fid-text-muted">{{ c.not }}</p>
      </section>

      <!--
        A list rather than the three-column table `docs/15` has. On a phone a
        table with two paragraphs per cell is a horizontal scroll, and the
        comparison reads just as well one app at a time: what it does, and
        what Fidelity does instead.
      -->
      <section class="flex flex-col gap-3">
        <h2 class="text-fid-base font-medium text-fid-text">{{ c.sideBySide }}</h2>
        <ul class="flex flex-col gap-3">
          <li
            v-for="row in c.rows"
            :key="row.name"
            class="flex flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4"
          >
            <h3
              class="flex flex-wrap items-baseline gap-x-2 text-fid-base font-medium text-fid-text"
            >
              {{ row.name }}
              <span v-if="row.since" class="text-fid-xs font-normal text-fid-text-muted">
                {{ row.since }}
              </span>
            </h3>
            <dl class="grid gap-3 @md:grid-cols-2">
              <div class="flex flex-col gap-1">
                <dt class="text-fid-xs font-medium tracking-wide text-fid-text-muted uppercase">
                  {{ c.theyDo }}
                </dt>
                <dd class="text-fid-sm text-fid-text-muted">{{ row.does }}</dd>
              </div>
              <div class="flex flex-col gap-1">
                <dt class="text-fid-xs font-medium tracking-wide text-fid-text-muted uppercase">
                  {{ c.instead }}
                </dt>
                <dd class="text-fid-sm text-fid-text">{{ row.fidelity }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-fid-base font-medium text-fid-text">{{ c.whyTitle }}</h2>
        <p class="max-w-prose text-fid-base text-fid-text-muted">{{ c.whyLead }}</p>
        <ul class="flex flex-col gap-2">
          <li v-for="point in c.why" :key="point.name" class="max-w-prose text-fid-base">
            <span class="font-medium text-fid-text">{{ point.name }}</span>
            <span class="text-fid-text-muted"> {{ point.body }}</span>
          </li>
        </ul>
        <p class="max-w-prose text-fid-base text-fid-text-muted">{{ c.refuses }}</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-fid-base font-medium text-fid-text">{{ c.whereTitle }}</h2>
        <ul class="flex flex-col gap-1">
          <li v-for="link in c.where" :key="link.href">
            <a
              class="fid-action text-fid-base text-fid-accent underline underline-offset-4"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.name }}
            </a>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-fid-sm font-medium text-fid-text">{{ c.sourcesTitle }}</h2>
        <p class="max-w-prose text-fid-xs text-fid-text-muted">
          {{ c.sourcesLead }}
          <template v-for="(source, index) in c.sources" :key="source.href">
            <a
              class="underline underline-offset-4"
              :href="source.href"
              target="_blank"
              rel="noopener noreferrer"
              >{{ source.name }}</a
            ><template v-if="index < c.sources.length - 1">, </template>
          </template>
        </p>
      </section>
    </div>
  </main>
</template>
