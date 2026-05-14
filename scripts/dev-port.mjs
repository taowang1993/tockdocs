import net from 'node:net'
import { fileURLToPath } from 'node:url'

const preferredPorts = [4987, 5183, 5417, 5721, 6123]

export function isPortFree(port, host = process.env.NUXT_HOST || 'localhost') {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}

export async function resolveDevPort({
  host = process.env.NUXT_HOST || 'localhost',
  ports = preferredPorts,
} = {}) {
  for (const port of ports) {
    if (await isPortFree(port, host)) {
      return port
    }
  }

  return ports[0]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(String(await resolveDevPort()))
}
