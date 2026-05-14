<script setup lang="ts">
const site = useSiteConfig()
const appConfig = useAppConfig()
const docs = useTockDocs()
const { locale } = useTockDocsI18n()

const entries = computed(() => docs.knowledgeBases.value.map(knowledgeBase => ({
  ...knowledgeBase,
  to: docs.getKnowledgeBaseHomePath(knowledgeBase.id),
})))

const title = computed(() => appConfig.seo?.title || site.name || 'Knowledge base directory')
const description = computed(() => appConfig.seo?.description || 'Browse the available knowledge bases.')

function localizedTitle(kb: typeof entries.value[number]) {
  return kb.titles?.[locale.value] || kb.title
}

function localizedDescription(kb: typeof entries.value[number]) {
  return kb.descriptions?.[locale.value] || kb.description || ''
}

function formatBadgeLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
    <UPageHero
      :title="title"
      :description="description"
      :ui="{ container: 'py-16 sm:py-24 lg:py-28 gap-16 sm:gap-y-24' }"
      class="border-b border-default pb-8"
    />

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <UPageCard
        v-for="entry in entries"
        :key="entry.id"
        :to="entry.to"
        :icon="entry.icon"
        :title="localizedTitle(entry)"
        :description="localizedDescription(entry) || 'Open this knowledge base.'"
        :ui="{
          wrapper: 'flex min-w-0 flex-1 flex-col items-start',
          body: 'flex-1',
          footer: 'mt-auto pt-6',
        }"
        spotlight
        class="h-full"
      >
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UBadge
              color="neutral"
              variant="soft"
              size="md"
            >
              {{ formatBadgeLabel(entry.id) }}
            </UBadge>
            <UBadge
              v-for="loc in entry.locales"
              :key="`${entry.id}-${loc}`"
              color="neutral"
              variant="subtle"
              size="md"
            >
              {{ loc.toUpperCase() }}
            </UBadge>
          </div>
        </template>
      </UPageCard>
    </div>
  </div>
</template>
