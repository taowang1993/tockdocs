import type { H3Event } from 'h3'
import { getHeader, getMethod, setHeader, setResponseStatus } from 'h3'
import { findContentPageByPath } from './content-page'
import { getRoutedRequestPath } from './request-path'
import { AGENT_DOCS_INDEX_PATH } from '../../utils/agent-docs'
import {
  buildSourceContentPath,
  getSourceContentPathFromRawContentPath,
  hasContentSourceExtension,
  isRawMarkdownRequestPath,
  isSourceMarkdownRequestPath,
} from '../../utils/content-source'
import type { TockDocsPublicRuntimeConfig } from '../../utils/docs'
import {
  canServeNegotiatedMarkdown,
  prefersMarkdownResponse,
  shouldBypassMarkdownSourceAlias,
  shouldServeLlmsIndexForMarkdown,
} from '../../utils/markdown-negotiation'

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8'
const MARKDOWN_NEGOTIATION_VARY = 'Accept, User-Agent'

type PublicDocsConfig = TockDocsPublicRuntimeConfig

type UpstreamResponseOptions = {
  includeBody: boolean
  headerOverrides?: Record<string, string>
}

function mergeHeaderList(existingValue: string | null, nextValue: string) {
  const entries = [...(existingValue?.split(',') || []), ...nextValue.split(',')]
    .map(value => value.trim())
    .filter(Boolean)

  return [...new Set(entries)].join(', ')
}

async function sendUpstreamResponse(event: H3Event, response: Response, options: UpstreamResponseOptions) {
  setResponseStatus(event, response.status, response.statusText)

  for (const [header, value] of response.headers.entries()) {
    setHeader(event, header, value)
  }

  for (const [header, value] of Object.entries(options.headerOverrides || {})) {
    if (header.toLowerCase() === 'vary') {
      setHeader(event, header, mergeHeaderList(response.headers.get(header), value))
      continue
    }

    setHeader(event, header, value)
  }

  if (!options.includeBody) {
    return ''
  }

  return await response.text()
}

export async function serveNegotiatedMarkdown(event: H3Event) {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    return
  }

  if (!prefersMarkdownResponse({
    accept: getHeader(event, 'accept'),
    userAgent: getHeader(event, 'user-agent'),
  })) {
    return
  }

  const requestPath = getRoutedRequestPath(event)

  if (!canServeNegotiatedMarkdown(requestPath)) {
    return
  }

  const includeBody = method !== 'HEAD'
  const publicConfig = useRuntimeConfig(event).public as PublicDocsConfig

  if (shouldServeLlmsIndexForMarkdown(requestPath, publicConfig)) {
    const upstreamResponse = await event.fetch(AGENT_DOCS_INDEX_PATH, { method })

    return await sendUpstreamResponse(event, upstreamResponse, {
      includeBody,
      headerOverrides: {
        'content-type': MARKDOWN_CONTENT_TYPE,
        'vary': MARKDOWN_NEGOTIATION_VARY,
      },
    })
  }

  const page = await findContentPageByPath(event, requestPath, ['path', 'extension'])

  if (!page?.path) {
    return
  }

  const upstreamResponse = await event.fetch(buildSourceContentPath(page.path, page.extension), {
    method,
  })

  return await sendUpstreamResponse(event, upstreamResponse, {
    includeBody,
    headerOverrides: {
      vary: MARKDOWN_NEGOTIATION_VARY,
    },
  })
}

export async function serveRawMarkdownAlias(event: H3Event) {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    return
  }

  const requestPath = getRoutedRequestPath(event)

  if (!isRawMarkdownRequestPath(requestPath)) {
    return
  }

  const upstreamResponse = await event.fetch(getSourceContentPathFromRawContentPath(requestPath), {
    method,
  })

  return await sendUpstreamResponse(event, upstreamResponse, {
    includeBody: method !== 'HEAD',
  })
}

export async function serveMarkdownSourceAlias(event: H3Event) {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    return
  }

  const requestPath = getRoutedRequestPath(event)

  if (
    isRawMarkdownRequestPath(requestPath)
    || isSourceMarkdownRequestPath(requestPath)
    || shouldBypassMarkdownSourceAlias(requestPath)
    || !hasContentSourceExtension(requestPath)
  ) {
    return
  }

  const upstreamResponse = await event.fetch(`/source${requestPath}`, {
    method,
  })

  return await sendUpstreamResponse(event, upstreamResponse, {
    includeBody: method !== 'HEAD',
  })
}
