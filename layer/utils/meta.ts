import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { withHttps } from 'ufo'

export function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

function hasExplicitProtocol(url: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(url)
}

export function normalizeSiteURL(url: string) {
  const normalizedUrl = trimTrailingSlash(url)
  return hasExplicitProtocol(normalizedUrl)
    ? normalizedUrl
    : trimTrailingSlash(withHttps(normalizedUrl))
}

export function inferSiteURL() {
  // https://github.com/unjs/std-env/issues/59
  const url = (
    process.env.NUXT_PUBLIC_SITE_URL // Nuxt public runtime config
    || process.env.NUXT_SITE_URL // Nuxt site config
    || process.env.VERCEL_PROJECT_PRODUCTION_URL // Vercel production URL
    || process.env.VERCEL_BRANCH_URL // Vercel branch URL
    || process.env.VERCEL_URL // Vercel deployment URL
    || process.env.URL // Netlify
    || process.env.CI_PAGES_URL // Gitlab Pages
    || process.env.CF_PAGES_URL // Cloudflare Pages
  )

  if (!url) {
    return undefined
  }

  return normalizeSiteURL(url)
}

export async function getPackageJsonMetadata(dir: string) {
  try {
    const packageJson = await readFile(resolve(dir, 'package.json'), 'utf-8')
    const parsed = JSON.parse(packageJson)
    return {
      name: parsed.name,
      description: parsed.description,
    }
  }
  catch {
    return {
      name: 'docs',
    }
  }
}
