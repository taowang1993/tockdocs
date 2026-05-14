#!/usr/bin/env node

/**
 * Delete assets from Vercel Blob.
 *
 * Prerequisites:
 *   BLOB_READ_WRITE_TOKEN in .env.local
 *
 * Usage:
 *   node scripts/delete-blobs.mjs chemistry/1.1.webp           # delete a single blob
 *   node scripts/delete-blobs.mjs chemistry/                   # delete all blobs with prefix
 *   node scripts/delete-blobs.mjs site/ playground/            # delete multiple prefixes
 *   node scripts/delete-blobs.mjs --dry-run chemistry/         # preview what would be deleted
 *   node scripts/delete-blobs.mjs --unused                     # delete blobs not referenced in content
 *
 * The --unused flag scans all content (.md, .vue, .ts) in docs/, layer/, playground/
 * for blob.vercel-storage.com URLs and deletes blobs that aren't referenced.
 */

import { list, del } from '@vercel/blob'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env.local
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
try {
  const envContent = readFileSync(join(repoRoot, '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}
catch {
  // ok
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN not set.')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const unusedMode = args.includes('--unused')
const targets = args.filter(a => !a.startsWith('--'))

function walkFiles(dir, exts) {
  const result = []
  const stack = [join(repoRoot, dir)]
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    }
    catch { continue }
    for (const e of entries) {
      const full = join(current, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (exts.some(ext => e.name.endsWith(ext))) result.push(full)
    }
  }
  return result
}

async function main() {
  // Fetch all blobs
  const allBlobs = []
  let cursor
  do {
    const page = await list({ cursor })
    allBlobs.push(...page.blobs)
    cursor = page.cursor
  } while (cursor)

  console.error(`Found ${allBlobs.length} total blobs.\n`)

  let toDelete = []

  if (unusedMode) {
    // Scan all content for blob URLs
    const contentFiles = [
      ...walkFiles('docs/content', ['.md', '.vue', '.ts']),
      ...walkFiles('docs/app', ['.md', '.vue', '.ts']),
      ...walkFiles('layer', ['.md', '.vue', '.ts']),
      ...walkFiles('playground/content', ['.md', '.vue', '.ts']),
    ]

    const referencedUrls = new Set()
    for (const f of contentFiles) {
      const content = readFileSync(f, 'utf-8')
      const matches = content.matchAll(/https:\/\/\w+\.public\.blob\.vercel-storage\.com\/[^\s"')\]]+/g)
      for (const m of matches) referencedUrls.add(m[0])
    }

    console.error(`Scanned ${contentFiles.length} content files, found ${referencedUrls.size} blob URL references.\n`)

    toDelete = allBlobs.filter(b => !referencedUrls.has(b.url))
  }
  else if (targets.length) {
    // Delete blobs matching the given path/prefix
    toDelete = allBlobs.filter(b => targets.some(t => b.pathname === t || b.pathname.startsWith(t)))
  }
  else {
    console.error('Usage: node scripts/delete-blobs.mjs <pathname|prefix...> [--dry-run]')
    console.error('       node scripts/delete-blobs.mjs --unused [--dry-run]')
    process.exit(1)
  }

  if (!toDelete.length) {
    console.error('No blobs to delete.')
    return
  }

  console.error(`${dryRun ? '[DRY RUN] Would delete' : 'Deleting'} ${toDelete.length} blob(s):\n`)

  let deleted = 0
  for (const b of toDelete) {
    console.error(`  ${b.pathname}  (${(b.size / 1024).toFixed(1)}KB)`)
    if (!dryRun) {
      try {
        await del(b.url)
        deleted++
      }
      catch (err) {
        console.error(`    ✗ Failed: ${err.message}`)
      }
    }
  }

  if (!dryRun) {
    console.error(`\nDeleted ${deleted} blob(s).`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
