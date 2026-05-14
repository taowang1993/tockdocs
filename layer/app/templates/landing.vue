<script setup lang="ts">
import type { Collections } from '@nuxt/content'
import { getLandingCollectionName } from '../../utils/docs'

const route = useRoute()
const runtimeConfig = useRuntimeConfig().public as { tockdocs?: { hasSiteContent?: boolean } }
const { locale, isEnabled } = useTockDocsI18n()
const docs = useTockDocs()
const site = useSiteConfig()
const appConfig = useAppConfig()

type LandingPage = {
  title?: string
  description?: string
  seo?: {
    title?: string
    description?: string
    ogImage?: string
  }
}

const page = ref<LandingPage | null>(null)

if (docs.mode.value === 'kb' && runtimeConfig.tockdocs?.hasSiteContent) {
  const { data } = await useAsyncData('site_landing', () => queryCollection('site' as keyof Collections).path(route.path).first())
  page.value = data.value as LandingPage | null
}
else if (docs.mode.value === 'legacy') {
  const collectionName = computed(() => isEnabled.value ? getLandingCollectionName(locale.value) : getLandingCollectionName())
  const { data } = await useAsyncData(collectionName.value, () => queryCollection(collectionName.value as keyof Collections).path(route.path).first())

  if (!data.value) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  page.value = data.value as LandingPage
}

const title = computed(() => {
  return page.value?.seo?.title || page.value?.title || appConfig.seo?.title || site.name || 'Documentation'
})
const description = computed(() => {
  return page.value?.seo?.description || page.value?.description || appConfig.seo?.description || ''
})

useSeo({
  title,
  description,
  type: 'website',
  ogImage: computed(() => page.value?.seo?.ogImage),
})

if (!page.value?.seo?.ogImage) {
  defineOgImage('Landing', {
    title: title.value?.slice(0, 60),
    description: formatOgDescription(title.value, description.value),
  })
}
</script>

<template>
  <ContentRenderer
    v-if="page"
    :value="page"
  />
  <KnowledgeBaseDirectory v-else-if="docs.isKnowledgeBaseMode" />
</template>
