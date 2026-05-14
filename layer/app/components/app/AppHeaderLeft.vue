<script setup lang="ts">
import { useHeaderLayout } from '../../composables/useHeaderLayout'

const appConfig = useAppConfig()
const site = useSiteConfig()
const { isEnabled, locales, localePath } = useTockDocsI18n()
const docs = useTockDocs()
const { isAssistantDocked, classes: headerLayout } = useHeaderLayout()

const brandName = computed(() => appConfig.header?.title || site.name || '')
const homePath = computed(() => docs.isKnowledgeBaseMode.value ? '/' : localePath('/'))
const showKnowledgeBaseSelect = computed(() => docs.isKnowledgeBaseMode.value && docs.knowledgeBases.value.length > 1 && docs.isDocsRoute.value)
const showLanguageSelect = computed(() => isEnabled.value && locales.value.length > 1 && (!docs.isKnowledgeBaseMode.value || docs.isDocsRoute.value))
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
    <NuxtLink
      :to="homePath"
      :aria-label="brandName"
      class="flex min-w-0 shrink items-center gap-2.5 sm:gap-3"
    >
      <AppHeaderLogo />
      <span class="min-w-0 truncate text-xl font-bold">
        {{ brandName }}
      </span>
    </NuxtLink>

    <div
      v-if="showKnowledgeBaseSelect || showLanguageSelect"
      :class="headerLayout.headerSelectors"
    >
      <HeaderSelectors :compact="isAssistantDocked" />
    </div>
  </div>
</template>
