import type { ContentNavigationItem, PageCollections } from '@nuxt/content'
import { transformNavigation } from '../utils/navigation'

export function useAppContentSearch() {
  const docs = useTockDocs()
  const { locale, isEnabled, t } = useTockDocsI18n()

  const showKnowledgeBaseDirectorySearch = computed(() => docs.isKnowledgeBaseMode.value && !docs.isDocsRoute.value)
  const docsSearchCollectionName = computed(() => showKnowledgeBaseDirectorySearch.value ? undefined : docs.collectionName.value)

  const navigationAsyncData = useAsyncData<ContentNavigationItem[]>(
    () => docsSearchCollectionName.value ? `app-nav_${docsSearchCollectionName.value}` : 'navigation_knowledge_bases',
    () => docsSearchCollectionName.value
      ? queryCollectionNavigation(docsSearchCollectionName.value as keyof PageCollections)
      : Promise.resolve([]),
    {
      transform: (data: ContentNavigationItem[]) =>
        docsSearchCollectionName.value
          ? transformNavigation(
              data,
              isEnabled.value,
              locale.value,
              docs.mode.value,
              docs.activeKnowledgeBase.value?.id,
            )
          : data,
      watch: [docsSearchCollectionName],
    },
  )

  const { data: navigation } = navigationAsyncData

  const { data: files } = useLazyAsyncData(
    () => docsSearchCollectionName.value ? `search_${docsSearchCollectionName.value}` : 'search_knowledge_bases',
    () => docsSearchCollectionName.value
      ? queryCollectionSearchSections(docsSearchCollectionName.value as keyof PageCollections)
      : Promise.resolve([]),
    {
      server: false,
      watch: [docsSearchCollectionName],
    },
  )

  const searchGroups = computed(() => {
    if (!showKnowledgeBaseDirectorySearch.value) {
      return []
    }

    return [
      {
        id: 'knowledge-bases',
        label: t('search.knowledgeBases'),
        items: docs.knowledgeBases.value.map(knowledgeBase => ({
          label: knowledgeBase.titles?.[locale.value] || knowledgeBase.title,
          suffix: knowledgeBase.descriptions?.[locale.value] || knowledgeBase.description || knowledgeBase.id,
          to: docs.getKnowledgeBaseHomePath(knowledgeBase.id),
          icon: knowledgeBase.icon,
        })),
      },
    ]
  })

  const searchPlaceholder = computed(() => {
    if (showKnowledgeBaseDirectorySearch.value) {
      return t('search.knowledgeBasesPlaceholder')
    }

    return docs.activeKnowledgeBase.value?.searchPlaceholder
  })

  const searchFuse = computed(() => {
    if (!showKnowledgeBaseDirectorySearch.value) {
      return undefined
    }

    return {
      resultLimit: Math.max(12, docs.knowledgeBases.value.length),
    }
  })

  const searchNavigation = computed(() => showKnowledgeBaseDirectorySearch.value ? undefined : navigation.value)
  const searchFiles = computed(() => showKnowledgeBaseDirectorySearch.value ? undefined : files.value)

  return {
    navigationAsyncData,
    navigation,
    searchNavigation,
    searchFiles,
    searchGroups,
    searchPlaceholder,
    searchFuse,
  }
}
