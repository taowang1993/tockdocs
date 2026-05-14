import type { Collections } from '@nuxt/content'
import { queryCollection } from '@nuxt/content/server'
import { z } from 'zod'
import { buildSourceContentPath } from '../../../utils/content-source'
import { buildDocsPageUrl } from '../../../utils/docs'
import { inferSiteURL } from '../../../utils/meta'
import { getCollectionFromPath, getScopedKnowledgeBaseAndLocale, isPathWithinDocsScope, isSearchableContentPath, normalizeRequestedContentPagePath } from '../../utils/content'

export default defineMcpTool({
  description: `Retrieves the full content and metadata for a specific documentation page.

WHEN TO USE: Use this tool when you already know the exact page path and want the full markdown.

WHEN NOT TO USE: If you do not know the exact path, use search-pages or list-pages first.

The path should include the full routed path. In KB-first sites that means paths like /docs/platform/en/getting-started.`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    path: z.string().describe('The exact page path or docs markdown URL (for example: /docs/platform/en/getting-started, /docs/platform/en/getting-started.md, or https://docs.example.com/docs/platform/en/getting-started.md).'),
  },
  inputExamples: [
    { path: '/docs/platform/en/getting-started/installation' },
    { path: '/docs/platform/en/getting-started/installation.md' },
    { path: 'https://docs.example.com/docs/platform/en/getting-started/installation.md' },
  ],
  cache: '1h',
  handler: async ({ path }) => {
    const event = useEvent()
    const config = useRuntimeConfig(event).public as Parameters<typeof getCollectionFromPath>[1]
    const origin = getRequestURL(event).origin || inferSiteURL()
    if (!origin) {
      console.warn('[TockDocs] Could not resolve site URL for get-page; page URLs will be root-relative.')
    }
    const siteUrl = origin || ''
    const scoped = getScopedKnowledgeBaseAndLocale(event)
    const normalizedPath = normalizeRequestedContentPagePath(path)

    if (!isSearchableContentPath(normalizedPath)) {
      throw createError({ statusCode: 404, message: 'Page not found' })
    }

    if (!isPathWithinDocsScope(normalizedPath, scoped, config)) {
      throw createError({ statusCode: 404, message: 'Page not found' })
    }

    const collectionName = getCollectionFromPath(normalizedPath, config)

    try {
      const page = await queryCollection(event, collectionName as keyof Collections)
        .where('path', '=', normalizedPath)
        .select('title', 'path', 'description', 'extension')
        .first()

      if (!page) {
        throw createError({ statusCode: 404, message: 'Page not found' })
      }

      const pagePath = page.path || normalizedPath
      const content = await event.$fetch<string>(buildSourceContentPath(pagePath, page.extension || undefined))

      return {
        title: page.title,
        path: pagePath,
        description: page.description,
        content,
        url: buildDocsPageUrl(siteUrl, pagePath),
      }
    }
    catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) throw error
      throw createError({ statusCode: 500, message: 'Failed to get page' })
    }
  },
})
