import { queryCollection } from '@nuxt/content/server'
import { joinURL } from 'ufo'
import { getAllDocsCollectionNames, getDocsMode, hasSiteContent } from '../../utils/docs'
import { inferSiteURL } from '../../utils/meta'

interface SitemapUrl {
  loc: string
  lastmod?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const publicConfig = config.public as Parameters<typeof getDocsMode>[0]
  const siteUrl = getSiteConfig(event).url || inferSiteURL() || getRequestURL(event).origin || ''
  const urls: SitemapUrl[] = []

  if (getDocsMode(publicConfig) === 'kb') {
    urls.push({ loc: '/' })
  }

  const collections = [...getAllDocsCollectionNames(publicConfig)]

  if (getDocsMode(publicConfig) === 'legacy') {
    const availableLocales = publicConfig.tockdocs?.filteredLocales?.map(locale => locale.code) || []

    if (availableLocales.length > 0) {
      collections.push(...availableLocales.map(locale => `landing_${locale}`))
    }
    else {
      collections.push('landing')
    }
  }
  else if (hasSiteContent(publicConfig)) {
    collections.push('site')
  }

  for (const collection of collections) {
    try {
      const pages = await (queryCollection as unknown as (event: unknown, collection: string) => { all: () => Promise<Array<Record<string, unknown> & { path?: string }>> })(event, collection).all()

      for (const page of pages) {
        const meta = page as Record<string, unknown>
        const pagePath = page.path || '/'

        if (meta.sitemap === false) continue
        if (pagePath.endsWith('.navigation') || pagePath.includes('/.navigation')) continue

        const urlEntry: SitemapUrl = {
          loc: pagePath,
        }

        if (meta.modifiedAt && typeof meta.modifiedAt === 'string') {
          urlEntry.lastmod = meta.modifiedAt.split('T')[0]
        }

        urls.push(urlEntry)
      }
    }
    catch (error) {
      console.warn(`[TockDocs/sitemap] Failed to query collection "${collection}" for sitemap: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const sitemap = generateSitemap(urls, siteUrl)

  setResponseHeader(event, 'content-type', 'application/xml')
  return sitemap
})

function generateSitemap(urls: SitemapUrl[], siteUrl: string): string {
  const uniqueUrls = [...new Map(urls.map(url => [url.loc, url])).values()]

  const urlEntries = uniqueUrls
    .map((url) => {
      const loc = siteUrl ? joinURL(siteUrl, url.loc) : url.loc
      let entry = `  <url>\n    <loc>${escapeXml(loc)}</loc>`

      if (url.lastmod) {
        entry += `\n    <lastmod>${escapeXml(url.lastmod)}</lastmod>`
      }

      entry += `\n  </url>`
      return entry
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
