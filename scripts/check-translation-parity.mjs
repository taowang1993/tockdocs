import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const docsContentDir = resolve(repoRoot, 'docs/content')
const layerRequire = createRequire(resolve(repoRoot, 'layer/package.json'))
const { parseDocument } = layerRequire('yaml')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect files matching a predicate.
 *
 * @param {string} dir
 * @param {(f: string) => boolean} predicate
 * @returns {string[]} sorted absolute file paths
 */
function walkDir(dir, predicate = () => true) {
  /** @type {string[]} */
  const results = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      }
      else if (entry.isFile() && predicate(full)) {
        results.push(full)
      }
    }
  }
  return results.sort()
}

/**
 * Extract structural markers from raw markdown source.
 *
 * @param {string} content - raw markdown source
 * @returns {object} headingLevels, headingCount, componentNames, componentCount, codeBlockCount, imageCount
 */
function extractStructure(content) {
  const headings = []
  const components = []
  let codeBlockCount = 0
  let imageCount = 0

  const lines = content.split('\n')
  let inCodeFence = false
  let inFrontmatter = false
  let frontmatterDone = false

  for (const line of lines) {
    // Track frontmatter block
    if (!frontmatterDone && line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      }
      inFrontmatter = false
      frontmatterDone = true
      continue
    }
    if (inFrontmatter) {
      continue
    }

    // Track code fences
    if (line.trim().startsWith('```')) {
      if (!inCodeFence) {
        inCodeFence = true
      }
      else {
        inCodeFence = false
        codeBlockCount++
      }
      continue
    }
    if (inCodeFence) {
      continue
    }

    // Headings (outside code fences and frontmatter)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      headings.push({ level: headingMatch[1].length, text: headingMatch[2].trim() })
      continue
    }

    // Component fences (e.g. ::note, :::card-group)
    const compMatch = line.match(/^(:{1,6})([\w-]+)(?:\{.*\})?\s*$/)
    if (compMatch) {
      const name = compMatch[2]
      if (name && !['br', 'hr'].includes(name)) {
        // Skip closing fences (purely colons)
        const isClosing = /^:+$/.test(line.trim())
        if (!isClosing) {
          components.push({ depth: compMatch[1].length, name })
        }
      }
    }

    // Inline component references (e.g. :icon{...}, :site-image{...})
    const inlineComp = line.match(/:([\w-]+)\{/)
    if (inlineComp && !inlineComp[1].startsWith('br')) {
      const name = inlineComp[1]
      if (['icon', 'kbd', 'site-image', 'badge', 'button', 'color-mode-image'].includes(name)) {
        components.push({ depth: 0, name })
      }
    }

    // Images
    if (/!\[.*\]\(/.test(line)) {
      imageCount++
    }
  }

  return {
    headingLevels: headings.map(h => h.level),
    headingCount: headings.length,
    componentNames: components.map(c => c.name),
    componentCount: components.length,
    codeBlockCount,
    imageCount,
  }
}

// ---------------------------------------------------------------------------
// KB discovery
// ---------------------------------------------------------------------------

/**
 * Discover all multi-locale knowledge bases under docs/content/.
 *
 * @returns {{ kbId: string, kbDir: string, locales: string[] }[]} array of KB descriptors
 */
function discoverKnowledgeBases() {
  const kbs = []
  for (const entry of readdirSync(docsContentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const kbYmlPath = join(docsContentDir, entry.name, 'kb.yml')
    if (!existsSync(kbYmlPath)) {
      continue
    }

    const yamlContent = readFileSync(kbYmlPath, 'utf-8')
    const kbConfig = parseDocument(yamlContent).toJSON() || {}
    const locales = kbConfig.locales || []

    if (locales.length <= 1) {
      continue
    } // nothing to compare

    kbs.push({
      kbId: entry.name,
      kbDir: join(docsContentDir, entry.name),
      locales,
    })
  }
  return kbs
}

/**
 * Collect all .md files (excluding .navigation.yml) for a given locale within a KB.
 *
 * @param {string} kbDir - path to the knowledge base directory
 * @param {string} locale - locale code (e.g. 'en', 'zh')
 * @returns {Map<string, string>} relative-path → absolute-path map
 */
function collectLocaleFiles(kbDir, locale) {
  const localeDir = join(kbDir, locale)
  if (!existsSync(localeDir)) {
    return new Map()
  }

  const files = walkDir(localeDir, f => f.endsWith('.md') && !f.endsWith('.navigation.yml'))
  const map = new Map()
  for (const abs of files) {
    const rel = relative(localeDir, abs)
    map.set(rel, abs)
  }
  return map
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const kbs = discoverKnowledgeBases()
assert.ok(kbs.length >= 0, 'No multi-locale knowledge bases found; nothing to check.')

if (kbs.length === 0) {
  console.log('No multi-locale knowledge bases found — translation parity check skipped.')
  process.exit(0)
}

/** @type {{ kbId: string, locale: string, file: string, issue: string }[]} */
const issues = []

for (const kb of kbs) {
  const referenceLocale = kb.locales[0] // typically 'en'
  const refFiles = collectLocaleFiles(kb.kbDir, referenceLocale)

  for (const locale of kb.locales.slice(1)) {
    const targetFiles = collectLocaleFiles(kb.kbDir, locale)

    // 1. Check for missing or extra files
    for (const [rel] of refFiles) {
      if (!targetFiles.has(rel)) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `missing file — exists in ${referenceLocale} but not in ${locale}`,
        })
      }
    }
    for (const [rel] of targetFiles) {
      if (!refFiles.has(rel)) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `extra file — exists in ${locale} but not in ${referenceLocale}`,
        })
      }
    }

    // 2. Check structural parity for common files
    for (const [rel, refAbs] of refFiles) {
      const targetAbs = targetFiles.get(rel)
      if (!targetAbs) {
        continue
      }

      const refContent = readFileSync(refAbs, 'utf-8')
      const targetContent = readFileSync(targetAbs, 'utf-8')

      const refStruct = extractStructure(refContent)
      const targetStruct = extractStructure(targetContent)

      // Heading count
      if (refStruct.headingCount !== targetStruct.headingCount) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `heading count mismatch — ${referenceLocale}: ${refStruct.headingCount}, ${locale}: ${targetStruct.headingCount}`,
        })
      }

      // Heading hierarchy
      if (refStruct.headingLevels.join(',') !== targetStruct.headingLevels.join(',')) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `heading hierarchy mismatch — ${referenceLocale}: [${refStruct.headingLevels.join(',')}], ${locale}: [${targetStruct.headingLevels.join(',')}]`,
        })
      }

      // Component count
      if (refStruct.componentCount !== targetStruct.componentCount) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `component count mismatch — ${referenceLocale}: ${refStruct.componentCount}, ${locale}: ${targetStruct.componentCount}`,
        })
      }

      // Component names (order matters — indicates section restructuring)
      if (refStruct.componentNames.join(',') !== targetStruct.componentNames.join(',')) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `component order mismatch — ${referenceLocale}: [${refStruct.componentNames.join(', ')}], ${locale}: [${targetStruct.componentNames.join(', ')}]`,
        })
      }

      // Code block count
      if (refStruct.codeBlockCount !== targetStruct.codeBlockCount) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `code block count mismatch — ${referenceLocale}: ${refStruct.codeBlockCount}, ${locale}: ${targetStruct.codeBlockCount}`,
        })
      }

      // Image count
      if (refStruct.imageCount !== targetStruct.imageCount) {
        issues.push({
          kbId: kb.kbId,
          locale,
          file: rel,
          issue: `image count mismatch — ${referenceLocale}: ${refStruct.imageCount}, ${locale}: ${targetStruct.imageCount}`,
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (issues.length > 0) {
  console.error(`\n❌ Translation parity check failed — ${issues.length} issue(s) across ${kbs.length} KB(s):\n`)

  /** @type {Map<string, typeof issues>} */
  const byLocale = new Map()
  for (const issue of issues) {
    const key = `${issue.kbId}/${issue.locale}`
    if (!byLocale.has(key)) {
      byLocale.set(key, [])
    }
    byLocale.get(key).push(issue)
  }

  for (const [key, localeIssues] of byLocale) {
    console.error(`  ${key}:`)
    for (const issue of localeIssues) {
      console.error(`    ${issue.file}`)
      console.error(`      ↳ ${issue.issue}`)
    }
    console.error()
  }

  process.exit(1)
}

const totalLocales = kbs.reduce((sum, kb) => sum + kb.locales.length - 1, 0)
console.log(`✅ Translation parity check passed — ${kbs.length} KB(s), ${totalLocales} non-reference locale(s), all files structurally match.`)
