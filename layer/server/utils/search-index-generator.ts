import { existsSync } from 'node:fs'
import { getDocsMode, type TockDocsPublicRuntimeConfig } from '../../utils/docs'
import {
  collectIndexSourcePages,
  type CollectedIndexSourcePage,
  getIndexBuildSpecs,
  LEGACY_INDEX_SCOPE_ID,
} from './index-generator'
import {
  createDocsSearchIndex,
  exportFlexSearchDocument,
  getSearchIndexStorageKey,
  SEARCH_INDEX_ASSET_VERSION,
  toSearchIndexDocument,
  type DocsSearchIndexAsset,
  type DocsSearchScope,
  type SearchIndexDocument,
} from './search-index'

export interface BuiltSearchIndexAsset {
  scope: DocsSearchScope
  storageKey: string
  documentCount: number
  asset: DocsSearchIndexAsset
}

type SpecDocuments = {
  scopeId: string
  locale: string
  documents: SearchIndexDocument[]
}

function normalizeDocuments(pages: CollectedIndexSourcePage[], scope: { scopeId: string, locale: string }) {
  const kb = scope.scopeId === LEGACY_INDEX_SCOPE_ID ? '' : scope.scopeId

  return pages.map(page =>
    toSearchIndexDocument({
      path: page.path,
      kb,
      locale: scope.locale,
      title: page.title,
      description: page.description,
      markdown: page.content,
    }),
  )
}

async function buildSearchIndexAsset(scope: DocsSearchScope, documents: SearchIndexDocument[]): Promise<BuiltSearchIndexAsset> {
  const index = createDocsSearchIndex(documents)
  const flexExport = await exportFlexSearchDocument(index.flex)

  return {
    scope,
    storageKey: getSearchIndexStorageKey(scope),
    documentCount: documents.length,
    asset: {
      version: SEARCH_INDEX_ASSET_VERSION,
      documents,
      flexExport,
    },
  }
}

async function getSpecDocuments(rootDir: string, config: TockDocsPublicRuntimeConfig, options: { siteName?: string } = {}): Promise<SpecDocuments[]> {
  const specs = getIndexBuildSpecs(rootDir, config, options)
    .filter(spec => existsSync(spec.sourceDir))

  return Promise.all(specs.map(async (spec) => {
    const pages = await collectIndexSourcePages(spec)

    return {
      scopeId: spec.scopeId,
      locale: spec.locale,
      documents: normalizeDocuments(pages, {
        scopeId: spec.scopeId,
        locale: spec.locale,
      }),
    } satisfies SpecDocuments
  }))
}

export async function buildAllSearchIndexAssets(
  rootDir: string,
  config: TockDocsPublicRuntimeConfig,
  options: { siteName?: string } = {},
): Promise<BuiltSearchIndexAsset[]> {
  const mode = getDocsMode(config)
  const specDocuments = await getSpecDocuments(rootDir, config, options)

  if (specDocuments.length === 0) {
    return []
  }

  const assets: BuiltSearchIndexAsset[] = []

  if (mode === 'kb') {
    for (const entry of specDocuments) {
      assets.push(await buildSearchIndexAsset({
        kb: entry.scopeId,
        locale: entry.locale,
      }, entry.documents))
    }

    const groupedDocuments = new Map<string, SearchIndexDocument[]>()

    for (const entry of specDocuments) {
      const existing = groupedDocuments.get(entry.scopeId) || []
      groupedDocuments.set(entry.scopeId, [...existing, ...entry.documents])
    }

    for (const [kb, documents] of groupedDocuments) {
      assets.push(await buildSearchIndexAsset({ kb }, documents))
    }
  }

  const unscopedDocuments = specDocuments.flatMap(entry => entry.documents)
  assets.push(await buildSearchIndexAsset({}, unscopedDocuments))

  return assets
}
