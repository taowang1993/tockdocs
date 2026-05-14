import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

for (const envPath of [resolve('.env'), resolve('.env.local')]) {
  if (existsSync(envPath)) {
    process.loadEnvFile?.(envPath)
  }
}

const [command, ...args] = process.argv.slice(2)

if (!command) {
  console.error('Usage: node scripts/with-env.mjs <command> [...args]')
  process.exit(1)
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
