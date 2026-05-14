import { AGENT_DOCS_INDEX_PATH } from './agent-docs'
import { hasContentSourceExtension, isRawMarkdownRequestPath, isSourceMarkdownRequestPath } from './content-source'
import { getDocsMode, getFilteredLocaleCodes, type TockDocsPublicRuntimeConfig } from './docs'

const TOCKDOCS_INTERNAL_MARKDOWN_PATH_PREFIXES = [
  '/__tockdocs__/index/',
]

function hasNonMarkdownFileExtension(path: string) {
  return /\.(?!mdc?$)[a-z0-9]+$/i.test(path)
}

export function prefersMarkdownResponse(options: { accept?: string | null, userAgent?: string | null }) {
  return /\btext\/markdown\b/i.test(options.accept || '')
    || /^curl\/\S+/i.test((options.userAgent || '').trim())
}

export function canServeNegotiatedMarkdown(requestPath: string) {
  if (requestPath === AGENT_DOCS_INDEX_PATH || requestPath === '/llms-full.txt') {
    return false
  }

  if (
    requestPath.startsWith('/.well-known/')
    || requestPath.startsWith('/__tockdocs__/')
    || requestPath.startsWith('/_ipx/')
    || requestPath.startsWith('/_nuxt/')
    || requestPath.startsWith('/_og/')
    || requestPath.startsWith('/_vercel/')
    || requestPath.startsWith('/api/')
    || requestPath.startsWith('/mcp')
  ) {
    return false
  }

  if (isRawMarkdownRequestPath(requestPath) || isSourceMarkdownRequestPath(requestPath) || hasContentSourceExtension(requestPath)) {
    return false
  }

  if (hasNonMarkdownFileExtension(requestPath)) {
    return false
  }

  return true
}

export function shouldBypassMarkdownSourceAlias(requestPath: string) {
  return TOCKDOCS_INTERNAL_MARKDOWN_PATH_PREFIXES.some(prefix => requestPath.startsWith(prefix))
}

export function shouldServeLlmsIndexForMarkdown(
  requestPath: string,
  config: TockDocsPublicRuntimeConfig,
) {
  if (requestPath === '/') {
    return true
  }

  if (getDocsMode(config) !== 'legacy') {
    return false
  }

  const localeCandidate = requestPath.replace(/^\/+/, '')

  return Boolean(localeCandidate)
    && !localeCandidate.includes('/')
    && getFilteredLocaleCodes(config).includes(localeCandidate)
}
