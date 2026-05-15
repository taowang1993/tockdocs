import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createDocsSearchIndex,
  exportFlexSearchDocument,
  getSearchIndexCacheKey,
  getSearchIndexStorageCandidates,
  getSearchIndexStorageKey,
  parseDocsSearchIndexAsset,
  restoreDocsSearchIndex,
  SEARCH_INDEX_ASSET_VERSION,
  toSearchIndexDocument,
} from './search-index'

test('search index scope keys map exact and fallback asset paths', () => {
  assert.equal(getSearchIndexCacheKey(), '__unscoped__')
  assert.equal(getSearchIndexCacheKey({ kb: 'manual', locale: 'en' }), 'manual:en')
  assert.equal(getSearchIndexCacheKey({ kb: 'manual' }), 'manual:__all_locales__')

  assert.equal(getSearchIndexStorageKey(), '__unscoped__.json')
  assert.equal(getSearchIndexStorageKey({ kb: 'manual', locale: 'en' }), 'manual/en.json')
  assert.equal(getSearchIndexStorageKey({ kb: 'manual' }), 'manual/__all_locales__.json')

  assert.deepEqual(
    getSearchIndexStorageCandidates({ kb: 'manual', locale: 'en' }),
    ['manual/en.json', 'manual/__all_locales__.json', '__unscoped__.json'],
  )
})

test('toSearchIndexDocument strips frontmatter and extracts headings', () => {
  const document = toSearchIndexDocument({
    path: '/docs/manual/en/ai/assistant',
    kb: 'manual',
    locale: 'en',
    title: 'Assistant',
    description: 'Add grounded search.',
    markdown: `---\ntitle: Assistant\n---\n\n# Assistant\n\nUse search-pages before answering.`,
  })

  assert.equal(document.rawContent, '# Assistant\n\nUse search-pages before answering.')
  assert.equal(document.headings, 'Assistant')
  assert.match(document.pathTokens, /manual en ai assistant/)
})

test('search index asset round-trips through flex export and restore', async () => {
  const documents = [
    toSearchIndexDocument({
      path: '/docs/manual/en/ai/assistant',
      kb: 'manual',
      locale: 'en',
      title: 'Assistant',
      description: 'Grounded answers',
      markdown: '# Assistant\n\nUse search-pages before reading the page.',
    }),
    toSearchIndexDocument({
      path: '/docs/manual/en/essentials/index',
      kb: 'manual',
      locale: 'en',
      title: 'Essentials',
      description: 'Core concepts',
      markdown: '# Essentials\n\nCore concepts live here.',
    }),
  ]

  const original = createDocsSearchIndex(documents)
  const flexExport = await exportFlexSearchDocument(original.flex)
  const asset = parseDocsSearchIndexAsset(Buffer.from(JSON.stringify({
    version: SEARCH_INDEX_ASSET_VERSION,
    documents,
    flexExport,
  })))

  assert.ok(asset, 'Expected the serialized asset to parse')

  const restored = restoreDocsSearchIndex(asset!)
  const originalResults = await original.flex.searchAsync('search-pages', {
    enrich: true,
    merge: true,
    limit: 5,
  })
  const restoredResults = await restored.flex.searchAsync('search-pages', {
    enrich: true,
    merge: true,
    limit: 5,
  })

  assert.deepEqual(restored.documents, documents)
  assert.equal(restored.byId.get('/docs/manual/en/ai/assistant')?.title, 'Assistant')
  assert.deepEqual(
    JSON.parse(JSON.stringify(restoredResults)),
    JSON.parse(JSON.stringify(originalResults)),
  )
})
