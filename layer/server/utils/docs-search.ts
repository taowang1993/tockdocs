import { Document } from 'flexsearch'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { queryCollection } from '@nuxt/content/server'
import type { Collections } from '@nuxt/content'
import type { H3Event } from 'h3'
import { buildSourceContentPath } from '../../utils/content-source'
import { buildDocsPageUrl, getDocsCollectionName, getDocsMode, getFilteredLocaleCodes, getKnowledgeBases } from '../../utils/docs'
import { inferSiteURL } from '../../utils/meta'
import { isSearchableContentPath } from './content'
import {
  WITHOUT_WORD_BOUNDARIES,
  buildSearchExcerpt,
  hasScriptWithoutWordBoundaries,
  scoreCandidate,
} from './docs-search-helpers'

type SearchIndexDocument = {
  id: string
  path: string
  kb: string
  locale: string
  title: string
  description: string
  headings: string
  pathTokens: string
  content: string
  rawContent: string
}

type SearchResultCandidate = {
  doc: SearchIndexDocument
  flexIndex?: number
  fuseIndex?: number
  fuseScore?: number
}

export type TockDocsSearchResult = {
  title: string
  description: string
  path: string
  url: string
  kb?: string
  locale?: string
  excerpt: string
}

type DocsSearchIndex = {
  flex: Document<SearchIndexDocument>
  fuse: Fuse<SearchIndexDocument>
  documents: SearchIndexDocument[]
  byId: Map<string, SearchIndexDocument>
}

const FLEXSEARCH_LIMIT_MULTIPLIER = 6
const FLEXSEARCH_FALLBACK_MIN_RESULTS = 3
const SEARCH_INDEX_TTL_MS = 60_000
const DEV_SEARCH_INDEX_TTL_MS = 10_000

const fuseOptions: IFuseOptions<SearchIndexDocument> = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 0.36 },
    { name: 'headings', weight: 0.24 },
    { name: 'pathTokens', weight: 0.16 },
    { name: 'description', weight: 0.14 },
    { name: 'content', weight: 0.1 },
  ],
}

type CacheEntry = { promise: Promise<DocsSearchIndex>, builtAt: number }
const docsSearchCache = new Map<string, CacheEntry>()

function getCacheKey(scope?: { kb?: string, locale?: string }): string {
  if (!scope?.kb) return '__unscoped__'
  return `${scope.kb}:${scope.locale || '__all_locales__'}`
}

function logDocsSearch(step: string, data: Record<string, unknown>) {
  console.info(`[tockdocs-docs-search] ${JSON.stringify({ step, ...data })}`)
}

function stripFrontmatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return normalized.trim()
  }

  const endOfFrontmatter = normalized.indexOf('\n---\n', 4)
  if (endOfFrontmatter === -1) {
    return normalized.trim()
  }

  return normalized.slice(endOfFrontmatter + 5).replace(/^\n+/, '').trim()
}

function extractHeadings(markdown: string) {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => /^#{1,6}\s/.test(line))
    .map(line => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean)
    .join('\n')
}

function getPathTokens(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/[-_]+/g, ' '))
    .join(' ')
}

function getOrigin(event: H3Event) {
  return getRequestURL(event).origin || inferSiteURL() || ''
}

function isQueryWeakForFlex(results: SearchResultCandidate[], limit: number) {
  return results.length < Math.min(Math.max(limit, 1), FLEXSEARCH_FALLBACK_MIN_RESULTS)
}

function flattenFlexResults(results: unknown): Array<{ doc?: SearchIndexDocument, id?: string }> {
  if (!Array.isArray(results)) {
    return []
  }

  return results.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    if ('doc' in item || 'id' in item) {
      return [item as { doc?: SearchIndexDocument, id?: string }]
    }

    if ('result' in item) {
      return flattenFlexResults((item as { result?: unknown }).result)
    }

    return []
  })
}

function normalizeFlexResults(rawResults: unknown, byId: Map<string, SearchIndexDocument>) {
  return flattenFlexResults(rawResults)
    .map((item) => {
      if (item.doc) {
        return item.doc
      }

      if (item.id) {
        return byId.get(item.id)
      }

      return undefined
    })
    .filter((doc): doc is SearchIndexDocument => Boolean(doc))
}

function getCollectionDescriptors(
  event: H3Event,
  scope?: { kb?: string, locale?: string },
) {
  const config = useRuntimeConfig(event).public as Parameters<typeof getDocsMode>[0]
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    const knowledgeBases = getKnowledgeBases(config)

    // When scoped to a specific KB, only index that KB's collections.
    // This cuts index-build time from ~12s to ~1s for scoped requests.
    if (scope?.kb) {
      const matchedKb = knowledgeBases.find(kb => kb.id === scope.kb)
      if (matchedKb) {
        const locales = scope.locale && matchedKb.locales.includes(scope.locale)
          ? [scope.locale]
          : matchedKb.locales
        return locales.map(locale => ({
          collectionName: getDocsCollectionName({ mode, kb: matchedKb.id, locale }),
          kb: matchedKb.id,
          locale,
        }))
      }
    }

    return knowledgeBases.flatMap(knowledgeBase =>
      knowledgeBase.locales.map(locale => ({
        collectionName: getDocsCollectionName({ mode, kb: knowledgeBase.id, locale }),
        kb: knowledgeBase.id,
        locale,
      })),
    )
  }

  const locales = getFilteredLocaleCodes(config)

  if (locales.length > 0) {
    return locales.map(locale => ({
      collectionName: getDocsCollectionName({ mode, locale }),
      locale,
    }))
  }

  return [{
    collectionName: 'docs',
    locale: '',
  }]
}

async function getCollectionDocuments(event: H3Event, descriptor: { collectionName: string, kb?: string, locale?: string }) {
  const pages = (await queryCollection(event, descriptor.collectionName as keyof Collections)
    .select('title', 'path', 'description', 'extension')
    .all())
    .filter(page => isSearchableContentPath(page.path || ''))

  return Promise.all(pages.map(async (page) => {
    let markdown = ''

    try {
      markdown = await event.$fetch<string>(buildSourceContentPath(page.path, page.extension || undefined))
    }
    catch {
      markdown = [page.title, page.description].filter(Boolean).join('\n\n')
    }

    const rawContent = stripFrontmatter(markdown)

    return {
      id: page.path,
      path: page.path,
      kb: descriptor.kb || '',
      locale: descriptor.locale || '',
      title: page.title || page.path,
      description: page.description || '',
      headings: extractHeadings(rawContent),
      pathTokens: getPathTokens(page.path),
      rawContent,
      content: [page.title, page.description, rawContent].filter(Boolean).join('\n\n'),
    } satisfies SearchIndexDocument
  }))
}

async function createDocsSearch(event: H3Event, scope?: { kb?: string, locale?: string }): Promise<DocsSearchIndex> {
  const startedAt = performance.now()
  const descriptors = getCollectionDescriptors(event, scope)

  const documents = (await Promise.all(descriptors.map(descriptor => getCollectionDocuments(event, descriptor)))).flat()

  logDocsSearch('build_index', {
    requestPath: getRequestURL(event).pathname,
    docCount: documents.length,
    collections: descriptors.map(descriptor => descriptor.collectionName),
    durationMs: Number((performance.now() - startedAt).toFixed(1)),
  })

  const flex = new Document<SearchIndexDocument>({
    document: {
      id: 'id',
      index: ['title', 'description', 'headings', 'pathTokens', 'content'],
      store: true,
    },
    tokenize: 'forward',
  })

  for (const document of documents) {
    flex.add(document)
  }

  return {
    flex,
    fuse: new Fuse(documents, fuseOptions),
    documents,
    byId: new Map(documents.map(document => [document.id, document])),
  }
}

async function getDocsSearch(event: H3Event, scope?: { kb?: string, locale?: string }) {
  const ttl = import.meta.dev ? DEV_SEARCH_INDEX_TTL_MS : SEARCH_INDEX_TTL_MS
  const key = getCacheKey(scope)
  const entry = docsSearchCache.get(key)

  if (entry && (performance.now() - entry.builtAt) < ttl) {
    return entry.promise
  }

  const promise = createDocsSearch(event, scope).then((index) => {
    docsSearchCache.set(key, { promise, builtAt: performance.now() })
    return index
  }).catch((error) => {
    docsSearchCache.delete(key)
    throw error
  })
  docsSearchCache.set(key, { promise, builtAt: 0 })
  return promise
}

function toSearchResult(event: H3Event, doc: SearchIndexDocument, query: string): TockDocsSearchResult {
  return {
    title: doc.title,
    description: doc.description,
    path: doc.path,
    url: buildDocsPageUrl(getOrigin(event), doc.path),
    kb: doc.kb || undefined,
    locale: doc.locale || undefined,
    excerpt: buildSearchExcerpt(doc.rawContent, query),
  }
}

export async function searchDocs(event: H3Event, {
  query,
  limit = 5,
  kb,
  locale,
}: {
  query: string
  limit?: number
  kb?: string
  locale?: string
}): Promise<TockDocsSearchResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const search = await getDocsSearch(event, { kb, locale })
  const effectiveLimit = Math.max(1, Math.min(limit, 20))
  const overfetchLimit = Math.max(effectiveLimit * FLEXSEARCH_LIMIT_MULTIPLIER, 12)

  const flexRawResults = await search.flex.searchAsync(trimmedQuery, {
    enrich: true,
    merge: true,
    limit: overfetchLimit,
  })

  const filteredDocuments = search.documents.filter((document) => {
    if (kb && document.kb !== kb) {
      return false
    }

    if (locale && document.locale !== locale) {
      return false
    }

    return true
  })

  const candidates = new Map<string, SearchResultCandidate>()

  for (const [index, doc] of normalizeFlexResults(flexRawResults, search.byId).entries()) {
    if (kb && doc.kb !== kb) {
      continue
    }

    if (locale && doc.locale !== locale) {
      continue
    }

    candidates.set(doc.id, {
      doc,
      ...candidates.get(doc.id),
      flexIndex: index,
    })
  }

  let usedFuseFallback = false

  if (isQueryWeakForFlex([...candidates.values()], effectiveLimit)) {
    usedFuseFallback = true
    const fuse = kb || locale
      ? new Fuse(filteredDocuments, fuseOptions)
      : search.fuse

    const fuseResults = fuse.search(trimmedQuery, { limit: overfetchLimit })

    for (const [index, result] of fuseResults.entries()) {
      const existing = candidates.get(result.item.id)
      candidates.set(result.item.id, {
        doc: result.item,
        flexIndex: existing?.flexIndex,
        fuseIndex: Math.min(existing?.fuseIndex ?? Number.POSITIVE_INFINITY, index),
        fuseScore: existing?.fuseScore === undefined
          ? result.score
          : Math.min(existing.fuseScore, result.score ?? 1),
      })
    }
  }

  // Lenient fallback: when the normal search returns nothing, try again
  // with a more forgiving Fuse configuration. This helps with long natural-
  // language queries in any script (CJK, Korean, Japanese, Vietnamese, etc.)
  // where the standard threshold is too strict for question-length input.
  if (candidates.size === 0) {
    usedFuseFallback = true
    const lenientDocuments = filteredDocuments.length > 0 ? filteredDocuments : search.documents

    const lenientFuse = new Fuse(lenientDocuments, {
      ...fuseOptions,
      threshold: 0.9,
      minMatchCharLength: 1,
    })

    let lenientResults = lenientFuse.search(trimmedQuery, { limit: overfetchLimit })

    // Second attempt: when the full query returns nothing (common with
    // mixed-script queries like "硫酸 化学 H2SO4"), strip to only non-Latin
    // script characters and try again. The non-Latin portion carries the
    // core semantic meaning in CJK / Korean / Japanese queries.
    if (lenientResults.length === 0 && hasScriptWithoutWordBoundaries(trimmedQuery)) {
      const scriptOnlyQuery = [...trimmedQuery]
        .filter(c => WITHOUT_WORD_BOUNDARIES.test(c))
        .join('')
        .trim()

      if (scriptOnlyQuery && scriptOnlyQuery !== trimmedQuery) {
        lenientResults = lenientFuse.search(scriptOnlyQuery, { limit: overfetchLimit })

        logDocsSearch('lenient_retry', {
          requestPath: getRequestURL(event).pathname,
          originalQuery: trimmedQuery,
          strippedQuery: scriptOnlyQuery,
          resultCount: lenientResults.length,
        })
      }
    }

    for (const [index, result] of lenientResults.entries()) {
      candidates.set(result.item.id, {
        doc: result.item,
        fuseIndex: index,
        fuseScore: result.score,
      })
    }
  }

  const results = [...candidates.values()]
    .sort((left, right) => scoreCandidate(right, trimmedQuery) - scoreCandidate(left, trimmedQuery))
    .slice(0, effectiveLimit)
    .map(candidate => toSearchResult(event, candidate.doc, trimmedQuery))

  logDocsSearch('search', {
    requestPath: getRequestURL(event).pathname,
    query: trimmedQuery,
    kb,
    locale,
    limit: effectiveLimit,
    candidateCount: candidates.size,
    usedFuseFallback,
    resultCount: results.length,
    topPaths: results.map(result => result.path),
  })

  return results
}
