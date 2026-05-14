import type { H3Event } from 'h3'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError, getMethod, setHeader } from 'h3'
import { isNavigationPath } from './content'
import { findContentPageByPath, normalizeContentPagePath } from './content-page'
import { getRoutedRequestPath } from './request-path'
import {
  buildContentSourceFilePath,
  buildContentSourceAssetKey,
  buildMarkdownAliasPath,
  CONTENT_SOURCE_ASSET_BASE_NAME,
  getRenderedPathFromSourceContentPath,
  isSourceMarkdownRequestPath,
  normalizeContentExtension,
} from '../../utils/content-source'
import { buildAgentDocsDirectiveMarkdown } from '../../utils/agent-docs'

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8'
const DEV_CACHE_CONTROL = 'no-store'
const PROD_CACHE_CONTROL = 'public, max-age=3600'

type SourcePageRecord = {
  collectionName?: string
  stem?: string
  extension?: string
}

type TockDocsRuntimeConfig = ReturnType<typeof useRuntimeConfig> & {
  tockdocs?: {
    knowledgeBases?: Array<{ id: string, sourceDir: string }>
  }
}

function toBuffer(value: string | Uint8Array | Buffer) {
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8')
  }

  if (Buffer.isBuffer(value)) {
    return value
  }

  return Buffer.from(value)
}

async function readSourceFromDisk(relativeSourcePath: string) {
  const candidateRoots = [
    process.cwd(),
    join(process.cwd(), 'docs'),
    join(process.cwd(), 'playground'),
  ]

  for (const rootDir of candidateRoots) {
    try {
      return await readFile(join(rootDir, relativeSourcePath))
    }
    catch {
      continue
    }
  }

  return null
}

export async function serveSourceMarkdown(event: H3Event) {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    setHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const requestPath = getRoutedRequestPath(event)

  if (!isSourceMarkdownRequestPath(requestPath)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const pagePath = normalizeContentPagePath(getRenderedPathFromSourceContentPath(requestPath))

  if (isNavigationPath(pagePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const runtimeConfig = useRuntimeConfig(event) as TockDocsRuntimeConfig
  const page = await findContentPageByPath(event, pagePath, ['path', 'stem', 'extension']) as SourcePageRecord | null

  if (!page?.stem) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const extension = normalizeContentExtension(page.extension)
  const privateKnowledgeBases = Array.isArray(runtimeConfig.tockdocs?.knowledgeBases)
    ? runtimeConfig.tockdocs.knowledgeBases
    : []
  const publicKnowledgeBaseSourceDirs = runtimeConfig.public?.tockdocs?.knowledgeBaseSourceDirs || {}
  const publicKnowledgeBases = Array.isArray(runtimeConfig.public?.tockdocs?.knowledgeBases)
    ? runtimeConfig.public.tockdocs.knowledgeBases.map(kb => [kb.id, kb.id] as const)
    : []
  const knowledgeBaseSourceDirs = Object.fromEntries(
    [
      ...publicKnowledgeBases,
      ...Object.entries(publicKnowledgeBaseSourceDirs),
      ...privateKnowledgeBases.map(kb => [kb.id, kb.sourceDir] as const),
    ],
  )
  const sourcePathOptions: {
    knowledgeBaseSourceDirs: typeof knowledgeBaseSourceDirs
    collectionName?: string
  } = {
    knowledgeBaseSourceDirs,
    collectionName: page.collectionName,
  }

  const sourceFilePath = buildContentSourceFilePath(page.stem, extension, sourcePathOptions)
  const sourceAssetKey = buildContentSourceAssetKey(page.stem, extension, sourcePathOptions)
  let source: string | Uint8Array | Buffer | null = null

  if (import.meta.dev) {
    source = await readSourceFromDisk(sourceFilePath)
  }

  if (source == null) {
    const storage = useStorage(`assets:${CONTENT_SOURCE_ASSET_BASE_NAME}`)
    source = await storage.getItemRaw<string | Uint8Array | Buffer>(sourceAssetKey)
  }

  if (source == null) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const directive = `${buildAgentDocsDirectiveMarkdown(buildMarkdownAliasPath(pagePath))}\n\n`
  const body = Buffer.concat([Buffer.from(directive, 'utf8'), toBuffer(source)])

  setHeader(event, 'content-type', MARKDOWN_CONTENT_TYPE)
  setHeader(event, 'cache-control', import.meta.dev ? DEV_CACHE_CONTROL : PROD_CACHE_CONTROL)
  setHeader(event, 'x-robots-tag', 'noindex')
  setHeader(event, 'x-tockdocs-source', 'original')
  setHeader(event, 'x-tockdocs-source-extension', extension)
  setHeader(event, 'content-length', body.byteLength)

  return method === 'HEAD' ? '' : body
}
