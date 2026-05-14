import { z } from 'zod'
import { searchDocs } from '../../utils/docs-search'
import { getScopedKnowledgeBaseAndLocale } from '../../utils/content'

export default defineMcpTool({
  description: `Searches the full documentation corpus, including page body content, headings, titles, descriptions, and paths.

WHEN TO USE: Use this tool for factual questions, feature lookups, troubleshooting, configuration details, or anything that may be mentioned inside page content.

WHEN NOT TO USE: If the user wants to browse the documentation structure, use list-pages. If you already know the exact page path and need the full markdown, use get-page.

This tool supports KB-aware scoping with optional kb and locale filters.`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    query: z.string().describe('The search query. Natural language questions, keywords, and slightly misspelled terms are all supported.'),
    limit: z.number().int().min(1).max(20).optional().describe('Maximum number of results to return. Defaults to 5.'),
    kb: z.string().optional().describe('Optional knowledge base id to scope results.'),
    locale: z.string().optional().describe('Optional locale code to scope results.'),
  },
  inputExamples: [
    { query: 'How do I configure markdown rewrites?', kb: 'platform', locale: 'en' },
    { query: 'installation', locale: 'fr' },
  ],
  cache: '1h',
  handler: async ({ query, limit, kb, locale }) => {
    const event = useEvent()
    const scoped = getScopedKnowledgeBaseAndLocale(event, { kb, locale })

    try {
      return await searchDocs(event, {
        query,
        limit,
        kb: scoped.kb,
        locale: scoped.locale,
      })
    }
    catch {
      throw createError({ statusCode: 500, message: 'Failed to search pages' })
    }
  },
})
