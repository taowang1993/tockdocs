import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPathWithinDocsScope, normalizeRequestedContentPagePath } from './content'

const kbConfig = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
  },
  tockdocs: {
    docsMode: 'kb' as const,
    filteredLocales: [
      { code: 'en' },
      { code: 'zh' },
    ],
    knowledgeBases: [
      {
        id: 'manual',
        title: 'Manual',
        description: 'Core TockDocs guides',
        icon: 'i-lucide-book-open',
        defaultLocale: 'en',
        locales: ['en', 'zh'],
      },
      {
        id: 'chemistry',
        title: 'Chemistry',
        description: 'Chemistry notes',
        icon: 'i-lucide-flask-conical',
        defaultLocale: 'zh',
        locales: ['zh'],
      },
    ],
  },
}

test('isPathWithinDocsScope keeps get-page pinned to the active KB and locale', () => {
  assert.equal(
    isPathWithinDocsScope('/docs/manual/en/getting-started', { kb: 'manual', locale: 'en' }, kbConfig),
    true,
  )

  assert.equal(
    isPathWithinDocsScope('/docs/manual/zh/getting-started', { kb: 'manual', locale: 'en' }, kbConfig),
    false,
  )

  assert.equal(
    isPathWithinDocsScope('/docs/chemistry/zh/01.atomic-structure', { kb: 'manual', locale: 'en' }, kbConfig),
    false,
  )
})

test('normalizeRequestedContentPagePath accepts markdown aliases and absolute docs URLs', () => {
  assert.equal(
    normalizeRequestedContentPagePath('/docs/manual/en/ai/assistant.md'),
    '/docs/manual/en/ai/assistant',
  )

  assert.equal(
    normalizeRequestedContentPagePath('https://example.com/docs/manual/en/ai/assistant.md?ref=test#section'),
    '/docs/manual/en/ai/assistant',
  )
})
