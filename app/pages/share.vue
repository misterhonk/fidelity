<script setup lang="ts">
/**
 * Where Android's share sheet lands (manifest `share_target`, #218).
 *
 * A shop page shared from the browser opens that shop on /dig — checked,
 * never started, the same as a link pasted on Start. Anything else goes to
 * Start, where the paste field is. `replace`, so Back does not return here and
 * bounce forward again.
 */
const route = useRoute()
const name = dealerFromShare(route.query)

await navigateTo(name ? { path: '/shop', query: { dealer: name } } : '/', { replace: true })
</script>

<template>
  <div />
</template>
