import {
  buildDocsPath,
  getDefaultKnowledgeBase,
  getDocsCollectionName,
  getDocsMode,
  getKnowledgeBase,
  getKnowledgeBaseEntrySlug,
  getKnowledgeBases,
  resolveDocsRoute,
  resolveKnowledgeBaseLocale,
  switchKnowledgeBaseInPath,
  switchLocaleInPath,
} from '../../utils/docs'

export const useTockDocs = () => {
  const route = useRoute()
  const config = useRuntimeConfig().public as Parameters<typeof getDocsMode>[0]

  const mode = computed(() => getDocsMode(config))
  const knowledgeBases = computed(() => getKnowledgeBases(config))
  const defaultKnowledgeBase = computed(() => getDefaultKnowledgeBase(config))
  const resolvedRoute = computed(() => resolveDocsRoute(route.path, config))
  const isKnowledgeBaseMode = computed(() => mode.value === 'kb')
  const isDocsRoute = computed(() => resolvedRoute.value.isDocsRoute)
  const activeKnowledgeBase = computed(() => getKnowledgeBase(config, resolvedRoute.value.kb))
  const activeLocale = computed(() => {
    if (resolvedRoute.value.mode === 'kb') {
      return resolveKnowledgeBaseLocale(config, activeKnowledgeBase.value?.id, resolvedRoute.value.locale)
    }

    return resolvedRoute.value.locale || config.i18n?.defaultLocale || 'en'
  })
  const collectionName = computed(() => {
    return resolvedRoute.value.collectionName
      || (activeKnowledgeBase.value
        ? getDocsCollectionName({
            mode: 'kb',
            kb: activeKnowledgeBase.value.id,
            locale: activeLocale.value,
          })
        : 'docs')
  })
  const currentSlug = computed(() => resolvedRoute.value.slug)

  function withHash(path: string) {
    return `${path}${route.hash || ''}`
  }

  function getKnowledgeBaseHomePath(kbId?: string) {
    const knowledgeBase = getKnowledgeBase(config, kbId)

    if (!knowledgeBase) {
      return '/'
    }

    return buildDocsPath({
      mode: 'kb',
      kb: knowledgeBase.id,
      locale: resolveKnowledgeBaseLocale(config, knowledgeBase.id),
      slug: getKnowledgeBaseEntrySlug(knowledgeBase),
    })
  }

  function switchLocalePath(locale: string) {
    return withHash(switchLocaleInPath(route.path, locale, config))
  }

  function switchKnowledgeBasePath(kbId: string) {
    const currentMode = mode.value

    if (currentMode !== 'kb') {
      return route.path
    }

    return withHash(switchKnowledgeBaseInPath(route.path, kbId, config))
  }

  return {
    mode,
    isKnowledgeBaseMode,
    knowledgeBases,
    defaultKnowledgeBase,
    resolvedRoute,
    isDocsRoute,
    activeKnowledgeBase,
    activeLocale,
    collectionName,
    currentSlug,
    getKnowledgeBaseHomePath,
    switchLocalePath,
    switchKnowledgeBasePath,
  }
}
