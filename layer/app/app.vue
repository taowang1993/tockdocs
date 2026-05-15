<script setup lang="ts">
import * as nuxtUiLocales from '@nuxt/ui/locale'
import { useTockDocsColorMode } from './composables/useTockDocsColorMode'
import { useSubNavigation } from './composables/useSubNavigation'

const appConfig = useAppConfig()
const { seo } = appConfig
const { forced: forcedColorMode } = useTockDocsColorMode()
const site = useSiteConfig()
const { locale } = useTockDocsI18n()
const docs = useTockDocs()
const { isEnabled: isAssistantEnabled, isResizing: isAssistantResizing, panelWidth: assistantPanelWidth, shouldPushContent } = useAssistant()
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

const uiLocaleKey = computed(() => {
  const code = locale.value
  if (code === 'zh') return 'zh_cn'
  return code
})
const nuxtUiLocale = computed(() => nuxtUiLocales[uiLocaleKey.value as keyof typeof nuxtUiLocales] || nuxtUiLocales.en)
const lang = computed(() => nuxtUiLocale.value.code)
const dir = computed(() => nuxtUiLocale.value.dir)
const faviconUrl = computed(() => appConfig.header?.logo?.favicon || '/favicon.svg')
const faviconType = computed(() => /\.svg(?:[?#]|$)/i.test(faviconUrl.value) ? 'image/svg+xml' : 'image/x-icon')
const themeAwareFavicons = useState('tockdocs-theme-favicons', () => ({
  dark: false,
  light: false,
}))

if (import.meta.server) {
  const { findExistingPublicAsset } = await import('../utils/public-assets.server')

  themeAwareFavicons.value = {
    dark: Boolean(await findExistingPublicAsset('/favicon-dark.svg')),
    light: Boolean(await findExistingPublicAsset('/favicon-light.svg')),
  }
}

const faviconLinks = computed(() => {
  const links: Array<{ key: string, rel: string, href: string, type: string, media?: string, sizes?: string }> = []

  if (themeAwareFavicons.value.dark) {
    links.push({
      key: 'favicon-dark',
      rel: 'icon',
      href: '/favicon-dark.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: light)',
      sizes: 'any',
    })
  }

  if (themeAwareFavicons.value.light) {
    links.push({
      key: 'favicon-light',
      rel: 'icon',
      href: '/favicon-light.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: dark)',
      sizes: 'any',
    })
  }

  links.push({
    key: 'favicon',
    rel: 'icon',
    href: faviconUrl.value,
    type: faviconType.value,
    sizes: faviconType.value === 'image/svg+xml' ? 'any' : undefined,
  })

  return links
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: faviconLinks,
  htmlAttrs: {
    lang,
    dir,
  },
})

useSeoMeta({
  titleTemplate: seo.titleTemplate,
  title: seo.title,
  description: seo.description,
  ogSiteName: site.name,
  twitterCard: 'summary_large_image',
})

provide('navigation', navigation)

await navigationAsyncData

const { subNavigationMode } = useSubNavigation(navigation)
const showAssistantUi = computed(() => isAssistantEnabled.value && docs.isDocsRoute.value)

function closeContentSearch() {
  contentSearchOpen.value = false
}
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <ClientOnly>
      <NuxtLoadingIndicator color="var(--ui-primary)" />
    </ClientOnly>

    <AgentDocsHint />

    <div
      :class="[
        'will-change-[margin-right]',
        isAssistantResizing ? 'transition-none' : 'transition-[margin-right] duration-200 ease-linear',
        { 'tockdocs-sub-header': subNavigationMode === 'header' },
      ]"
      :style="{ marginRight: shouldPushContent ? `${assistantPanelWidth}px` : '0' }"
    >
      <div
        v-if="$route.meta.header !== false"
        data-markdown-ignore
      >
        <AppHeader />
      </div>

      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>

      <div
        v-if="$route.meta.footer !== false"
        data-markdown-ignore
      >
        <AppFooter />
      </div>
    </div>

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
      <template v-if="showAssistantUi">
        <LazyAssistantPanel />
        <LazyAssistantFloatingInput />
      </template>
    </ClientOnly>
  </UApp>
</template>

<style>
@media (min-width: 1024px) {
  .tockdocs-sub-header {
    --ui-header-height: 112px;
  }
}
</style>
