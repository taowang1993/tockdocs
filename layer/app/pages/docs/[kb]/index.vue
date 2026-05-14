<script setup lang="ts">
const route = useRoute()
const docs = useTockDocs()

const knowledgeBase = computed(() => {
  const kb = route.params.kb
  return typeof kb === 'string' ? docs.knowledgeBases.value.find(entry => entry.id === kb) : undefined
})

if (!knowledgeBase.value) {
  throw createError({ statusCode: 404, statusMessage: 'Knowledge base not found' })
}

await navigateTo(docs.getKnowledgeBaseHomePath(knowledgeBase.value.id), {
  redirectCode: 301,
})
</script>

<template>
  <div />
</template>
