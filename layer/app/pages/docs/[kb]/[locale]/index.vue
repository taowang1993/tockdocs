<script setup lang="ts">
const route = useRoute()
const docs = useTockDocs()

const kb = computed(() => typeof route.params.kb === 'string' ? route.params.kb : undefined)
const homePath = computed(() => docs.getKnowledgeBaseHomePath(kb.value))

if (!kb.value || homePath.value === route.path) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

await navigateTo(homePath.value, {
  redirectCode: 301,
})
</script>

<template>
  <div />
</template>
