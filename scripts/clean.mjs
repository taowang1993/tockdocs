import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// Only clean up the root dev port and repo-owned preview servers so we do not
// terminate sibling projects that intentionally use the same commands.
const ports = [4987]
const processPatterns = [
  resolve(repoRoot, 'docs/.output/server/index.mjs'),
  resolve(repoRoot, 'playground/.output/server/index.mjs'),
]

const cleanupTargets = [
  '.nuxt',
  '.output',
  'docs/.nuxt',
  'docs/.output',
  'docs/.data',
  'layer/.nuxt',
  'layer/.data',
  'playground/.nuxt',
  'playground/.output',
  'playground/.data',
  'node_modules/.cache/nuxt',
]

function run(command, args) {
  try {
    return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
  }
  catch {
    return ''
  }
}

function getPidsForPort(port) {
  const output = run('lsof', ['-ti', `tcp:${port}`])
  return output ? output.split('\n').filter(Boolean) : []
}

function getPidsForPattern(pattern) {
  const output = run('pgrep', ['-f', pattern])
  return output ? output.split('\n').filter(Boolean) : []
}

function unique(values) {
  return [...new Set(values)]
}

function killPids(pids) {
  if (pids.length === 0) {
    return
  }

  for (const signal of ['-TERM', '-KILL']) {
    run('kill', [signal, ...pids])
  }
}

const stalePids = unique([
  ...ports.flatMap(getPidsForPort),
  ...processPatterns.flatMap(getPidsForPattern),
]).filter(pid => pid !== String(process.pid))

if (stalePids.length > 0) {
  console.log(`[clean] Killing stale TockDocs/Nuxt processes: ${stalePids.join(', ')}`)
  killPids(stalePids)
}
else {
  console.log('[clean] No stale TockDocs/Nuxt processes found')
}

for (const target of cleanupTargets) {
  const path = resolve(target)
  if (!existsSync(path)) {
    continue
  }

  rmSync(path, { recursive: true, force: true })
  console.log(`[clean] Removed ${target}`)
}

console.log('[clean] Done')
