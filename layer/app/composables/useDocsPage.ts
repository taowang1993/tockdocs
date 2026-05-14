import type { ComputedRef, Ref } from 'vue'
import type { Collections } from '@nuxt/content'
import type { DocsCollectionItem } from '../types'
import { findPageHeadline } from '@nuxt/content/utils'
import { kebabCase } from 'scule'
import { buildContentSourceFilePath, buildRawContentPath, buildSourceContentPath } from '../../utils/content-source'

export async function useDocsPage(collectionName: Ref<string> | ComputedRef<string>) {
  const route = useRoute()
  const appConfig = useAppConfig()
  const runtimeConfig = useRuntimeConfig()
  const { shouldPushContent: assistantDocked } = useAssistant()
  const routePath = route.path
  const routeKey = kebabCase(routePath)
  const navigationAsyncData = useDocsNavigation(collectionName)
  const { data: navigation } = navigationAsyncData

  const [, { data: page }, { data: surround }] = await Promise.all([
    navigationAsyncData,
    useAsyncData(routeKey, () => queryCollection(collectionName.value as keyof Collections).path(routePath).first() as Promise<DocsCollectionItem | null>),
    useAsyncData(`${routeKey}-surround`, () => {
      return queryCollectionItemSurroundings(collectionName.value as keyof Collections, routePath, {
        fields: ['description'],
      })
    }),
  ])

  if (!page.value) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const title = computed(() => page.value?.seo?.title || page.value?.title)
  const description = computed(() => page.value?.seo?.description || page.value?.description)
  const headline = computed(() => findPageHeadline(navigation.value, routePath))
  const breadcrumbs = computed(() => findPageBreadcrumbs(navigation.value, routePath))

  const github = computed(() => appConfig.github ? appConfig.github : null)
  const rawPath = computed(() => buildRawContentPath(routePath, page.value?.extension))
  const sourcePath = computed(() => buildSourceContentPath(routePath, page.value?.extension))
  const knowledgeBaseSourceDirs = computed<Record<string, string>>(() => {
    if (runtimeConfig.public?.tockdocs?.knowledgeBaseSourceDirs) {
      return runtimeConfig.public.tockdocs.knowledgeBaseSourceDirs
    }

    const knowledgeBases = Array.isArray(runtimeConfig.public?.tockdocs?.knowledgeBases)
      ? runtimeConfig.public.tockdocs.knowledgeBases
      : []

    return Object.fromEntries(knowledgeBases.map(kb => [kb.id, kb.id]))
  })

  const editLink = computed(() => {
    if (!github.value || !page.value) {
      return undefined
    }

    return [
      github.value.url,
      'edit',
      github.value.branch,
      github.value.rootDir,
      buildContentSourceFilePath(page.value.stem, page.value.extension, {
        knowledgeBaseSourceDirs: knowledgeBaseSourceDirs.value,
      }),
    ].filter(Boolean).join('/')
  })

  addPrerenderPath(rawPath.value)

  return {
    page,
    surround,
    title,
    description,
    headline,
    breadcrumbs,
    github,
    editLink,
    rawPath,
    sourcePath,
    assistantDocked,
  }
}
