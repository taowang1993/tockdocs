import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canServeNegotiatedMarkdown,
  prefersMarkdownResponse,
  shouldBypassMarkdownSourceAlias,
  shouldServeLlmsIndexForMarkdown,
} from '../../utils/markdown-negotiation'

const legacyConfig = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
  },
  tockdocs: {
    docsMode: 'legacy' as const,
    filteredLocales: [
      { code: 'en' },
      { code: 'zh' },
    ],
  },
}

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
        description: '',
        icon: 'i-lucide-book-open',
        defaultLocale: 'en',
        locales: ['en', 'zh'],
      },
    ],
  },
}

test('prefersMarkdownResponse detects agent-friendly markdown requests', () => {
  assert.equal(prefersMarkdownResponse({ accept: 'text/markdown', userAgent: 'Mozilla/5.0' }), true)
  assert.equal(prefersMarkdownResponse({ accept: '*/*', userAgent: 'curl/8.8.0' }), true)
  assert.equal(prefersMarkdownResponse({ accept: 'text/html,application/xhtml+xml', userAgent: 'Mozilla/5.0' }), false)
})

test('canServeNegotiatedMarkdown skips assets and special routes', () => {
  assert.equal(canServeNegotiatedMarkdown('/docs/manual/en/ai/llms'), true)
  assert.equal(canServeNegotiatedMarkdown('/'), true)
  assert.equal(canServeNegotiatedMarkdown('/docs/manual/en/ai/llms.md'), false)
  assert.equal(canServeNegotiatedMarkdown('/source/docs/manual/en/ai/llms.md'), false)
  assert.equal(canServeNegotiatedMarkdown('/sitemap.xml'), false)
  assert.equal(canServeNegotiatedMarkdown('/.well-known/skills/index.json'), false)
  assert.equal(canServeNegotiatedMarkdown('/mcp'), false)
})

test('shouldServeLlmsIndexForMarkdown keeps the root on llms.txt and only rewrites locale roots in legacy mode', () => {
  assert.equal(shouldServeLlmsIndexForMarkdown('/', kbConfig), true)
  assert.equal(shouldServeLlmsIndexForMarkdown('/en', legacyConfig), true)
  assert.equal(shouldServeLlmsIndexForMarkdown('/zh', legacyConfig), true)
  assert.equal(shouldServeLlmsIndexForMarkdown('/en', kbConfig), false)
  assert.equal(shouldServeLlmsIndexForMarkdown('/docs/manual/en/ai/llms', legacyConfig), false)
})

test('shouldBypassMarkdownSourceAlias skips internal INDEX.md routes', () => {
  assert.equal(shouldBypassMarkdownSourceAlias('/__tockdocs__/index/chemistry/zh.md'), true)
  assert.equal(shouldBypassMarkdownSourceAlias('/docs/manual/en/ai/assistant.md'), false)
})
