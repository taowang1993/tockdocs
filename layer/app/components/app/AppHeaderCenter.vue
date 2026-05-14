<script setup lang="ts">
import { useHeaderLayout } from '../../composables/useHeaderLayout'

const { showAskAiButton = false } = defineProps<{
  showAskAiButton?: boolean
}>()

const { classes: headerLayout } = useHeaderLayout()
const docs = useTockDocs()

const showSearchButton = computed(() => !docs.isKnowledgeBaseMode.value || docs.isDocsRoute.value || docs.knowledgeBases.value.length > 1)

// Detect the platform and set the correct keyboard shortcut label.
// Default to Mac (⌘) since most developer doc users are on macOS;
// correct on the client after mount for Windows/Linux users.
const kbds = ref(['⌘', 'K'])

onMounted(() => {
  if (import.meta.client) {
    const ua = navigator.userAgent || ''
    const platform = navigator.platform || ''
    const isMac = /Mac|iPhone|iPad|iPod/.test(ua) || /Mac/.test(platform)
    if (!isMac) {
      kbds.value = ['Ctrl', 'K']
    }
  }
})
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-2">
    <UContentSearchButton
      v-if="showSearchButton"
      :collapsed="false"
      :kbds="kbds"
      size="lg"
      class="app-header-center-search min-w-36 flex-1"
    />

    <AskAiButton
      v-if="showAskAiButton"
      :class="headerLayout.desktopAskAiButton"
    />
  </div>
</template>

<style scoped>
@media (max-width: 1149px) {
  .app-header-center-search :deep(kbd) {
    display: none;
  }
}
</style>
