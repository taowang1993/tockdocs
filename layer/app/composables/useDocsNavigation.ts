import type { ComputedRef, Ref } from 'vue'
import type { ContentNavigationItem, PageCollections } from '@nuxt/content'
import { transformNavigation } from '../utils/navigation'

export function useDocsNavigation(collectionName?: Ref<string> | ComputedRef<string>) {
  const docs = useTockDocs()
  const { locale, isEnabled } = useTockDocsI18n()

  const resolvedCollectionName = computed(() => collectionName?.value || docs.collectionName.value)

  return useAsyncData<ContentNavigationItem[]>(
    () => `navigation_${resolvedCollectionName.value}`,
    () => queryCollectionNavigation(resolvedCollectionName.value as keyof PageCollections),
    {
      transform: (data: ContentNavigationItem[]) => transformNavigation(
        data,
        isEnabled.value,
        locale.value,
        docs.mode.value,
        docs.activeKnowledgeBase.value?.id,
      ),
      watch: [resolvedCollectionName],
    },
  )
}
