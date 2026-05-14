import { addServerPlugin, createResolver, defineNuxtModule, logger } from '@nuxt/kit'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import {
  buildMarkdownAliasPath,
  getRenderedPathFromMarkdownAliasPath,
  getRenderedPathFromRawContentPath,
  getRenderedPathFromSourceContentPath,
  hasContentSourceExtension,
} from '../utils/content-source'

const log = logger.withTag('TockDocs')
const { resolve: resolveLocal } = createResolver(import.meta.url)

type I18nLocale = string | { code: string }
type TockDocsI18nOptions = { locales?: I18nLocale[] }
type PublicTockDocsConfig = { filteredLocales?: I18nLocale[] }

export function getMarkdownRewriteLocaleCodes(options: { i18n?: TockDocsI18nOptions, filteredLocales?: I18nLocale[] }) {
  const locales = options.filteredLocales?.length
    ? options.filteredLocales
    : options.i18n?.locales || []

  return locales.map((locale) => {
    return typeof locale === 'string' ? locale : locale.code
  })
}

function rewriteLlmsTxtUrlsToMarkdownAliases(llmsTxt: string) {
  return llmsTxt.replace(/\((https?:\/\/[^)]+)\)/g, (fullMatch, url) => {
    try {
      const parsed = new URL(url)

      if (parsed.pathname.startsWith('/raw/')) {
        parsed.pathname = buildMarkdownAliasPath(getRenderedPathFromRawContentPath(parsed.pathname))
        return `(${parsed.toString()})`
      }

      if (parsed.pathname.startsWith('/source/')) {
        parsed.pathname = buildMarkdownAliasPath(getRenderedPathFromSourceContentPath(parsed.pathname))
        return `(${parsed.toString()})`
      }

      if (!hasContentSourceExtension(parsed.pathname)) {
        return fullMatch
      }

      parsed.pathname = buildMarkdownAliasPath(getRenderedPathFromMarkdownAliasPath(parsed.pathname))
      return `(${parsed.toString()})`
    }
    catch {
      return fullMatch
    }
  })
}

export default defineNuxtModule({
  meta: {
    name: 'markdown-rewrite',
  },
  setup(_options, nuxt) {
    addServerPlugin(resolveLocal('../server/plugins/llms-markdown-alias'))

    nuxt.hooks.hook('nitro:init', (nitro) => {
      if (nitro.options.dev || !nitro.options.preset.includes('vercel')) {
        return
      }

      nitro.hooks.hook('compiled', async () => {
        const vcJSON = resolve(nitro.options.output.dir, 'config.json')
        const vcConfig = JSON.parse(await readFile(vcJSON, 'utf8'))

        // Check if llms.txt exists before setting up any routes
        let llmsTxt
        const llmsTxtPath = resolve(nitro.options.output.publicDir, 'llms.txt')
        try {
          llmsTxt = await readFile(llmsTxtPath, 'utf-8')
        }
        catch {
          log.warn('llms.txt not found, skipping markdown redirect routes')
          return
        }

        const rewrittenLlmsTxt = rewriteLlmsTxtUrlsToMarkdownAliases(llmsTxt)

        if (rewrittenLlmsTxt !== llmsTxt) {
          llmsTxt = rewrittenLlmsTxt
          await writeFile(llmsTxtPath, llmsTxt, 'utf8')
        }

        // Always redirect / to /llms.txt and ensure plain text content type
        const markdownHeaders = {
          'content-type': 'text/markdown; charset=utf-8',
        }

        const routes = [
          {
            src: '^/$',
            dest: '/llms.txt',
            headers: markdownHeaders,
            has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
          },
          {
            src: '^/$',
            dest: '/llms.txt',
            headers: markdownHeaders,
            has: [{ type: 'header', key: 'user-agent', value: 'curl/.*' }],
          },
        ]

        // Check if i18n is enabled
        const i18nOptions = (nuxt.options as typeof nuxt.options & { i18n?: TockDocsI18nOptions }).i18n
        const isI18nEnabled = !!i18nOptions?.locales
        let localeCodes: string[] = []

        if (isI18nEnabled) {
          const filteredLocales = (nuxt.options.runtimeConfig.public.tockdocs as PublicTockDocsConfig | undefined)?.filteredLocales
          localeCodes = getMarkdownRewriteLocaleCodes({
            i18n: i18nOptions,
            filteredLocales,
          })

          if (localeCodes.length === 0) {
            log.warn('No valid i18n locales available for markdown redirect routes; skipping locale homepage redirects')
          }

          // Create a regex pattern for all locales (e.g., "en|fr|es")
          const localePattern = localeCodes.join('|')

          if (localePattern.length > 0) {
            // Add routes for each locale homepage: /{locale} → /llms.txt
            routes.push(
              {
                src: `^/(${localePattern})$`,
                dest: '/llms.txt',
                headers: markdownHeaders,
                has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
              },
              {
                src: `^/(${localePattern})$`,
                dest: '/llms.txt',
                headers: markdownHeaders,
                has: [{ type: 'header', key: 'user-agent', value: 'curl/.*' }],
              },
            )
          }
        }

        // Catch-all route for all /docs/** pages: when the client requests
        // markdown (Accept header or curl UA), rewrite to the /source/**
        // endpoint which serves the original markdown with the correct
        // Content-Type.  A single catch-all avoids the Vercel 100-route
        // limit that per-page routes would hit for large doc sites.
        const catchAllRoutes = [
          {
            src: '^/docs/(.*)$',
            dest: '/source/docs/$1.md',
            headers: markdownHeaders,
            has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
          },
          {
            src: '^/docs/(.*)$',
            dest: '/source/docs/$1.md',
            headers: markdownHeaders,
            has: [{ type: 'header', key: 'user-agent', value: 'curl/.*' }],
          },
        ]
        routes.push(...catchAllRoutes)

        vcConfig.routes.unshift(...routes)
        await writeFile(vcJSON, JSON.stringify(vcConfig, null, 2), 'utf8')
        log.info(`Successfully wrote ${routes.length} markdown redirect routes to ${vcJSON}`)
      })
    })
  },
})
