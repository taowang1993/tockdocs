<script setup lang="ts">
const { compact = false } = defineProps<{
  compact?: boolean
}>()

const route = useRoute()
const popoverOpen = ref(false)
const docs = useTockDocs()
const { locale } = useTockDocsI18n()

const knowledgeBases = computed(() => docs.knowledgeBases.value)
const currentKnowledgeBase = computed(() => docs.activeKnowledgeBase.value)
const currentLabel = computed(() => {
  const kb = currentKnowledgeBase.value
  if (!kb) return 'Knowledge base'
  return kb.titles?.[locale.value] || kb.title
})

function localizedTitle(kb: typeof knowledgeBases.value[number]) {
  return kb.titles?.[locale.value] || kb.title
}

function localizedDescription(kb: typeof knowledgeBases.value[number]) {
  return kb.descriptions?.[locale.value] || kb.description || kb.id
}

watch(() => route.fullPath, () => {
  popoverOpen.value = false
})
</script>

<template>
  <UPopover
    v-model:open="popoverOpen"
    :content="{ align: 'start', sideOffset: 8 }"
  >
    <template #default="{ open }">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :label="currentLabel"
        aria-haspopup="menu"
        :aria-expanded="open"
        :class="[
          compact
            ? 'h-9 rounded-lg bg-default px-2 text-sm font-medium shadow-none ring ring-inset ring-transparent transition-colors hover:text-highlighted hover:ring-default focus-visible:ring-default'
            : 'h-9 rounded-lg bg-default px-2.5 text-sm font-medium shadow-none ring ring-inset ring-transparent transition-colors hover:text-highlighted hover:ring-default focus-visible:ring-default',
          open ? 'text-highlighted ring-default' : 'text-default',
        ]"
        :ui="{ label: compact ? 'truncate max-w-20 sm:max-w-24' : 'truncate max-w-24 sm:max-w-32' }"
      >
        <template #trailing>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-3.5 shrink-0 transition-transform duration-200 ease-out"
            :class="open ? 'rotate-180' : 'rotate-0'"
          />
        </template>
      </UButton>
    </template>

    <template #content>
      <div class="flex w-56 max-w-[calc(100vw-1rem)] flex-col gap-1 px-1 py-1">
        <NuxtLink
          v-for="knowledgeBase in knowledgeBases"
          :key="knowledgeBase.id"
          :to="docs.switchKnowledgeBasePath(knowledgeBase.id)"
          class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-elevated hover:text-highlighted"
          :class="knowledgeBase.id === currentKnowledgeBase?.id ? 'bg-elevated font-medium text-highlighted' : 'text-muted'"
          :aria-current="knowledgeBase.id === currentKnowledgeBase?.id ? 'page' : undefined"
          @click="popoverOpen = false"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">
              {{ localizedTitle(knowledgeBase) }}
            </div>
            <div class="truncate text-xs text-dimmed">
              {{ localizedDescription(knowledgeBase) }}
            </div>
          </div>

          <UIcon
            v-if="knowledgeBase.id === currentKnowledgeBase?.id"
            name="i-lucide-check"
            class="size-4 shrink-0 text-primary"
          />
        </NuxtLink>
      </div>
    </template>
  </UPopover>
</template>
