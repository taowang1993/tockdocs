import { join } from 'node:path'
import type { H3Event } from 'h3'
import type { TockDocsPublicRuntimeConfig } from '../../../../utils/docs'
import { inferSiteURL } from '../../../../utils/meta'
import {
  DEV_INDEX_CACHE_TTL_MS,
  INDEX_CACHE_TTL_MS,
  TOCKDOCS_INDEX_ASSET_BASE_NAME,
  absolutizeIndexLinks,
  buildIndexForScope,
  getIndexStorageKey,
} from '../../../../server/utils/index-generator'

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8'
const generatedIndexCache = new Map<string, { builtAt: number, content: string }>()

function toTextContent(value: string | Uint8Array | Buffer) {
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return Buffer.from(value).toString('utf8')
}

function getRootDirCandidates() {
  return [...new Set([
    process.cwd(),
    join(process.cwd(), 'docs'),
    join(process.cwd(), 'playground'),
  ])]
}

async function generateIndexOnDemand(event: H3Event, scopeId: string, locale: string) {
  const cacheKey = `${scopeId}:${locale}`
  const ttl = import.meta.dev ? DEV_INDEX_CACHE_TTL_MS : INDEX_CACHE_TTL_MS
  const cached = generatedIndexCache.get(cacheKey)

  if (cached && (performance.now() - cached.builtAt) < ttl) {
    return cached.content
  }

  const config = useRuntimeConfig(event).public as TockDocsPublicRuntimeConfig
  const siteConfig = getSiteConfig(event)
  const siteName = siteConfig.name || 'Documentation'
  const candidates = getRootDirCandidates()

  for (const rootDir of candidates) {
    try {
      const index = await buildIndexForScope(rootDir, config, scopeId, locale, { siteName })

      if (index) {
        generatedIndexCache.set(cacheKey, {
          builtAt: performance.now(),
          content: index.content,
        })
        return index.content
      }
    }
    catch {
      // Try the next candidate root directory.
    }
  }

  return null
}

function extractScopeFromPath(event: H3Event) {
  const prefix = '/__tockdocs__/index/'
  const pathname = getRequestURL(event).pathname
  const idx = pathname.indexOf(prefix)
  if (idx === -1) return { kb: '', locale: '' }

  const [kbSegment = '', localeSegment = ''] = pathname.slice(idx + prefix.length).split('/').filter(Boolean)
  return { kb: kbSegment, locale: localeSegment.replace(/\.md$/i, '') }
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    setHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const { kb, locale } = extractScopeFromPath(event)

  if (!kb || !locale || kb.includes('..') || locale.includes('..')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const storage = useStorage(`assets:${TOCKDOCS_INDEX_ASSET_BASE_NAME}`)
  const stored = await storage.getItemRaw<string | Uint8Array | Buffer>(getIndexStorageKey(kb, locale))
  let content = stored == null ? null : toTextContent(stored)

  if (content == null) {
    content = await generateIndexOnDemand(event, kb, locale)
  }

  if (content == null) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const origin = getRequestURL(event).origin || inferSiteURL() || ''
  if (!origin) {
    console.warn('[TockDocs] Could not resolve site URL for INDEX.md; links will be root-relative.')
  }

  const resolvedContent = absolutizeIndexLinks(content, origin)

  setHeader(event, 'content-type', MARKDOWN_CONTENT_TYPE)
  setHeader(event, 'cache-control', import.meta.dev ? 'no-store' : 'public, max-age=3600')
  setHeader(event, 'x-robots-tag', 'noindex')

  return method === 'HEAD' ? '' : resolvedContent
})
