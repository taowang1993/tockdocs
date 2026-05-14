import type { Collections } from '@nuxt/content'
import type { H3Event } from 'h3'
import { queryCollection } from '@nuxt/content/server'
import { getFilteredLocaleCodes, getLandingCollectionName, getDocsMode, hasSiteContent } from '../../utils/docs'
import { getRenderedPathFromMarkdownAliasPath } from '../../utils/content-source'
import { getDocsContextFromPath } from './content'

export type ContentPageRecord = {
  collectionName?: string
  path?: string
  stem?: string
  extension?: string
  title?: string
  description?: string
}

export function normalizeContentPagePath(path: string) {
  return getRenderedPathFromMarkdownAliasPath(path)
}

function getCandidateCollections(path: string, config: Parameters<typeof getDocsMode>[0]) {
  const normalizedPath = normalizeContentPagePath(path)
  const docsContext = getDocsContextFromPath(normalizedPath, config)
  const collections = docsContext.collectionName ? [docsContext.collectionName] : []
  const docsMode = getDocsMode(config)

  if (docsMode === 'kb') {
    if (hasSiteContent(config)) {
      collections.push('site')
    }

    return [...new Set(collections)]
  }

  const localeCodes = getFilteredLocaleCodes(config)

  if (localeCodes.length > 0) {
    const localeCandidate = normalizedPath.replace(/^\//, '')

    if (localeCandidate && !localeCandidate.includes('/') && localeCodes.includes(localeCandidate)) {
      collections.push(getLandingCollectionName(localeCandidate))
    }

    return [...new Set(collections)]
  }

  if (normalizedPath === '/') {
    collections.push('landing')
  }

  return [...new Set(collections)]
}

export async function findContentPageByPath(
  event: H3Event,
  path: string,
  fields: Array<'path' | 'stem' | 'extension' | 'title' | 'description'> = ['path', 'stem', 'extension'],
): Promise<ContentPageRecord | null> {
  const config = useRuntimeConfig(event).public as Parameters<typeof getDocsMode>[0]
  const normalizedPath = normalizeContentPagePath(path)
  const collections = getCandidateCollections(normalizedPath, config)

  for (const collectionName of collections) {
    const page = await queryCollection(event, collectionName as keyof Collections)
      .where('path', '=', normalizedPath)
      .select(...fields)
      .first() as ContentPageRecord | null

    if (page) {
      return {
        ...page,
        collectionName,
      }
    }
  }

  return null
}
