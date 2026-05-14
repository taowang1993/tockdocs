import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LEGACY_INDEX_SCOPE_ID,
  absolutizeIndexLinks,
  generateIndex,
  resolveIndexScope,
} from './index-generator'

const kbConfig = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
  },
  tockdocs: {
    docsMode: 'kb' as const,
    knowledgeBases: [
      {
        id: 'manual',
        title: 'Manual',
        description: 'Core guides',
        icon: 'i-lucide-book-open',
        defaultLocale: 'en',
        locales: ['en', 'zh'],
      },
    ],
    knowledgeBaseSourceDirs: {
      manual: 'manual',
    },
  },
}

const legacyConfig = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  tockdocs: {
    docsMode: 'legacy' as const,
    filteredLocales: [{ code: 'en' }],
  },
}

test('generateIndex formats links and summaries', () => {
  const content = generateIndex('Manual', 'en', [
    {
      title: 'Assistant',
      path: '/docs/manual/en/ai/assistant',
      description: 'Add AI-powered chat to your docs.',
      url: '/docs/manual/en/ai/assistant.md',
    },
    {
      title: 'Hybridization Judgment',
      path: '/docs/chemistry/zh/atomic-structure/hybridization-judgment',
      url: '/docs/chemistry/zh/atomic-structure/hybridization-judgment.md',
    },
  ])

  assert.equal(content, `# Knowledge Base: Manual (en)\n\n- [Assistant](/docs/manual/en/ai/assistant.md)\n  Summary: Add AI-powered chat to your docs.\n\n- [Hybridization Judgment](/docs/chemistry/zh/atomic-structure/hybridization-judgment.md)\n`)
})

test('generateIndex renders an empty-state note', () => {
  const content = generateIndex('Manual', 'en', [])

  assert.equal(content, '# Knowledge Base: Manual (en)\n\n_No indexed pages are available for this scope yet._\n')
})

test('resolveIndexScope uses kb scope when available and a synthetic scope for legacy docs', () => {
  assert.deepEqual(resolveIndexScope(kbConfig, { kb: 'manual', locale: 'zh' }), {
    scopeId: 'manual',
    locale: 'zh',
  })

  assert.equal(resolveIndexScope(kbConfig, { locale: 'en' }), null)

  assert.deepEqual(resolveIndexScope(legacyConfig, { locale: 'en' }), {
    scopeId: LEGACY_INDEX_SCOPE_ID,
    locale: 'en',
  })
})

test('absolutizeIndexLinks rewrites relative markdown links to absolute URLs', () => {
  const content = absolutizeIndexLinks(
    '# Knowledge Base: Manual (en)\n\n- [Assistant](/docs/manual/en/ai/assistant.md)\n',
    'https://example.com',
  )

  assert.match(content, /https:\/\/example\.com\/docs\/manual\/en\/ai\/assistant\.md/)
})
