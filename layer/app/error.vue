<script setup lang="ts">
import type { NuxtError } from '#app'
import * as nuxtUiLocales from '@nuxt/ui/locale'
import { useTockDocsColorMode } from './composables/useTockDocsColorMode'

const props = defineProps<{
  error: NuxtError
}>()

const { forced: forcedColorMode } = useTockDocsColorMode()
const { locale, t } = useTockDocsI18n()
const { open: contentSearchOpen } = useContentSearch()
const {
  navigationAsyncData,
  navigation,
  searchNavigation,
  searchFiles,
  searchGroups,
  searchPlaceholder,
  searchFuse,
} = useAppContentSearch()

const nuxtUiLocale = computed(() => nuxtUiLocales[locale.value as keyof typeof nuxtUiLocales] || nuxtUiLocales.en)
const lang = computed(() => nuxtUiLocale.value.code)
const dir = computed(() => nuxtUiLocale.value.dir)

useHead({
  htmlAttrs: {
    lang,
    dir,
  },
})

const localizedError = computed(() => {
  return {
    ...props.error,
    statusMessage: t('common.error.title'),
    message: t('common.error.description'),
  }
})

useSeoMeta({
  title: () => t('common.error.title'),
  description: () => t('common.error.description'),
})

provide('navigation', navigation)

await navigationAsyncData

function closeContentSearch() {
  contentSearchOpen.value = false
}
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <AppHeader />

    <UError :error="localizedError" />

    <AppFooter />

    <ClientOnly>
      <div
        v-if="contentSearchOpen"
        data-testid="content-search-overlay"
        class="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[1px]"
        @click="closeContentSearch"
      />

      <LazyUContentSearch
        :files="searchFiles"
        :navigation="searchNavigation"
        :groups="searchGroups"
        :placeholder="searchPlaceholder"
        :fuse="searchFuse"
        :color-mode="!forcedColorMode"
        :modal="false"
        :overlay="false"
        :ui="{ modal: 'z-[61]' }"
      />
    </ClientOnly>
  </UApp>
</template>
