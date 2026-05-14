import { addServerHandler, createResolver, defineNuxtModule, extendPages } from '@nuxt/kit'
import { getTockDocsContentConfiguration } from '../utils/knowledge-bases'
import { landingPageExists } from '../utils/pages'

type TockDocsI18nOptions = { locales?: Array<string | { code: string }> }
type NuxtPage = { file?: string, children?: NuxtPage[] }

function removePagesByFile(pages: NuxtPage[], file: string) {
  for (let index = pages.length - 1; index >= 0; index--) {
    const page = pages[index]

    if (page?.file === file) {
      pages.splice(index, 1)
      continue
    }

    if (page?.children?.length) {
      removePagesByFile(page.children, file)
    }
  }
}

export default defineNuxtModule({
  meta: {
    name: 'routing',
  },
  async setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const contentConfiguration = getTockDocsContentConfiguration(nuxt.options.rootDir)

    const i18nOptions = (nuxt.options as typeof nuxt.options & { i18n?: TockDocsI18nOptions }).i18n
    const isI18nEnabled = !!i18nOptions?.locales
    const isKnowledgeBaseMode = contentConfiguration.mode === 'kb'

    addServerHandler({
      middleware: true,
      handler: resolve('../server/middleware/markdown-source-alias'),
    })

    addServerHandler({
      route: '/source/**',
      handler: resolve('../server/handlers/source-markdown'),
    })

    nuxt.hook('imports:extend', (imports) => {
      if (!imports.some(i => i.name === 'useTockDocsI18n')) {
        imports.push({
          name: 'useTockDocsI18n',
          from: resolve('../app/composables/useTockDocsI18n'),
        })
      }

      if (!imports.some(i => i.name === 'useTockDocs')) {
        imports.push({
          name: 'useTockDocs',
          from: resolve('../app/composables/useTockDocs'),
        })
      }
    })

    extendPages((pages) => {
      const legacyDocsPage = resolve('../app/pages/[[lang]]/[...slug].vue')
      const knowledgeBaseHomePage = resolve('../app/pages/docs/[kb]/index.vue')
      const knowledgeBaseLocaleIndexPage = resolve('../app/pages/docs/[kb]/[locale]/index.vue')
      const knowledgeBaseDocsPage = resolve('../app/pages/docs/[kb]/[locale]/[[...slug]].vue')

      // Register routes for static files that are served by Nitro handlers
      // (llms.txt, llms-full.txt, sitemaps, etc.).  These give Vue Router a
      // matching route so it doesn't emit "No match found" warnings during
      // route resolution.  The page component immediately redirects externally
      // to the real Nitro handler.
      const staticFileRedirectPage = resolve('../app/pages/static-file-redirect.vue')
      const staticFilePaths = [
        '/llms-full.txt',
        '/llms.txt',
        '/sitemap.xml',
        '/sitemap-index.xml',
        '/sitemap_index.xml',
      ]
      for (const filePath of staticFilePaths) {
        if (!pages.some(p => p.path === filePath)) {
          pages.push({
            name: `static-file-${filePath.replace(/[^a-z0-9]/gi, '-')}`,
            path: filePath,
            file: staticFileRedirectPage,
          })
        }
      }

      if (isKnowledgeBaseMode) {
        removePagesByFile(pages as NuxtPage[], legacyDocsPage)
        removePagesByFile(pages as NuxtPage[], knowledgeBaseDocsPage)

        pages.push({
          name: 'docs-kb-locale-slug',
          path: '/docs/:kb/:locale/:slug(.*)*',
          file: knowledgeBaseDocsPage,
        })

        // Keep the /docs/:kb redirect page so that KB root URLs (e.g. /docs/chemistry)
        // without a locale still redirect to the KB home with default locale + entry slug.
        pages.push({
          name: 'docs-kb-index',
          path: '/docs/:kb',
          file: knowledgeBaseHomePage,
        })

        // Keep the /docs/:kb/:locale redirect page so that visiting a KB locale root
        // (e.g. /docs/chemistry/en) redirects to the entry page instead of 404-ing.
        pages.push({
          name: 'docs-kb-locale-index',
          path: '/docs/:kb/:locale',
          file: knowledgeBaseLocaleIndexPage,
        })
      }
      else {
        removePagesByFile(pages as NuxtPage[], knowledgeBaseHomePage)
        removePagesByFile(pages as NuxtPage[], knowledgeBaseLocaleIndexPage)
        removePagesByFile(pages as NuxtPage[], knowledgeBaseDocsPage)
      }

      if (landingPageExists(nuxt.options.rootDir)) {
        return
      }

      const landingTemplate = resolve('../app/templates/landing.vue')

      if (isKnowledgeBaseMode) {
        pages.push({
          name: 'index',
          path: '/',
          file: landingTemplate,
        })
        return
      }

      if (isI18nEnabled) {
        pages.push({
          name: 'lang-index',
          path: '/:lang?',
          file: landingTemplate,
        })
      }
      else {
        pages.push({
          name: 'index',
          path: '/',
          file: landingTemplate,
        })
      }
    })
  },
})
