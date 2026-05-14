<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { useHeaderLayout } from '../../composables/useHeaderLayout'
import { useTockDocsColorMode } from '../../composables/useTockDocsColorMode'
import { useSubNavigation } from '../../composables/useSubNavigation'

const appConfig = useAppConfig()
const docs = useTockDocs()
const { forced: forcedColorMode } = useTockDocsColorMode()

const { isEnabled: isAssistantEnabled, isOpen: aiOpen } = useAssistant()
const { classes: headerLayout, isAssistantDocked: assistantDocked } = useHeaderLayout()
const { subNavigationMode } = useSubNavigation()
const isMobile = useMediaQuery('(max-width: 767px)')
// Standalone ref decoupled from UHeader's internal state so the sidebar
// stays open across client-side navigations (e.g. selector clicks).
const menuOpen = ref(false)

// Push the header right edge left when the TOC sidebar is open on desktop.
const headerStyle = computed(() => ({
  marginRight: menuOpen.value && !isMobile.value ? 'var(--tockdocs-toc-sidebar-width, 352px)' : '0',
}))

// Close the TOC sidebar when the screen grows past lg and the
// left-side TOC (DocsAsideLeftBody) becomes visible.
const isWideNav = useMediaQuery('(min-width: 1024px)')

watch(isWideNav, (value) => {
  if (value) {
    menuOpen.value = false
  }
})

watch(assistantDocked, (value) => {
  if (value) {
    menuOpen.value = false
  }
}, { immediate: true })

const headerMenuUi = computed(() => ({
  center: headerLayout.value.center,
  right: 'flex min-w-0 items-center gap-1 shrink-0',
  overlay: 'hidden',
  content: 'hidden',
}))

const showAskAiButton = computed(() => isAssistantEnabled.value && docs.isDocsRoute.value)
const showSearchButton = computed(() => !docs.isKnowledgeBaseMode.value || docs.isDocsRoute.value || docs.knowledgeBases.value.length > 1)

const links = computed(() => appConfig.github && appConfig.github.url
  ? [
      {
        'icon': 'i-simple-icons-github',
        'to': appConfig.github.url,
        'target': '_blank',
        'aria-label': 'GitHub',
      },
    ]
  : [])
</script>

<template>
  <UHeader
    :ui="headerMenuUi"
    :class="{ 'flex flex-col': subNavigationMode === 'header' }"
    :style="headerStyle"
  >
    <AppHeaderCenter :show-ask-ai-button="showAskAiButton" />

    <template #left>
      <AppHeaderLeft />
    </template>

    <template #right>
      <AppHeaderCTA />

      <UContentSearchButton
        v-if="showSearchButton"
        size="lg"
        :class="headerLayout.searchButton"
      />

      <AskAiButton
        v-if="showAskAiButton"
        mobile
        :class="headerLayout.mobileAskAiButton"
      />

      <ClientOnly v-if="!forcedColorMode">
        <UColorModeButton />

        <template #fallback>
          <div
            aria-hidden="true"
            class="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-neutral-500 dark:text-neutral-400"
          >
            <svg
              class="h-5 w-5 dark:hidden"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="4"
              />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>

            <svg
              class="hidden h-5 w-5 dark:block"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            >
              <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
            </svg>
          </div>
        </template>
      </ClientOnly>

      <template v-if="links?.length">
        <UButton
          v-for="(link, index) of links"
          :key="index"
          class="shrink-0"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
        />
      </template>
    </template>

    <template #toggle>
      <div :class="[headerLayout.drawerOnly, 'shrink-0']">
        <IconMenuToggle
          :open="menuOpen"
          @click="aiOpen ? (aiOpen = false, menuOpen = !menuOpen) : (menuOpen = !menuOpen)"
        />
      </div>
    </template>

    <template
      v-if="subNavigationMode === 'header'"
      #bottom
    >
      <AppHeaderBottom />
    </template>
  </UHeader>

  <AppHeaderMenu v-model="menuOpen" />
</template>
