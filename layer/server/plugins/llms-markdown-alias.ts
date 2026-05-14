import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import {
  buildMarkdownAliasPath,
  getRenderedPathFromMarkdownAliasPath,
  getRenderedPathFromRawContentPath,
  getRenderedPathFromSourceContentPath,
  hasContentSourceExtension,
} from '../../utils/content-source'
import { findContentPageByPath } from '../utils/content-page'

type LlmsLink = {
  href?: string
}

type LlmsSection = {
  links?: LlmsLink[]
}

type LlmsOptions = {
  domain?: string
  sections?: LlmsSection[]
}

function isRelativeHref(href: string) {
  return href.startsWith('/')
}

function hasNonMarkdownFileExtension(path: string) {
  return /\.(?!mdc?$)[a-z0-9]+$/i.test(path)
}

async function resolveCanonicalMarkdownPath(event: H3Event, path: string, cache: Map<string, string | null>) {
  let renderedPath = path

  if (path.startsWith('/raw/')) {
    renderedPath = getRenderedPathFromRawContentPath(path)
  }
  else if (path.startsWith('/source/')) {
    renderedPath = getRenderedPathFromSourceContentPath(path)
  }
  else if (hasContentSourceExtension(path)) {
    renderedPath = getRenderedPathFromMarkdownAliasPath(path)
  }

  if (hasNonMarkdownFileExtension(renderedPath)) {
    return null
  }

  if (cache.has(renderedPath)) {
    return cache.get(renderedPath) || null
  }

  const page = await findContentPageByPath(event, renderedPath, ['path'])
  const canonicalPath = page?.path ? buildMarkdownAliasPath(page.path) : null

  cache.set(renderedPath, canonicalPath)
  return canonicalPath
}

async function rewriteHrefToMarkdownAlias(event: H3Event, href: string, domain: string, cache: Map<string, string | null>) {
  const requestOrigin = getRequestURL(event).origin

  try {
    const parsed = new URL(href, domain || requestOrigin)
    const configuredOrigin = domain ? new URL(domain).origin : requestOrigin
    const isInternal = isRelativeHref(href) || parsed.origin === configuredOrigin || parsed.origin === requestOrigin

    if (!isInternal) {
      return href
    }

    const canonicalPath = await resolveCanonicalMarkdownPath(event, parsed.pathname, cache)

    if (!canonicalPath) {
      return href
    }

    if (isRelativeHref(href)) {
      return `${canonicalPath}${parsed.search}${parsed.hash}`
    }

    parsed.pathname = canonicalPath
    return parsed.toString()
  }
  catch {
    return href
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('llms:generate', async (event, options: LlmsOptions) => {
    const cache = new Map<string, string | null>()
    const domain = options.domain || getRequestURL(event).origin

    for (const section of options.sections || []) {
      for (const link of section.links || []) {
        if (!link.href) {
          continue
        }

        link.href = await rewriteHrefToMarkdownAlias(event, link.href, domain, cache)
      }
    }
  })
})
