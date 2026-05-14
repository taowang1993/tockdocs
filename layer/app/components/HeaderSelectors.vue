<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()

const docs = useTockDocs()
const { isEnabled, locales } = useTockDocsI18n()
const showKnowledgeBaseSelect = computed(() => docs.isKnowledgeBaseMode.value && docs.knowledgeBases.value.length > 1 && docs.isDocsRoute.value)
const showLanguageSelect = computed(() => isEnabled.value && locales.value.length > 1 && (!docs.isKnowledgeBaseMode.value || docs.isDocsRoute.value))
</script>

<template>
  <template v-if="showKnowledgeBaseSelect">
    <KnowledgeBaseSelect
      :compact="compact"
      class="min-w-0 shrink"
    />
  </template>
  <template v-if="showLanguageSelect">
    <LanguageSelect
      :compact="compact"
      class="shrink-0"
    />
  </template>
</template>
