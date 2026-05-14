#!/usr/bin/env node

/**
 * Upload assets from a local directory to Vercel Blob.
 *
 * Prerequisites:
 *   BLOB_READ_WRITE_TOKEN in .env.local (from Vercel dashboard → Storage → Blob)
 *
 * Usage:
 *   node scripts/upload-assets.mjs <source-dir> <blob-prefix>
 *   node scripts/upload-assets.mjs docs/public/chemistry chemistry    # uploads to /chemistry/*.webp
 *   node scripts/upload-assets.mjs docs/public/chemistry chemistry --dry-run
 */

import { put, list } from '@vercel/blob'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env.local manually (no dependency)
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
try {
  const envContent = readFileSync(join(repoRoot, '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}
catch {
  // .env.local may not exist; that's fine
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN not set.')
  console.error('   Get it from Vercel dashboard → Project → Storage → Blob → Create.')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const positional = args.filter(a => !a.startsWith('--'))
const sourceDir = positional[0]
const prefix = positional[1] || ''

if (!sourceDir) {
  console.error('Usage: node scripts/upload-assets.mjs <source-dir> [prefix] [--dry-run]')
  process.exit(1)
}

function walkFiles(dir) {
  const files = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) files.push(full)
    }
  }
  return files
}

async function main() {
  const absSource = join(repoRoot, sourceDir)
  const files = walkFiles(absSource)
  console.log(`Found ${files.length} files in ${sourceDir}${dryRun ? ' (dry run)' : ''}\n`)

  // Check existing blobs
  let existing = new Set()
  try {
    if (!dryRun) {
      const { blobs } = await list({ prefix })
      existing = new Set(blobs.map(b => b.pathname))
      if (existing.size) console.log(`${existing.size} blobs already exist with prefix "${prefix}"`)
    }
  }
  catch {
    // list may fail if no blobs exist yet
  }

  const manifest = {}
  let uploaded = 0, skipped = 0, errors = 0

  for (const file of files) {
    const relPath = relative(absSource, file)
    const blobPath = prefix ? `${prefix}/${relPath}` : relPath

    if (existing.has(blobPath)) {
      console.log(`  ⏭  ${blobPath} (exists)`)
      skipped++
      continue
    }

    if (dryRun) {
      const size = statSync(file).size
      console.log(`  ↑  ${blobPath}  (${(size / 1024).toFixed(1)}KB)`)
      continue
    }

    try {
      const body = readFileSync(file)
      const ext = file.split('.').pop()?.toLowerCase()
      const contentType = {
        webp: 'image/webp', svg: 'image/svg+xml',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      }[ext] || 'application/octet-stream'

      const result = await put(blobPath, body, {
        access: 'public',
        addRandomSuffix: false,
        contentType,
        cacheControlMaxAge: 31536000,
      })

      manifest[relPath] = result.url
      uploaded++
      console.log(`  ✓  ${blobPath}`)
    }
    catch (err) {
      errors++
      console.error(`  ✗  ${blobPath}: ${err.message}`)
    }
  }

  console.log(`\n${uploaded} uploaded, ${skipped} skipped, ${errors} errors`)

  if (!dryRun && Object.keys(manifest).length) {
    console.log('\n── Manifest (save as blob-urls.json) ──')
    console.log(JSON.stringify(manifest, null, 2))
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
