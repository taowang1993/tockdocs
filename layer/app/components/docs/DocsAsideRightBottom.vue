<script setup lang="ts">
const route = useRoute()

const pageUrl = route.path
const appConfig = useAppConfig()
const { t } = useTockDocsI18n()
const { isEnabled, open } = useAssistant()

const showExplainWithAi = computed(() => {
  return isEnabled.value && appConfig.assistant?.explainWithAi !== false
})

const explainIcon = computed(() => appConfig.assistant?.icons?.explain || appConfig.assistant?.icons?.trigger || 'i-lucide-sparkles')

// Resolve link labels through i18n. Links from app config can use plain strings
// (rendered as-is) or dot-separated i18n keys (resolved via t()).
const localizedLinks = computed(() => {
  const rawLinks = appConfig.toc?.bottom?.links
  if (!rawLinks?.length) return []
  return rawLinks.map(link => ({
    ...link,
    label: t(link.label) ?? link.label,
  }))
})
</script>

<template>
  <div
    v-if="localizedLinks.length || showExplainWithAi"
    class="space-y-6"
  >
    <USeparator type="dashed" />

    <UPageLinks
      v-if="localizedLinks.length"
      :title="appConfig.toc?.bottom?.title || t('docs.links')"
      :links="localizedLinks"
    />

    <USeparator
      v-if="localizedLinks.length && showExplainWithAi"
      type="dashed"
    />

    <UButton
      v-if="showExplainWithAi"
      :icon="explainIcon"
      :label="t('assistant.explainWithAi')"
      size="sm"
      variant="link"
      class="p-0 text-sm"
      color="neutral"
      @click="open(`Explain the page ${pageUrl}`, true)"
    />
  </div>
</template>
