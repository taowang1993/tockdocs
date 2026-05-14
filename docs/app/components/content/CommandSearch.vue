<script setup lang="ts">
const appConfig = useAppConfig()

const src = computed(() => `https://ui.nuxt.com/examples/content-search-example?primary=${appConfig.ui.colors?.primary}&neutral=${appConfig.ui.colors?.neutral}`)
</script>

<template>
  <div data-markdown-ignore>
    <ClientOnly>
      <iframe
        :src="src"
        class="rounded-lg relative h-96 w-full"
      />
    </ClientOnly>
  </div>
</template>
