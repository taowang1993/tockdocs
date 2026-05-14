#!/usr/bin/env node

/**
 * Scan for large assets and unoptimized images in source public/ directories.
 *
 * Checks:
 *   1. Files > 50KB in source public/ directories (bandwidth risk)
 *   2. Raster images (PNG/JPG/JPEG/JFIF) that should be WebP/AVIF
 *   3. Image references in .md content that still use old extensions
 *
 * Usage:
 *   node scripts/check-assets.mjs              # check source dirs + content
 *   node scripts/check-assets.mjs --threshold 100  # custom size threshold in KB
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const argvIdx = (flag) => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? -1 : i
}
const THRESHOLD_KB = argvIdx('--threshold') !== -1
  ? Number.parseInt(process.argv[argvIdx('--threshold') + 1], 10)
  : 50

const RASTER_EXTS = new Set(['.png', '.jpg', '.jpeg', '.jfif'])
const BUILD_DIRS = new Set(['.nuxt', '.output', '.vercel', 'node_modules', '.cache', 'dist'])

// Directories under source public/ kept as backups (not served, not flagged)
const BACKUP_DIRS = new Set([
  'docs/public/chemistry',
])

// ── helpers ────────────────────────────────────────────────────────

function walkDir(dir, predicate = () => true) {
  if (!existsSync(dir)) return []
  const results = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (BUILD_DIRS.has(entry.name)) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      }
      else if (entry.isFile() && predicate(full)) {
        results.push(full)
      }
    }
  }
  return results
}

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function rel(p) {
  return relative(repoRoot, p)
}

// ── source public/ directories ─────────────────────────────────────

function findSourcePublicDirs() {
  return [
    resolve(repoRoot, 'docs/public'),
    resolve(repoRoot, 'layer/public'),
    resolve(repoRoot, 'playground/public'),
  ].filter(existsSync)
}

// ── check 1: large files in source public/ ─────────────────────────

function isBackup(file) {
  const r = rel(file)
  for (const bd of BACKUP_DIRS) {
    if (r === bd || r.startsWith(bd + '/')) return true
  }
  return false
}

function checkLargeFiles(dirs) {
  const issues = []
  for (const dir of dirs) {
    for (const file of walkDir(dir)) {
      if (isBackup(file)) continue
      const size = statSync(file).size
      if (size > THRESHOLD_KB * 1024) {
        issues.push({ file: rel(file), size })
      }
    }
  }
  return issues
}

// ── check 2: raster images that should be WebP ─────────────────────

function checkRasterImages(dirs) {
  const issues = []
  for (const dir of dirs) {
    for (const file of walkDir(dir, f => RASTER_EXTS.has(extname(f).toLowerCase()))) {
      issues.push({ file: rel(file), ext: extname(file) })
    }
  }
  return issues
}

// ── check 3: stale image references in content ─────────────────────

function checkStaleRefs() {
  const issues = []
  const contentRoots = [
    resolve(repoRoot, 'docs/content'),
    resolve(repoRoot, 'playground/content'),
  ].filter(existsSync)

  for (const root of contentRoots) {
    for (const file of walkDir(root, f => /\.(?:md|mdc)$/.test(f))) {
      try {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const srcMatches = [...lines[i].matchAll(/src="([^"]+)"/gi)]
          for (const sm of srcMatches) {
            const ref = sm[1]
            // Skip external URLs and generated paths
            if (ref.startsWith('https://') || ref.startsWith('/_og/') || ref.startsWith('/_ipx/')) {
              continue
            }
            // Only flag raster extensions
            if (/\.(?:png|jpg|jpeg|jfif)$/i.test(ref)) {
              issues.push({ file: rel(file), line: i + 1, ref })
            }
          }
        }
      }
      catch { /* skip */ }
    }
  }
  return issues
}

// ── cwebp check ─────────────────────────────────────────────────────

function hasCwebp() {
  try {
    execSync('which cwebp', { stdio: 'ignore' })
  }
  catch {
    return false
  }
  return true
}

// ── main ────────────────────────────────────────────────────────────

function main() {
  const sourceDirs = findSourcePublicDirs()
  console.log(`Scanning ${sourceDirs.length} source public/ directories (threshold: ${THRESHOLD_KB}KB)\n`)

  let exitCode = 0

  // Check 1: large files
  const large = checkLargeFiles(sourceDirs)
  if (large.length) {
    console.log(`❌ ${large.length} large file(s) (>${THRESHOLD_KB}KB) in source public/:\n`)
    for (const issue of large) {
      console.log(`   ${issue.file}  (${formatSize(issue.size)})`)
    }
    console.log('\n   → Move large files to object storage. See .agents/reference/deploy.md §1.\n')
    exitCode = 1
  }
  else {
    console.log('✅ No large files in source public/.\n')
  }

  // Check 2: raster images
  const raster = checkRasterImages(sourceDirs)
  if (raster.length) {
    console.log(`❌ ${raster.length} unoptimized raster image(s) in source public/:\n`)
    for (const issue of raster) {
      console.log(`   ${issue.file}`)
    }
    if (hasCwebp()) {
      console.log('\n   → Convert: cwebp -q 90 -m 6 <file> -o <file>.webp && rm <file>')
    }
    else {
      console.log('\n   → Install cwebp: brew install webp')
    }
    console.log('   See .agents/reference/deploy.md §2.\n')
    exitCode = 1
  }
  else {
    console.log('✅ No unoptimized raster images in source public/.\n')
  }

  // Check 3: stale refs in content
  const stale = checkStaleRefs()
  if (stale.length) {
    console.log(`❌ ${stale.length} stale image reference(s) in content:\n`)
    for (const issue of stale) {
      console.log(`   ${issue.file}:${issue.line}  →  ${issue.ref}  (should be .webp)`)
    }
    console.log()
    exitCode = 1
  }
  else {
    console.log('✅ No stale image references in content.\n')
  }

  if (exitCode === 0) {
    console.log('All asset checks passed.')
  }

  process.exit(exitCode)
}

main()
