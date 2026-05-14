<script setup lang="ts">
import { useSubNavigation } from '../../composables/useSubNavigation'
import type { DocsCollectionItem } from '../../types'
import type { ContentTocLink } from '@nuxt/ui'

const props = defineProps<{
  page?: DocsCollectionItem | null
}>()

function sanitizeTocLinks(links: ContentTocLink[] = []): ContentTocLink[] {
  return links.flatMap((link) => {
    const id = link.id?.trim()
    const children = sanitizeTocLinks(link.children || [])

    if (!id) {
      return children
    }

    return [{
      ...link,
      id,
      children,
    }]
  })
}

const links = computed(() => sanitizeTocLinks((props.page?.body?.toc?.links || []) as ContentTocLink[]))

const { subNavigationMode } = useSubNavigation()
const appConfig = useAppConfig()
const { t } = useTockDocsI18n()

const contentTocVariants = useUIConfig('contentToc')
</script>

<template>
  <div data-markdown-ignore>
    <UContentToc
      v-if="links.length"
      :highlight="contentTocVariants.highlight ?? true"
      :highlight-color="contentTocVariants.highlightColor"
      :highlight-variant="contentTocVariants.highlightVariant"
      :color="contentTocVariants.color"
      :title="appConfig.toc?.title || t('docs.toc')"
      :links="links"
      :class="{ 'hidden lg:block': subNavigationMode }"
    >
      <template #bottom>
        <DocsAsideRightBottom />
      </template>
    </UContentToc>

    <DocsAsideMobileBar :links="links" />
  </div>
</template>
