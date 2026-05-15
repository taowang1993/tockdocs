import { Document } from 'flexsearch'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import {
  hasScriptWithoutWordBoundaries,
  scriptBigrams,
} from './docs-search-helpers'

export type DocsSearchScope = {
  kb?: string
  locale?: string
}

export type SearchIndexDocument = {
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

export type DocsSearchIndex = {
  flex: Document<SearchIndexDocument>
  fuse: Fuse<SearchIndexDocument>
  documents: SearchIndexDocument[]
  byId: Map<string, SearchIndexDocument>
}

export type DocsSearchIndexAsset = {
  version: number
  documents: SearchIndexDocument[]
  flexExport: Record<string, string>
}

export const TOCKDOCS_SEARCH_INDEX_ASSET_BASE_NAME = 'tockdocs-search'
export const SEARCH_INDEX_ASSET_VERSION = 1
export const SEARCH_INDEX_TTL_MS = Number.POSITIVE_INFINITY
export const DEV_SEARCH_INDEX_TTL_MS = Number.POSITIVE_INFINITY

export const fuseOptions: IFuseOptions<SearchIndexDocument> = {
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

export function getSearchIndexCacheKey(scope?: DocsSearchScope): string {
  if (!scope?.kb) return '__unscoped__'
  return `${scope.kb}:${scope.locale || '__all_locales__'}`
}

export function getSearchIndexStorageKey(scope?: DocsSearchScope): string {
  if (!scope?.kb) {
    return '__unscoped__.json'
  }

  return scope.locale
    ? `${scope.kb}/${scope.locale}.json`
    : `${scope.kb}/__all_locales__.json`
}

export function getSearchIndexStorageCandidates(scope?: DocsSearchScope): string[] {
  if (!scope?.kb) {
    return [getSearchIndexStorageKey()]
  }

  const candidates = [getSearchIndexStorageKey(scope)]

  if (scope.locale) {
    candidates.push(getSearchIndexStorageKey({ kb: scope.kb }))
  }

  candidates.push(getSearchIndexStorageKey())

  return [...new Set(candidates)]
}

export function stripSearchIndexFrontmatter(markdown: string): string {
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

export function extractSearchIndexHeadings(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => /^#{1,6}\s/.test(line))
    .map(line => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean)
    .join('\n')
}

export function getSearchIndexPathTokens(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/[-_]+/g, ' '))
    .join(' ')
}

export function toSearchIndexDocument({
  path,
  kb,
  locale,
  title,
  description,
  markdown,
}: {
  path: string
  kb?: string
  locale?: string
  title?: string
  description?: string
  markdown: string
}): SearchIndexDocument {
  const resolvedTitle = title || path
  const resolvedDescription = description || ''
  const rawContent = stripSearchIndexFrontmatter(markdown)

  return {
    id: path,
    path,
    kb: kb || '',
    locale: locale || '',
    title: resolvedTitle,
    description: resolvedDescription,
    headings: extractSearchIndexHeadings(rawContent),
    pathTokens: getSearchIndexPathTokens(path),
    rawContent,
    content: [resolvedTitle, resolvedDescription, rawContent].filter(Boolean).join('\n\n'),
  }
}

export function createFlexSearchDocument(): Document<SearchIndexDocument> {
  return new Document<SearchIndexDocument>({
    document: {
      id: 'id',
      index: ['title', 'description', 'headings', 'pathTokens', 'content'],
      store: true,
    },
    tokenize: 'forward',
    encode: (str: string) => {
      if (!hasScriptWithoutWordBoundaries(str)) {
        return str.split(/\s+/)
      }

      const tokens = str.split(/\s+/)
      const result: string[] = []
      for (const token of tokens) {
        if (hasScriptWithoutWordBoundaries(token)) {
          result.push(...scriptBigrams(token))
        }
        else {
          result.push(token)
        }
      }
      return result
    },
  })
}

export function createDocsSearchIndex(documents: SearchIndexDocument[]): DocsSearchIndex {
  const flex = createFlexSearchDocument()

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

export async function exportFlexSearchDocument(flex: Document<SearchIndexDocument>): Promise<Record<string, string>> {
  const flexExport: Record<string, string> = {}

  await flex.export(async (key, data) => {
    flexExport[key] = data
  })

  return flexExport
}

export function restoreDocsSearchIndex(asset: DocsSearchIndexAsset): DocsSearchIndex {
  const flex = createFlexSearchDocument()

  for (const [key, data] of Object.entries(asset.flexExport)) {
    flex.import(key, data)
  }

  return {
    flex,
    fuse: new Fuse(asset.documents, fuseOptions),
    documents: asset.documents,
    byId: new Map(asset.documents.map(document => [document.id, document])),
  }
}

function toTextContent(value: string | Uint8Array | Buffer): string {
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return Buffer.from(value).toString('utf8')
}

function isSearchIndexDocument(value: unknown): value is SearchIndexDocument {
  if (!value || typeof value !== 'object') {
    return false
  }

  const doc = value as Record<string, unknown>
  return [
    'id',
    'path',
    'kb',
    'locale',
    'title',
    'description',
    'headings',
    'pathTokens',
    'content',
    'rawContent',
  ].every(key => typeof doc[key] === 'string')
}

export function parseDocsSearchIndexAsset(value: string | Uint8Array | Buffer): DocsSearchIndexAsset | null {
  try {
    const parsed = JSON.parse(toTextContent(value)) as Record<string, unknown>
    const { version, documents, flexExport } = parsed

    if (version !== SEARCH_INDEX_ASSET_VERSION) {
      return null
    }

    if (!Array.isArray(documents) || !documents.every(isSearchIndexDocument)) {
      return null
    }

    if (!flexExport || typeof flexExport !== 'object' || Array.isArray(flexExport)) {
      return null
    }

    const flexEntries = Object.entries(flexExport)
    if (!flexEntries.every(([, item]) => typeof item === 'string')) {
      return null
    }

    return {
      version,
      documents,
      flexExport: Object.fromEntries(flexEntries) as Record<string, string>,
    }
  }
  catch {
    return null
  }
}
