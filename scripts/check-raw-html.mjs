/**
 * Scans content markdown files for raw HTML tags that break Nuxt Studio's
 * TipTap visual editor.
 *
 * Raw HTML elements (<img>, <table>, <br>, <div>, etc.) cannot be rendered
 * by the TipTap editor, leaving the Studio left panel blank.  Content files
 * should use Markdown equivalents (![](), Markdown tables, blank lines) or
 * MDC components instead.
 *
 * HTML inside fenced code blocks (```html, ```mdc, etc.) is excluded
 * because it is documentation examples, not live content.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, join, extname } from 'node:path'

// Files or directory prefixes that are allowed to contain raw HTML.
// Only add entries when the HTML is structurally necessary and cannot
// be replaced with Markdown (e.g. complex tables with colspan/rowspan,
// or <br> inside Markdown table cells for multi-line content).
const ALLOWLIST_URL = new URL('../.raw-html-allowlist', import.meta.url)

let allowlist = []
try {
  const raw = readFileSync(ALLOWLIST_URL, 'utf8')
  allowlist = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
}
catch {
  // No allowlist file — everything is checked
}

// Tags that are known to break Nuxt Studio's TipTap editor.
const BLOCK_TAGS = /<\/?(?:table|thead|tbody|tr|td|th|div|section|header|footer|nav|main|aside|article|form|iframe|video|audio|canvas|svg)\b[^>]*>/gi
const VOID_TAGS = /<(?:img|br|hr|input|meta|link|source|embed|area|col|track|wbr)\b[^>]*>/gi
const INLINE_TAGS = /<\/?(?:span|sub|sup|[ubisq]|small|big|font|center|abbr|cite|dfn|kbd|mark|samp|var|ruby|bdi|bdo|map|del|ins)\b[^>]*>/gi
const IGNORED = /<\/?(?:mjx-container|mjx-assistive-mml)\b/i

function extractCodeFences(content) {
  const fences = []
  const lines = content.split('\n')
  let inFence = false
  let fenceStart = -1

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inFence) {
        inFence = true
        fenceStart = i
      }
      else {
        fences.push({ start: fenceStart, end: i })
        inFence = false
      }
    }
  }

  return fences
}

function isInCodeFence(lineNum, fences) {
  return fences.some(f => lineNum >= f.start && lineNum <= f.end)
}

function isAllowlisted(filePath) {
  const rel = relative(process.cwd(), filePath)
  return allowlist.some(entry => rel === entry || rel.startsWith(entry))
}

function scanContentForRawHtml(filePath) {
  if (isAllowlisted(filePath)) return []

  let content
  try {
    content = readFileSync(filePath, 'utf8')
  }
  catch {
    return []
  }

  const fences = extractCodeFences(content)
  const lines = content.split('\n')
  const violations = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isInCodeFence(i, fences)) continue

    const tags = [[BLOCK_TAGS, 'block'], [VOID_TAGS, 'void'], [INLINE_TAGS, 'inline']]

    for (const [tagRe] of tags) {
      const re = new RegExp(tagRe.source, tagRe.flags)
      let match
      while ((match = re.exec(line)) !== null) {
        const tag = match[0]

        if (IGNORED.test(tag)) continue

        // Skip if inside inline code (odd number of backticks before match)
        const before = line.slice(0, match.index)
        const backtickCount = (before.match(/`/g) || []).length
        if (backtickCount % 2 === 1) continue

        // HTML tags start with a letter
        if (!/^<\/?[a-z]/i.test(tag)) continue

        violations.push({
          file: relative(process.cwd(), filePath),
          line: i + 1,
          tag,
          context: line.trim().slice(0, 100),
        })
      }
    }
  }

  return violations
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    }
    else if (extname(entry) === '.md') {
      yield full
    }
  }
}

// --- CLI ---
const args = process.argv.slice(2)

let files
if (args.length > 0) {
  files = args.filter(a => a.endsWith('.md'))
}
else {
  files = [...walk('docs/content')]
}

if (files.length === 0) {
  console.log('No markdown files to scan.')
  process.exit(0)
}

let allViolations = []
for (const file of files) {
  const v = scanContentForRawHtml(file)
  allViolations = allViolations.concat(v)
}

if (allViolations.length > 0) {
  console.error(`\n⛔ ${allViolations.length} raw HTML tag(s) found in ${[...new Set(allViolations.map(v => v.file))].length} file(s):\n`)

  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.tag}`)
    console.error(`    ${v.context}\n`)
  }

  console.error('Raw HTML prevents Nuxt Studio\'s visual editor from loading these pages.')
  console.error('Replace with Markdown equivalents:')
  console.error('  <img src="..." /> → ![alt](url)')
  console.error('  <br>             → blank line')
  console.error('  <table>          → Markdown table or ::MDC component')
  console.error('  <sub>/<sup>      → use MDC component or remove')
  console.error()

  process.exit(1)
}

console.log(`✅ No raw HTML found in ${files.length} file(s).`)
