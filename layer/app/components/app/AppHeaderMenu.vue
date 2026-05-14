<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { useMediaQuery } from '@vueuse/core'

const isOpen = defineModel<boolean>({ required: true })
const isMobile = useMediaQuery('(max-width: 767px)')

// TOC
const route = useRoute()
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation', ref([]))
const navigationKey = computed(() => `${route.path}:${navigation.value?.map(item => item.path).join('|') || 'navigation-empty'}`)
const contentNavVariants = useUIConfig('contentNavigation')

function close() {
  isOpen.value = false
}
</script>

<template>
  <!-- Mobile: Nuxt UI Slideover -->
  <USlideover
    v-if="isMobile"
    v-model:open="isOpen"
    side="right"
    :ui="{ content: 'ring-0 bg-default' }"
  >
    <template #content>
      <div class="flex h-full flex-col">
        <!-- Header: selectors + close -->
        <div class="flex h-16 shrink-0 items-center gap-2 border-b border-default px-4">
          <HeaderSelectors compact />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            class="ml-auto shrink-0 text-muted hover:text-highlighted"
            @click="close"
          />
        </div>
        <!-- Body: TOC -->
        <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <UContentNavigation
            :key="navigationKey"
            :highlight="contentNavVariants.highlight ?? true"
            :highlight-color="contentNavVariants.highlightColor"
            :variant="contentNavVariants.variant ?? 'link'"
            :color="contentNavVariants.color"
            :navigation="navigation"
          />
        </div>
      </div>
    </template>
  </USlideover>

  <!-- Desktop: sidebar matching AI sidebar shell -->
  <aside
    v-else
    :class="[
      'left-auto! fixed top-0 z-50 h-dvh overflow-hidden border-l border-default bg-default/95 backdrop-blur-xl',
      'transition-[right] duration-200 ease-linear',
    ]"
    :style="{
      width: '352px',
      right: isOpen ? '0' : '-352px',
    }"
  >
    <div class="flex h-full flex-col">
      <!-- Header: selectors + close -->
      <div class="flex h-16 shrink-0 items-center gap-2 border-b border-default px-4">
        <HeaderSelectors compact />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="ml-auto shrink-0 text-muted hover:text-highlighted"
          @click="close"
        />
      </div>
      <!-- Body: TOC -->
      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <UContentNavigation
          :key="navigationKey"
          :highlight="contentNavVariants.highlight ?? true"
          :highlight-color="contentNavVariants.highlightColor"
          :variant="contentNavVariants.variant ?? 'link'"
          :color="contentNavVariants.color"
          :navigation="navigation"
        />
      </div>
    </div>
  </aside>
</template>
