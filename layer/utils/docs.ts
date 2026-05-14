import { joinURL } from 'ufo'

export interface TockDocsKnowledgeBase {
  id: string
  title: string
  description: string
  icon: string
  defaultLocale: string
  locales: string[]
  entry?: string
  theme?: string
  searchPlaceholder?: string
  assistantName?: string
  titles?: Record<string, string>
  descriptions?: Record<string, string>
}

type LocaleEntry = string | { code: string }

export type TockDocsPublicRuntimeConfig = {
  i18n?: {
    defaultLocale?: string
    locales?: LocaleEntry[]
  }
  tockdocs?: {
    docsMode?: 'legacy' | 'kb'
    filteredLocales?: Array<{ code: string, name?: string }>
    knowledgeBases?: TockDocsKnowledgeBase[]
    knowledgeBaseSourceDirs?: Record<string, string>
    defaultKnowledgeBase?: string
    hasSiteContent?: boolean
  }
}

export interface ResolvedDocsRoute {
  mode: 'legacy' | 'kb'
  isDocsRoute: boolean
  kb?: string
  locale?: string
  slug: string[]
  path: string
  collectionName?: string
}

function normalizeLocaleEntry(locale: LocaleEntry) {
  return typeof locale === 'string' ? locale : locale.code
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function normalizeCollectionSegment(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
}

export function getKnowledgeBases(config: TockDocsPublicRuntimeConfig): TockDocsKnowledgeBase[] {
  return Array.isArray(config.tockdocs?.knowledgeBases)
    ? config.tockdocs.knowledgeBases
    : []
}

export function getDocsMode(config: TockDocsPublicRuntimeConfig): 'legacy' | 'kb' {
  if (config.tockdocs?.docsMode === 'kb') {
    return 'kb'
  }

  return getKnowledgeBases(config).length > 0 ? 'kb' : 'legacy'
}

export function hasSiteContent(config: TockDocsPublicRuntimeConfig): boolean {
  return Boolean(config.tockdocs?.hasSiteContent)
}

export function getFilteredLocaleCodes(config: TockDocsPublicRuntimeConfig): string[] {
  if (Array.isArray(config.tockdocs?.filteredLocales) && config.tockdocs.filteredLocales.length > 0) {
    return unique(config.tockdocs.filteredLocales.map(locale => locale.code))
  }

  if (Array.isArray(config.i18n?.locales) && config.i18n.locales.length > 0) {
    return unique(config.i18n.locales.map(normalizeLocaleEntry))
  }

  return unique(getKnowledgeBases(config).flatMap(kb => kb.locales))
}

export function getDefaultLocale(config: TockDocsPublicRuntimeConfig): string {
  return config.i18n?.defaultLocale || getFilteredLocaleCodes(config)[0] || 'en'
}

export function getDefaultKnowledgeBase(config: TockDocsPublicRuntimeConfig): string | undefined {
  const configuredDefault = config.tockdocs?.defaultKnowledgeBase
  if (configuredDefault && getKnowledgeBases(config).some(kb => kb.id === configuredDefault)) {
    return configuredDefault
  }

  return getKnowledgeBases(config)[0]?.id
}

export function getKnowledgeBase(config: TockDocsPublicRuntimeConfig, kbId?: string): TockDocsKnowledgeBase | undefined {
  const knowledgeBases = getKnowledgeBases(config)
  if (knowledgeBases.length === 0) {
    return undefined
  }

  if (kbId) {
    const match = knowledgeBases.find(kb => kb.id === kbId)
    if (match) {
      return match
    }
  }

  const defaultKb = getDefaultKnowledgeBase(config)
  return knowledgeBases.find(kb => kb.id === defaultKb) || knowledgeBases[0]
}

export function resolveKnowledgeBaseLocale(
  config: TockDocsPublicRuntimeConfig,
  kbId?: string,
  locale?: string,
): string {
  const kb = getKnowledgeBase(config, kbId)

  if (kb) {
    if (locale && kb.locales.includes(locale)) {
      return locale
    }

    if (kb.locales.includes(kb.defaultLocale)) {
      return kb.defaultLocale
    }

    return kb.locales[0] || getDefaultLocale(config)
  }

  return locale || getDefaultLocale(config)
}

export function getKnowledgeBaseEntrySlug(knowledgeBase?: Pick<TockDocsKnowledgeBase, 'entry'>) {
  return knowledgeBase?.entry?.split('/').filter(Boolean) || []
}

export function getDocsCollectionName({
  mode,
  kb,
  locale,
}: {
  mode: 'legacy' | 'kb'
  kb?: string
  locale?: string
}) {
  if (mode === 'kb' && kb && locale) {
    return `docs_${normalizeCollectionSegment(kb)}_${normalizeCollectionSegment(locale)}`
  }

  if (locale) {
    return `docs_${normalizeCollectionSegment(locale)}`
  }

  return 'docs'
}

export function getLandingCollectionName(locale?: string) {
  if (locale) {
    return `landing_${normalizeCollectionSegment(locale)}`
  }

  return 'landing'
}

export function getAllDocsCollectionNames(config: TockDocsPublicRuntimeConfig): string[] {
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    return unique(
      getKnowledgeBases(config).flatMap(kb =>
        kb.locales.map(locale => getDocsCollectionName({ mode, kb: kb.id, locale })),
      ),
    )
  }

  const locales = getFilteredLocaleCodes(config)
  return locales.length > 0
    ? locales.map(locale => getDocsCollectionName({ mode, locale }))
    : ['docs']
}

export function getDefaultDocsCollectionName(config: TockDocsPublicRuntimeConfig): string {
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    const kb = getKnowledgeBase(config)
    if (kb) {
      return getDocsCollectionName({ mode, kb: kb.id, locale: resolveKnowledgeBaseLocale(config, kb.id) })
    }
  }

  const locales = getFilteredLocaleCodes(config)
  return getDocsCollectionName({ mode, locale: locales[0] })
}

export function buildDocsPath({
  mode,
  kb,
  locale,
  slug = [],
}: {
  mode: 'legacy' | 'kb'
  kb?: string
  locale?: string
  slug?: string[]
}) {
  const cleanSlug = slug.filter(Boolean)

  if (mode === 'kb') {
    if (!kb) {
      return '/docs'
    }

    if (!locale) {
      return joinURL('/docs', kb)
    }

    return joinURL('/docs', kb, locale, ...cleanSlug)
  }

  if (locale) {
    return joinURL('/', locale, ...cleanSlug)
  }

  return cleanSlug.length > 0 ? joinURL('/', ...cleanSlug) : '/'
}

export function buildDocsPageUrl(siteUrl: string, path: string) {
  return joinURL(siteUrl.replace(/\/$/, ''), path)
}

export function resolveDocsRoute(path: string, config: TockDocsPublicRuntimeConfig): ResolvedDocsRoute {
  const cleanPath = path.split('?')[0] || '/'
  const segments = cleanPath.split('/').filter(Boolean)
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    if (segments[0] !== 'docs') {
      return {
        mode,
        isDocsRoute: false,
        slug: [],
        path: cleanPath,
      }
    }

    const kb = segments[1]
    const knowledgeBase = getKnowledgeBase(config, kb)

    if (!knowledgeBase) {
      return {
        mode,
        isDocsRoute: true,
        slug: segments.slice(2),
        path: cleanPath,
      }
    }

    const locale = segments[2]

    if (!locale || !knowledgeBase.locales.includes(locale)) {
      return {
        mode,
        isDocsRoute: true,
        kb: knowledgeBase.id,
        slug: segments.slice(2),
        path: cleanPath,
      }
    }

    return {
      mode,
      isDocsRoute: true,
      kb: knowledgeBase.id,
      locale,
      slug: segments.slice(3),
      path: cleanPath,
      collectionName: getDocsCollectionName({ mode, kb: knowledgeBase.id, locale }),
    }
  }

  const locales = getFilteredLocaleCodes(config)

  if (locales.length > 0) {
    const locale = segments[0]

    if (!locale || !locales.includes(locale)) {
      return {
        mode,
        isDocsRoute: false,
        slug: segments,
        path: cleanPath,
      }
    }

    return {
      mode,
      isDocsRoute: true,
      locale,
      slug: segments.slice(1),
      path: cleanPath,
      collectionName: getDocsCollectionName({ mode, locale }),
    }
  }

  return {
    mode,
    isDocsRoute: cleanPath !== '/',
    slug: segments,
    path: cleanPath,
    collectionName: cleanPath !== '/' ? 'docs' : undefined,
  }
}

export function getCollectionFromPath(path: string, config: TockDocsPublicRuntimeConfig): string {
  const resolved = resolveDocsRoute(path, config)

  if (resolved.collectionName) {
    return resolved.collectionName
  }

  return getDefaultDocsCollectionName(config)
}

export function switchLocaleInPath(path: string, targetLocale: string, config: TockDocsPublicRuntimeConfig): string {
  const resolved = resolveDocsRoute(path, config)

  if (resolved.mode === 'kb') {
    if (!resolved.isDocsRoute || !resolved.kb) {
      return path
    }

    return buildDocsPath({
      mode: 'kb',
      kb: resolved.kb,
      locale: resolveKnowledgeBaseLocale(config, resolved.kb, targetLocale),
      slug: resolved.slug,
    })
  }

  const locales = getFilteredLocaleCodes(config)

  if (locales.length === 0) {
    return path
  }

  if (!resolved.isDocsRoute) {
    return buildDocsPath({ mode: 'legacy', locale: targetLocale })
  }

  return buildDocsPath({
    mode: 'legacy',
    locale: targetLocale,
    slug: resolved.slug,
  })
}

export function switchKnowledgeBaseInPath(path: string, targetKb: string, config: TockDocsPublicRuntimeConfig): string {
  if (getDocsMode(config) !== 'kb') {
    return path
  }

  const resolved = resolveDocsRoute(path, config)
  const nextKnowledgeBase = getKnowledgeBase(config, targetKb)
  if (!nextKnowledgeBase) {
    return path
  }

  return buildDocsPath({
    mode: 'kb',
    kb: nextKnowledgeBase.id,
    locale: resolveKnowledgeBaseLocale(config, nextKnowledgeBase.id, resolved.locale),
    slug: getKnowledgeBaseEntrySlug(nextKnowledgeBase),
  })
}
