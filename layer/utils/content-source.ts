const CONTENT_SOURCE_EXTENSION_RE = /\.(md|mdc)$/i

export const RAW_CONTENT_ROUTE_PREFIX = '/raw'
export const SOURCE_CONTENT_ROUTE_PREFIX = '/source'
export const CONTENT_SOURCE_ASSET_BASE_NAME = 'tockdocs-content-source'
export const CONTENT_SOURCE_ASSET_PATTERN = '**/*.{md,mdc}'

type ContentSourcePathOptions = {
  knowledgeBaseSourceDirs?: Record<string, string>
  collectionName?: string
}

export function normalizeContentExtension(extension?: string) {
  const normalizedExtension = extension?.trim().replace(/^\.+/, '')
  return normalizedExtension || 'md'
}

export function hasContentSourceExtension(path: string) {
  return CONTENT_SOURCE_EXTENSION_RE.test(path)
}

export function stripContentSourceExtension(path: string) {
  return path.replace(CONTENT_SOURCE_EXTENSION_RE, '')
}

export function normalizeRenderedMarkdownAliasPath(path: string) {
  return path === '/index' ? '/' : path
}

export function isRawMarkdownRequestPath(path: string) {
  return path.startsWith(`${RAW_CONTENT_ROUTE_PREFIX}/`) && hasContentSourceExtension(path)
}

export function buildRawContentPath(path: string, extension?: string) {
  if (path === '/') {
    return `${RAW_CONTENT_ROUTE_PREFIX}/index.${normalizeContentExtension(extension)}`
  }

  return `${RAW_CONTENT_ROUTE_PREFIX}${path}.${normalizeContentExtension(extension)}`
}

export function getRenderedPathFromRawContentPath(rawPath: string) {
  return normalizeRenderedMarkdownAliasPath(stripContentSourceExtension(rawPath.replace(/^\/raw/, '')))
}

export function getSourceContentPathFromRawContentPath(rawPath: string) {
  return rawPath.replace(/^\/raw(?=\/)/, SOURCE_CONTENT_ROUTE_PREFIX)
}

export function isSourceMarkdownRequestPath(path: string) {
  return path.startsWith(`${SOURCE_CONTENT_ROUTE_PREFIX}/`) && hasContentSourceExtension(path)
}

export function buildSourceContentPath(path: string, extension?: string) {
  if (path === '/') {
    return `${SOURCE_CONTENT_ROUTE_PREFIX}/index.${normalizeContentExtension(extension)}`
  }

  return `${SOURCE_CONTENT_ROUTE_PREFIX}${path}.${normalizeContentExtension(extension)}`
}

export function getRenderedPathFromSourceContentPath(sourcePath: string) {
  return normalizeRenderedMarkdownAliasPath(stripContentSourceExtension(sourcePath.replace(/^\/source/, '')))
}

export function buildMarkdownAliasPath(path: string) {
  const normalizedPath = stripContentSourceExtension(path).replace(/\/$/, '') || '/'

  if (normalizedPath === '/') {
    return '/index.md'
  }

  return `${normalizedPath}.md`
}

export function getRenderedPathFromMarkdownAliasPath(markdownAliasPath: string) {
  return normalizeRenderedMarkdownAliasPath(stripContentSourceExtension(markdownAliasPath))
}

export function buildContentSourceFilePath(stem: string, extension?: string, options?: ContentSourcePathOptions) {
  const normalizedStem = stem.replace(/\\/g, '/').replace(/^\/+/, '')

  if (options?.collectionName === 'site') {
    return `content/site/${normalizedStem}.${normalizeContentExtension(extension)}`
  }

  const segments = normalizedStem.split('/').filter(Boolean)
  const kbId = segments[1]
  const kbSourceDir = kbId ? options?.knowledgeBaseSourceDirs?.[kbId] : undefined

  if (segments[0] === 'docs' && kbSourceDir && segments[2] && segments.length >= 4) {
    return `content/${[kbSourceDir, segments[2], ...segments.slice(3)].join('/')}.${normalizeContentExtension(extension)}`
  }

  return `content/${normalizedStem}.${normalizeContentExtension(extension)}`
}

export function buildContentSourceAssetKey(stem: string, extension?: string, options?: ContentSourcePathOptions) {
  return buildContentSourceFilePath(stem, extension, options).replace(/^content\//, '')
}
