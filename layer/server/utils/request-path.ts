import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

export function getRoutedRequestPath(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  const baseURL = runtimeConfig.app?.baseURL || '/'
  const basePath = baseURL === '/' ? '' : baseURL.replace(/\/$/, '')
  const requestPath = getRequestURL(event).pathname

  if (basePath && requestPath.startsWith(basePath)) {
    return requestPath.slice(basePath.length) || '/'
  }

  return requestPath
}
