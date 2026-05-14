<script setup lang="ts">
// This page exists solely to prevent Vue Router "No match found" warnings
// for static-file paths (llms.txt, llms-full.txt, sitemaps, etc.) that are
// actually served by Nitro server handlers.  Vue Router emits the warning
// during route resolution, which runs before beforeEach guards — so the
// only way to suppress it is to give the router a matching route.
//
// The page immediately does an external redirect, which triggers a full
// page load that hits the Nitro handler directly.

// Prevent i18n from creating locale-prefixed variants of these static-file
// routes (e.g. /en/llms-full.txt).  These files are always at the root.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
definePageMeta({ i18n: false } as any)

// Redirect to the real Nitro handler (302 on server, window.location on client)
await navigateTo(useRoute().path, { external: true, redirectCode: 302 })
</script>

<template>
  <div />
</template>
