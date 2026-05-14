import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const docsContentDir = resolve(repoRoot, 'docs/content')
const docsBuildOutputs = [
  {
    label: 'Nuxt build output',
    publicDir: resolve(repoRoot, 'docs/.output/public'),
    serverEntry: resolve(repoRoot, 'docs/.output/server/index.mjs'),
    serverKind: 'node-entry',
  },
  {
    label: 'Vercel build output',
    publicDir: resolve(repoRoot, 'docs/.vercel/output/static'),
    serverEntry: resolve(repoRoot, 'docs/.vercel/output/functions/__fallback.func/index.mjs'),
    serverKind: 'node-listener',
  },
]

function resolveBuiltDocsOutput() {
  const preferredOutputs = process.env.VERCEL
    ? [docsBuildOutputs[1], docsBuildOutputs[0]]
    : docsBuildOutputs

  for (const output of preferredOutputs) {
    if (existsSync(output.publicDir)) {
      return output
    }
  }

  return null
}

const docsBuildOutput = resolveBuiltDocsOutput()

assert.ok(existsSync(docsContentDir), `Missing docs content directory: ${docsContentDir}`)
assert.ok(
  docsBuildOutput,
  `Missing built docs output: ${docsBuildOutputs.map(output => output.publicDir).join(' or ')}. Run the docs build before this check.`,
)

const docsOutputDir = docsBuildOutput.publicDir
const docsServerEntry = docsBuildOutput.serverEntry
const SLOT_MARKERS = ['title', 'description', 'header', 'footer', 'default', 'code', 'links', 'features']
const SLOT_MARKER_RE = new RegExp(`^#(?:${SLOT_MARKERS.join('|')})$`)

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return walkFiles(filePath)
    }

    return /\.mdc?$/i.test(entry.name) ? [filePath] : []
  })
}

function parseSimpleYamlBlock(lines) {
  const result = {}
  let currentArrayKey = null

  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/\r$/, '').trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    if (trimmed.startsWith('- ')) {
      if (currentArrayKey) {
        result[currentArrayKey] ||= []
        result[currentArrayKey].push(trimmed.slice(2).trim())
      }
      continue
    }

    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex === -1) {
      currentArrayKey = null
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (value) {
      result[key] = value
      currentArrayKey = null
      continue
    }

    result[key] ||= []
    currentArrayKey = key
  }

  return result
}

function getKnowledgeBaseConfigs() {
  const configs = new Map()

  for (const entry of readdirSync(docsContentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const configPath = join(docsContentDir, entry.name, 'kb.yml')
    if (!existsSync(configPath)) {
      continue
    }

    const config = parseSimpleYamlBlock(readFileSync(configPath, 'utf8').split('\n'))
    configs.set(entry.name, {
      sourceDir: entry.name,
      id: config.id || entry.name,
    })
  }

  return configs
}

function stripPageFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') {
    return { bodyLines: lines, frontmatter: {} }
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (endIndex === -1) {
    return { bodyLines: lines, frontmatter: {} }
  }

  return {
    frontmatter: parseSimpleYamlBlock(lines.slice(1, endIndex)),
    bodyLines: lines.slice(endIndex + 1),
  }
}

function stripOrderingPrefix(segment) {
  return segment.replace(/^\d+\./, '')
}

function normalizeRouteSegments(segments) {
  const normalized = segments
    .map(segment => segment.replace(/\.(md|mdc)$/i, ''))
    .map(stripOrderingPrefix)
    .filter(Boolean)

  if (normalized.at(-1) === 'index') {
    normalized.pop()
  }

  return normalized
}

function deriveRoutePath(filePath, knowledgeBaseConfigs) {
  const relativePath = relative(docsContentDir, filePath)
  const segments = relativePath.split('/').filter(Boolean)

  if (segments[0] === 'site') {
    const routeSegments = normalizeRouteSegments(segments.slice(1))
    return routeSegments.length > 0 ? `/${routeSegments.join('/')}` : '/'
  }

  const [sourceDir, locale, ...rest] = segments
  const knowledgeBase = knowledgeBaseConfigs.get(sourceDir)

  assert.ok(knowledgeBase, `Unable to resolve knowledge base for ${relativePath}`)
  assert.ok(locale, `Missing locale segment for ${relativePath}`)

  const routeSegments = normalizeRouteSegments(rest)
  return `/docs/${knowledgeBase.id}/${locale}${routeSegments.length > 0 ? `/${routeSegments.join('/')}` : ''}`
}

function getBuiltHtmlPath(routePath) {
  return routePath === '/'
    ? join(docsOutputDir, 'index.html')
    : join(docsOutputDir, `${routePath.replace(/^\//, '')}.html`)
}

function createCodeFenceState(line) {
  const match = line.match(/^\s*(`{3,}|~{3,})/)
  return match ? match[1][0].repeat(match[1].length) : null
}

function decodeOgRoutePath(encodedPath) {
  const padded = encodedPath.padEnd(Math.ceil(encodedPath.length / 4) * 4, '=')
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
}

function extractOgImages(line) {
  return [...line.matchAll(/(\/_og\/s\/[^)\s]+\.png)/gi)].map((match) => {
    const imagePath = match[1]
    const encodedRoutePath = imagePath.match(/,p_([\w+/-]+)\.png/i)?.[1]

    return {
      imagePath,
      routePath: encodedRoutePath ? decodeOgRoutePath(encodedRoutePath) : null,
    }
  })
}

function collapseWhitespace(text) {
  return text.trim().split(/\s+/u).join(' ')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripInlineMath(text) {
  let normalized = ''
  let inMath = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]

    if (character === '$' && text[index - 1] !== '\\') {
      inMath = !inMath
      continue
    }

    if (!inMath) {
      normalized += character
    }
  }

  return normalized
}

function normalizeInlineMarkdown(text) {
  return collapseWhitespace(stripInlineMath(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\\(.)/g, '$1'))
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
}

function extractVisibleText(html) {
  return collapseWhitespace(decodeHtmlEntities(html)
    .replace(/<[^>]+>/g, ' '))
}

function hasTrailingInlineAdmonition(text) {
  if (!(text.startsWith('- ') || text.startsWith('* '))) {
    return false
  }

  return [' :tip[', ' :note[', ' :warning[', ' :caution['].some(token => text.includes(token))
}

function analyzeSource(filePath) {
  const rawSource = readFileSync(filePath, 'utf8').replace(/\r/g, '')
  const allLines = rawSource.split('\n')
  const { bodyLines, frontmatter } = stripPageFrontmatter(allLines)

  const tokens = new Set()
  const ogImagePaths = new Set()
  const ogRoutePaths = new Set()
  const headings = new Set()
  let isGuarded = false
  let codeFence = null
  let pendingComponentFence = null
  let inComponentFrontmatter = false

  for (const [index, line] of bodyLines.entries()) {
    const trimmed = line.trim()

    if (codeFence) {
      if (trimmed.startsWith(codeFence)) {
        codeFence = null
      }
      continue
    }

    const nextCodeFence = createCodeFenceState(line)
    if (nextCodeFence) {
      codeFence = nextCodeFence
      continue
    }

    assert.notStrictEqual(trimmed, '## ::::u-page-card', `${filePath}: component fence was converted into a heading.`)
    assert.ok(!/^#{1,6}\s+:{2,}[a-z0-9][\w-]*/i.test(trimmed), `${filePath}:${index + 1}: component fence was converted into a heading.`)
    assert.ok(!/^#{1,6}\s+#(?:title|description|header|footer|default|code)$/.test(trimmed), `${filePath}:${index + 1}: slot marker was converted into a heading.`)
    assert.ok(!/^\\:{2,}/.test(trimmed), `${filePath}:${index + 1}: escaped component fence leaked into prose.`)
    assert.ok(!hasTrailingInlineAdmonition(trimmed), `${filePath}:${index + 1}: admonition shorthand should be on its own line, not appended to list content.`)
    assert.notStrictEqual(trimmed, 'target: \\_blank', `${filePath}:${index + 1}: escaped _blank leaked into component props.`)
    assert.ok(!/https?:\/\/[^)\s]+\/(?:_og|_ipx)\//i.test(trimmed), `${filePath}:${index + 1}: same-site generated asset URLs should use relative paths.`)

    for (const { imagePath, routePath } of extractOgImages(trimmed)) {
      ogImagePaths.add(imagePath)
      if (routePath) {
        ogRoutePaths.add(routePath)
      }
    }

    const componentFenceMatch = trimmed.match(/^:{2,}[a-z0-9][\w-]*(?:\{[^}\n]*\})?/i)
    if (componentFenceMatch) {
      assert.ok(
        !trimmed.slice(componentFenceMatch[0].length).trim(),
        `${filePath}:${index + 1}: component fence has trailing content on the same line.`,
      )
    }

    if (pendingComponentFence && !trimmed) {
      pendingComponentFence.hasBlankLine = true
      continue
    }

    const isPropLikeLine = /^[a-z][\w-]*:\s*/i.test(trimmed)

    if (pendingComponentFence && trimmed === '---') {
      assert.ok(
        !pendingComponentFence.hasBlankLine,
        `${filePath}:${pendingComponentFence.lineNumber}: blank line between component fence and component frontmatter.`,
      )
      inComponentFrontmatter = true
      pendingComponentFence = null
      isGuarded = true
      continue
    }

    if (pendingComponentFence && isPropLikeLine) {
      assert.ok(
        pendingComponentFence.hasInlineProps,
        `${filePath}:${pendingComponentFence.lineNumber}: component frontmatter is missing before a property-like line.`,
      )
      pendingComponentFence = null
      continue
    }

    if (pendingComponentFence && trimmed) {
      pendingComponentFence = null
    }

    if (inComponentFrontmatter) {
      if (trimmed === '---') {
        inComponentFrontmatter = false
        continue
      }

      continue
    }

    if (!trimmed) {
      continue
    }

    const isSlotMarker = SLOT_MARKER_RE.test(trimmed)
    const isComponentFence = Boolean(componentFenceMatch)

    if (/^#{2,6} /.test(trimmed)) {
      const normalizedHeading = normalizeInlineMarkdown(trimmed.replace(/^#{2,6} /, ''))
      if (normalizedHeading) {
        headings.add(normalizedHeading)
      }
    }

    if (isSlotMarker) {
      tokens.add(trimmed)
      isGuarded = true
    }

    if (isComponentFence) {
      isGuarded = true
      pendingComponentFence = {
        lineNumber: index + 1,
        hasBlankLine: false,
        hasInlineProps: /\{/.test(trimmed),
      }
    }
  }

  return {
    filePath,
    isGuarded,
    headings: [...headings],
    tokens: [...tokens],
    ogImagePaths: [...ogImagePaths],
    ogRoutePaths: [...ogRoutePaths],
    frontmatter,
  }
}

function stripNonVisibleHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
}

function stripCodeExampleHtml(html) {
  return html
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ')
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms))
}

async function waitForServer(baseUrl) {
  let lastError = null

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' })
      if (response.status < 500) {
        return
      }
    }
    catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw lastError || new Error(`Timed out waiting for docs server at ${baseUrl}`)
}

let activeDocsServer = null

async function getDocsServer() {
  if (activeDocsServer) {
    return activeDocsServer
  }

  assert.ok(docsServerEntry, `Missing built docs server entry for ${docsOutputDir}.`)
  assert.ok(existsSync(docsServerEntry), `Missing built docs server entry: ${docsServerEntry}`)

  const port = 4100 + Math.floor(Math.random() * 1000)
  const baseUrl = `http://127.0.0.1:${port}`
  const child = docsBuildOutput.serverKind === 'node-listener'
    ? spawn(process.execPath, ['--input-type=module', '--eval', `import http from 'node:http'
import listener from ${JSON.stringify(pathToFileURL(docsServerEntry).href)}
http.createServer(listener).listen(${port}, '127.0.0.1')
`], {
        cwd: repoRoot,
        stdio: 'ignore',
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(port),
          NITRO_HOST: '127.0.0.1',
          NITRO_PORT: String(port),
        },
      })
    : spawn(process.execPath, [docsServerEntry], {
        cwd: repoRoot,
        stdio: 'ignore',
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(port),
          NITRO_HOST: '127.0.0.1',
          NITRO_PORT: String(port),
        },
      })

  await waitForServer(baseUrl)
  activeDocsServer = { child, baseUrl }
  return activeDocsServer
}

async function renderRouteViaServer(routePath) {
  const { baseUrl } = await getDocsServer()
  const response = await fetch(`${baseUrl}${routePath}`)

  assert.ok(response.ok, `Unable to render ${routePath} from the built docs server (status ${response.status}).`)

  return await response.text()
}

const knowledgeBaseConfigs = getKnowledgeBaseConfigs()
const markdownFiles = walkFiles(docsContentDir)
const analyzedPages = markdownFiles.map(analyzeSource)
const validRoutePaths = new Set(markdownFiles.map(filePath => deriveRoutePath(filePath, knowledgeBaseConfigs)))
const guardedPages = analyzedPages.filter(page => page.isGuarded)

assert.ok(guardedPages.length > 0, 'No guarded MDC pages were detected under docs/content.')

for (const page of analyzedPages) {
  for (const ogImagePath of page.ogImagePaths) {
    assert.ok(
      existsSync(join(docsOutputDir, ogImagePath.replace(/^\//, ''))),
      `${page.filePath}: embedded OG image was not prerendered: ${ogImagePath}. In zeroRuntime mode, inline OG examples must reference generated image files that exist in the build output.`,
    )
  }

  for (const ogRoutePath of page.ogRoutePaths) {
    assert.ok(
      validRoutePaths.has(ogRoutePath),
      `${page.filePath}: embedded OG image targets missing route ${ogRoutePath}. Update the encoded p_ path for the current content architecture.`,
    )
  }
}

try {
  for (const page of guardedPages) {
    const routePath = deriveRoutePath(page.filePath, knowledgeBaseConfigs)
    const builtHtmlPath = getBuiltHtmlPath(routePath)
    const renderedSource = existsSync(builtHtmlPath)
      ? readFileSync(builtHtmlPath, 'utf8')
      : await renderRouteViaServer(routePath)
    const renderedHtml = stripNonVisibleHtml(renderedSource)
    const tokenCheckHtml = stripCodeExampleHtml(renderedHtml)
    const renderedVisibleText = extractVisibleText(renderedHtml)

    for (const token of page.tokens) {
      assert.ok(
        !new RegExp(`(^|[^\\w-])${escapeRegExp(token)}(?=$|[^\\w-])`).test(tokenCheckHtml),
        `${page.filePath}: raw MDC token leaked into rendered HTML for ${routePath}: ${token}`,
      )
    }

    for (const heading of page.headings) {
      assert.ok(
        renderedVisibleText.includes(heading),
        `${page.filePath}: rendered output for ${routePath} is missing heading text from the source: ${heading}`,
      )
    }
  }

  console.log(`Content integrity passed for ${guardedPages.length} guarded MDC page(s).`)
}
finally {
  activeDocsServer?.child.kill('SIGTERM')
}
