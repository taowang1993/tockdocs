import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { isPortFree } from './dev-port.mjs'

for (const envPath of [resolve('.env'), resolve('.env.local')]) {
  if (existsSync(envPath)) {
    process.loadEnvFile?.(envPath)
  }
}

// Kill stale Nuxt dev servers before starting a new one
function killStaleDevServers() {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq nuxt.mjs dev"', { stdio: 'pipe' })
    }
    else {
      execSync('pkill -f "nuxt.mjs dev"', { stdio: 'pipe' })
    }
  }
  catch {
    // Stale servers may not exist — that's fine.
  }
}
killStaleDevServers()

const appDir = process.argv[2]
const extraArgs = process.argv.slice(3)

if (!appDir) {
  console.error('Usage: node scripts/run-dev.mjs <docs|playground> [...nuxt args]')
  process.exit(1)
}

const host = process.env.NUXT_HOST || 'localhost'
const port = 4987
const env = {
  ...process.env,
  NUXT_HOST: host,
  NUXT_PORT: String(port),
}

if (!env.NUXT_SITE_URL) {
  delete env.NUXT_SITE_URL
}

if (!(await isPortFree(port, host))) {
  throw new Error(
    `Port ${port} is already in use on host "${host}". Stop the process using ${port} and rerun TockDocs; this launcher will not fall back to 3000 or 3001.`,
  )
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

await run(pnpm, ['run', 'layer:prepare'], { env })
await run(pnpm, [
  'exec',
  'nuxt',
  'dev',
  '--extends',
  '../layer',
  '--host',
  host,
  '--port',
  String(port),
  ...extraArgs,
], {
  cwd: appDir,
  env,
})

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      if (code && code !== 0) {
        process.exit(code)
      }

      resolve()
    })
  })
}
