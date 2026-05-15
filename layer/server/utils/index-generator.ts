import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { joinURL } from 'ufo'
import { parse as parseYaml } from 'yaml'
import {
  buildDocsPath,
  getDefaultLocale,
  getDocsMode,
  resolveKnowledgeBaseLocale,
  type TockDocsPublicRuntimeConfig,
} from '../../utils/docs'
import { buildMarkdownAliasPath } from '../../utils/content-source'
import { docsFolderExists } from '../../utils/pages'

const MARKDOWN_FILE_RE = /\.(md|mdc)$/i
const pathCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export const TOCKDOCS_INDEX_ASSET_BASE_NAME = 'tockdocs-index'
export const LEGACY_INDEX_SCOPE_ID = '__legacy__'
export const INDEX_TOKEN_BUDGET = 8_000
export const INDEX_CACHE_TTL_MS = 60_000
export const DEV_INDEX_CACHE_TTL_MS = 10_000

export interface IndexPage {
  title: string
  path: string
  description?: string
  url: string
}

export interface IndexBuildSpec {
  scopeId: string
  locale: string
  title: string
  sourceDir: string
  routePrefix: string
  excludeRelativePaths?: string[]
}

export interface BuiltIndexDocument {
  spec: IndexBuildSpec
  pages: IndexPage[]
  content: string
}

export interface CollectedIndexSourcePage extends IndexPage {
  content: string
}

function titleize(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '')
}

function stripOrderingPrefix(segment: string) {
  return segment.replace(/^\d+\./, '')
}

function escapeMarkdownLinkText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

function normalizeDescription(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().split(/\s/u).filter(Boolean).join(' ')
  return normalized || undefined
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const normalized = normalizeLineBreaks(content)
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)

  if (!match?.[1]) {
    return {}
  }

  try {
    return (parseYaml(match[1]) as Record<string, unknown>) || {}
  }
  catch {
    return {}
  }
}

function stripFrontmatter(content: string) {
  const normalized = normalizeLineBreaks(content)

  if (!normalized.startsWith('---\n')) {
    return normalized
  }

  const endOfFrontmatter = normalized.indexOf('\n---\n', 4)
  if (endOfFrontmatter === -1) {
    return normalized
  }

  return normalized.slice(endOfFrontmatter + 5).replace(/^\n+/, '')
}

function getFirstHeading(content: string) {
  const body = stripFrontmatter(content)

  for (const line of body.split('\n')) {
    if (line[0] !== '#' || line[1] === '#') {
      continue
    }

    const heading = line.slice(1).trimStart().trim()
    if (heading) {
      return heading
    }
  }

  return undefined
}

function deriveTitleFromRelativePath(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath).replace(MARKDOWN_FILE_RE, '')
  const segments = normalized
    .split('/')
    .filter(Boolean)
    .map(stripOrderingPrefix)

  if (segments.at(-1)?.toLowerCase() === 'index') {
    segments.pop()
  }

  const fallback = segments.at(-1) || 'home'
  return titleize(fallback)
}

function buildPagePath(routePrefix: string, relativePath: string) {
  const normalized = normalizeRelativePath(relativePath).replace(MARKDOWN_FILE_RE, '')
  const slug = normalized
    .split('/')
    .filter(Boolean)
    .map(stripOrderingPrefix)

  if (slug.at(-1)?.toLowerCase() === 'index') {
    slug.pop()
  }

  if (slug.length === 0) {
    return routePrefix || '/'
  }

  return joinURL(routePrefix || '/', ...slug)
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return []
  }

  const files: string[] = []
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter(entry => !entry.name.startsWith('.'))
    .sort((left, right) => pathCollator.compare(left.name, right.name))

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(fullPath))
      continue
    }

    if (entry.isFile() && MARKDOWN_FILE_RE.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

export async function collectIndexSourcePages(spec: IndexBuildSpec): Promise<CollectedIndexSourcePage[]> {
  const files = await listMarkdownFiles(spec.sourceDir)
  const excluded = new Set((spec.excludeRelativePaths || []).map(normalizeRelativePath))
  const pages = await Promise.all(files.map(async (filePath) => {
    const relativePath = normalizeRelativePath(relative(spec.sourceDir, filePath))

    if (excluded.has(relativePath)) {
      return null
    }

    const content = await readFile(filePath, 'utf8')
    const frontmatter = parseFrontmatter(content)
    const pagePath = buildPagePath(spec.routePrefix, relativePath)
    const title = typeof frontmatter.title === 'string' && frontmatter.title.trim().length > 0
      ? frontmatter.title.trim()
      : getFirstHeading(content)
        || deriveTitleFromRelativePath(relativePath)

    const description = normalizeDescription(frontmatter.description)
    const page: CollectedIndexSourcePage = {
      title,
      path: pagePath,
      url: buildMarkdownAliasPath(pagePath),
      content,
    }

    if (description) {
      page.description = description
    }

    return page
  }))

  return pages.filter((page): page is CollectedIndexSourcePage => page !== null)
}

async function collectIndexPages(spec: IndexBuildSpec): Promise<IndexPage[]> {
  return (await collectIndexSourcePages(spec)).map(({ content: _content, ...page }) => page)
}

export function generateIndex(scopeTitle: string, locale: string, pages: IndexPage[]) {
  const heading = `# Knowledge Base: ${scopeTitle} (${locale})`

  if (pages.length === 0) {
    return `${heading}\n\n_No indexed pages are available for this scope yet._\n`
  }

  const lines = [heading, '']

  for (const page of pages) {
    lines.push(`- [${escapeMarkdownLinkText(page.title)}](${page.url})`)

    if (page.description) {
      lines.push(`  Summary: ${page.description}`)
    }

    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function estimateIndexTokenCount(content: string) {
  return Math.ceil(content.length / 4)
}

export function absolutizeIndexLinks(content: string, siteUrl: string) {
  const origin = siteUrl.replace(/\/$/, '')

  if (!origin) {
    return content
  }

  return content.replace(/\]\((\/[^)\s]+)\)/g, (_match, path: string) => `](${origin}${path})`)
}

export function getIndexStorageKey(scopeId: string, locale: string) {
  return `${scopeId}/${locale}.md`
}

export function resolveIndexScope(
  config: TockDocsPublicRuntimeConfig,
  scope: { kb?: string, locale?: string },
) {
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    if (!scope.kb) {
      return null
    }

    return {
      scopeId: scope.kb,
      locale: resolveKnowledgeBaseLocale(config, scope.kb, scope.locale),
    }
  }

  return {
    scopeId: LEGACY_INDEX_SCOPE_ID,
    locale: scope.locale || getDefaultLocale(config),
  }
}

export function getIndexBuildSpecs(
  rootDir: string,
  config: TockDocsPublicRuntimeConfig,
  options: { siteName?: string } = {},
): IndexBuildSpec[] {
  const mode = getDocsMode(config)

  if (mode === 'kb') {
    const knowledgeBases = config.tockdocs?.knowledgeBases || []
    const sourceDirs = config.tockdocs?.knowledgeBaseSourceDirs || {}

    return knowledgeBases.flatMap(knowledgeBase =>
      knowledgeBase.locales.map((locale) => {
        const sourceDir = sourceDirs[knowledgeBase.id] || knowledgeBase.id

        return {
          scopeId: knowledgeBase.id,
          locale,
          title: knowledgeBase.titles?.[locale] || knowledgeBase.title || titleize(knowledgeBase.id),
          sourceDir: join(rootDir, 'content', sourceDir, locale),
          routePrefix: buildDocsPath({
            mode: 'kb',
            kb: knowledgeBase.id,
            locale,
          }),
        } satisfies IndexBuildSpec
      }),
    )
  }

  const siteName = options.siteName || 'Documentation'
  const filteredLocales = config.tockdocs?.filteredLocales?.map(locale => locale.code).filter(Boolean) || []

  if (filteredLocales.length > 0) {
    return filteredLocales.map((locale) => {
      const hasDocsFolder = docsFolderExists(rootDir, locale)

      return {
        scopeId: LEGACY_INDEX_SCOPE_ID,
        locale,
        title: siteName,
        sourceDir: hasDocsFolder
          ? join(rootDir, 'content', locale, 'docs')
          : join(rootDir, 'content', locale),
        routePrefix: buildDocsPath({
          mode: 'legacy',
          locale,
          slug: hasDocsFolder ? ['docs'] : [],
        }),
        excludeRelativePaths: hasDocsFolder ? undefined : ['index.md', 'index.mdc'],
      } satisfies IndexBuildSpec
    })
  }

  const hasDocsFolder = docsFolderExists(rootDir)

  return [{
    scopeId: LEGACY_INDEX_SCOPE_ID,
    locale: getDefaultLocale(config),
    title: siteName,
    sourceDir: hasDocsFolder
      ? join(rootDir, 'content', 'docs')
      : join(rootDir, 'content'),
    routePrefix: buildDocsPath({
      mode: 'legacy',
      slug: hasDocsFolder ? ['docs'] : [],
    }),
    excludeRelativePaths: hasDocsFolder ? undefined : ['index.md', 'index.mdc'],
  }]
}

export function findIndexBuildSpec(
  rootDir: string,
  config: TockDocsPublicRuntimeConfig,
  scopeId: string,
  locale: string,
  options: { siteName?: string } = {},
) {
  return getIndexBuildSpecs(rootDir, config, options)
    .find(spec => spec.scopeId === scopeId && spec.locale === locale)
}

export async function buildIndexForSpec(spec: IndexBuildSpec): Promise<BuiltIndexDocument> {
  const pages = await collectIndexPages(spec)

  return {
    spec,
    pages,
    content: generateIndex(spec.title, spec.locale, pages),
  }
}

export async function buildIndexForScope(
  rootDir: string,
  config: TockDocsPublicRuntimeConfig,
  scopeId: string,
  locale: string,
  options: { siteName?: string } = {},
) {
  const spec = findIndexBuildSpec(rootDir, config, scopeId, locale, options)

  if (!spec || !existsSync(spec.sourceDir)) {
    return null
  }

  return buildIndexForSpec(spec)
}

export async function buildAllIndexes(
  rootDir: string,
  config: TockDocsPublicRuntimeConfig,
  options: { siteName?: string } = {},
) {
  const specs = getIndexBuildSpecs(rootDir, config, options)
    .filter(spec => existsSync(spec.sourceDir))

  return Promise.all(specs.map(spec => buildIndexForSpec(spec)))
}
