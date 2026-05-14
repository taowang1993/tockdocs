import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')

function loadKnowledgeBaseDirectoryComponent(): string {
  const path = resolve(repoRoot, 'layer/app/components/KnowledgeBaseDirectory.vue')
  assert.ok(existsSync(path), `KnowledgeBaseDirectory.vue not found at ${path}`)
  return readFileSync(path, 'utf-8')
}

function loadBuiltEntryCss(): string {
  const candidates = [
    resolve(repoRoot, 'docs/.vercel/output/static/_nuxt'),
    resolve(repoRoot, 'docs/.output/public/_nuxt'),
  ]
  for (const dir of candidates) {
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
    const match = files.find((f: string) => f.startsWith('entry.') && f.endsWith('.css'))
    if (match) return readFileSync(resolve(dir, match), 'utf-8')
  }
  return ''
}

// ── Source-level checks (run without build) ──

test('KB directory hero has a divider below it', () => {
  const content = loadKnowledgeBaseDirectoryComponent()

  // The hero should carry a border-b utility class to separate it from
  // the card grid. Use a regex so whitespace / className reordering
  // won't cause false negatives.
  assert.ok(
    /<UPageHero\s[^>]*\bclass="[^"]*\bborder-b\b/.test(content),
    'KnowledgeBaseDirectory must have a divider (border-b class on UPageHero) between the hero and the card grid',
  )
})

test('KB directory cards use spotlight effect', () => {
  const content = loadKnowledgeBaseDirectoryComponent()

  assert.ok(
    content.includes('spotlight'),
    'KnowledgeBaseDirectory cards must use the spotlight prop for the radial-gradient glow',
  )
})

test('KB directory cards use footer slot for badges', () => {
  const content = loadKnowledgeBaseDirectoryComponent()

  // Badges must live in the #footer slot so they stick to the card bottom
  assert.ok(
    content.includes('<template #footer>'),
    'KnowledgeBaseDirectory cards must use the <template #footer> slot for badges',
  )
})

test('KB directory badges use md size', () => {
  const content = loadKnowledgeBaseDirectoryComponent()

  // Count <UBadge occurrences in source (tags can span multiple lines)
  const badgeCount = (content.match(/<UBadge\b/g) || []).length
  assert.ok(badgeCount >= 2, `expected at least 2 UBadge instances, found ${badgeCount}`)

  // Every size="sm" must be absent — badges should be md
  assert.ok(
    !content.includes('size="sm"'),
    'badges must not use size="sm" (should be md)',
  )
  assert.ok(
    content.includes('size="md"'),
    'badges must use size="md"',
  )
})

test('KB directory badge labels are capitalized', () => {
  const content = loadKnowledgeBaseDirectoryComponent()

  // The badge template must call formatBadgeLabel to capitalize the first letter
  assert.ok(
    content.includes('formatBadgeLabel'),
    'KnowledgeBaseDirectory must use formatBadgeLabel to capitalize badge labels',
  )
})

test('spotlight variant CSS is present in built output', () => {
  const css = loadBuiltEntryCss()
  if (!css) return // Skip if no build output (e.g. clean repo)

  // The spotlight radial-gradient ::before rule must exist
  assert.ok(
    css.includes('radial-gradient(var(--spotlight-size)'),
    'missing spotlight radial-gradient CSS — the before: pseudo-element glow rule was not generated',
  )

  // The spotlight overlay must exist (bg-default with opacity and pointer-events-none)
  assert.ok(
    css.includes('bg-default') && css.includes('pointer-events-none'),
    'missing spotlight overlay CSS (bg-default + pointer-events-none)',
  )

  // The --spotlight-size custom property must be set
  assert.ok(
    css.includes('--spotlight-size:400px'),
    'missing --spotlight-size custom property',
  )
})
